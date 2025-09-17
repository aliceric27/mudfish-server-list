// TODO: 刪除app.js 沒用到的函數、修復Hover 圖片不會顯示問題

import {
  tableBody,
  locationFilter,
  searchInput,
  countryFilterContainer,
  countryToggle,
  hoverCard,
  hoverCardTemplate,
  cpuMaxFilter,
  ioMaxFilter,
  nicMaxFilter,
  congestionMaxFilter,
  bestServerBtn,
  resetFiltersBtn,
  langSelect,
} from './config.js';

import { t, setLanguage, applyI18nStatic, METRIC_IMAGE_LABELS, currentLang } from './i18n.js';

import { loadServerCache, saveServerCache, loadUserFilters, saveUserFilters, applyUserFiltersFromStorage } from './storage.js';

import { fetchStaticNodes, fetchGlobalMetrics, getServerDetail as getServerDetailRaw } from './api.js';
import * as Table from './table.js';
import * as Filters from './filters.js';
import * as UI from './ui.js';


let nodes = [];
const nodeLookup = new Map();
const detailCache = new Map();
const pendingDetailRequests = new Map();
const globalMetrics = new Map();
const selectedCountryCodes = new Set();

let sortState = { key: "region", direction: "asc" };
function buildFiltersSnapshot() {
  return {
    lang: currentLang,
    location: locationFilter?.value ?? "all",
    keyword: searchInput?.value ?? "",
    cpuMax: cpuMaxFilter?.value ?? "",
    ioMax: ioMaxFilter?.value ?? "",
    nicMax: nicMaxFilter?.value ?? "",
    congestionMax: congestionMaxFilter?.value ?? "",
    countryCodes: Array.from(selectedCountryCodes.values()),
    sort: { key: sortState.key, direction: sortState.direction },
  };
}



// ================= i18n =================












// METRIC_LABELS / METRIC_IMAGE_LABELS are defined via i18n and setLanguage()


const SORTERS = {
  region: (node) => (node.locationRegion || node.location || "").toLowerCase(),
  provider: (node) => (node.providerBrand || node.provider || "").toLowerCase(),
  ip: (node) => node.ip,
  sid: (node) => Number(node.sid) || 0,
  cpuLoad: (node) => getGlobalMetricSortValue(node.sid, "cpuLoad"),
  ioWait: (node) => getGlobalMetricSortValue(node.sid, "ioWait"),
  nicError: (node) => getGlobalMetricSortValue(node.sid, "nicError"),
  network: (node) => getGlobalMetricSortValue(node.sid, "network"),
  congestion: (node) => getGlobalMetricSortValue(node.sid, "congestion"),
};



bootstrap();

async function bootstrap() {
  // 1) 語言偏好：優先使用使用者已儲存的偏好，否則依 IP 自動偵測
  try {
    const saved = loadUserFilters();
    if (saved?.lang) {
      setLanguage(saved.lang);
    } else {
      const detected = await detectLanguageByIP({ timeoutMs: 1500 });
      if (detected) setLanguage(detected);
    }
  } catch (_) {
    // 忽略偵測失敗，維持預設語言（en）
  }
  Table.initTable({
    tableBody,
    globalMetrics,
    t,
    getSortState: () => sortState,
    setSortState: (s) => { sortState = s; },
    getDisplaySortExtractor: (key) => SORTERS[key] ?? SORTERS.region,
    getFilteredNodes: Filters.getFilteredNodes,
    getServerDetailCached,
    onSortChanged: () => {
      Table.renderTable(Filters.getFilteredNodes());
      saveUserFilters(buildFiltersSnapshot());
    },
  });
  Filters.initFilters({
    globalMetrics,
    selectedCountryCodes,
    locationFilter,
    searchInput,
    cpuMaxFilter,
    ioMaxFilter,
    nicMaxFilter,
    congestionMaxFilter,
    getNodes: () => nodes,
    renderTable: Table.renderTable,
    hideHoverCard: UI.hideHoverCard,
    saveUserFilters,
    buildFiltersSnapshot,
    refreshCountryFilterUI: UI.refreshCountryFilterUI,
    toggleCountryPanel: UI.toggleCountryPanel,
    setSortState: (s) => { sortState = s; },
    updateSortIndicators: (headers) => Table.updateSortIndicators(headers),
    getHeaderEls: () => document.querySelectorAll("#serverTable thead th[data-sort-key]"),
  });
  UI.initUI({
    tableBody,
    countryFilterContainer,
    countryToggle,
    hoverCard,
    hoverCardTemplate,
    langSelect,
    locationFilter,
    searchInput,
    cpuMaxFilter,
    ioMaxFilter,
    nicMaxFilter,
    congestionMaxFilter,
    bestServerBtn,
    resetFiltersBtn,
    selectedCountryCodes,
    nodeLookup,
    t,
    setLanguage,
    onAfterLanguageChange: () => {
      UI.updateCountryToggleLabel();
      Table.renderTable(Filters.getFilteredNodes());
      saveUserFilters(buildFiltersSnapshot());
    },
    onFiltersChange: () => Filters.applyFilters(),
    onResetFilters: () => Filters.resetFilters(),
    onTableRowClick,
    renderTable: Table.renderTable,
    getServerDetailCached,
    buildDetailRows,
    formatTime,
    onBestServerPreset: applyBestServerPreset,
  });
  applyI18nStatic();
  UI.updateCountryToggleLabel();
  Table.setTablePlaceholder(t('table.loading'));
  const cached = loadServerCache();
  if (cached) {
    try {
      // 合併快取的 metrics 與節點
      const metricsMap = new Map(Object.entries(cached.metrics || {}));
      mergeGlobalMetrics(metricsMap);
      nodes = Table.sortNodes((cached.nodes || []).map(enrichNode));
      nodeLookup.clear();
      nodes.forEach((n) => nodeLookup.set(String(n.sid), n));

      // 依快取先建 UI 與渲染
      UI.populateLocationFilter(nodes);
      UI.populateCountryFilter(nodes);
      UI.attachEventListeners();
      Table.setupSorting();

      // 套用使用者設定
      const saved = loadUserFilters();
      if (saved) {
        applyUserFiltersFromStorage(saved, {
          setLanguage,
          updateCountryToggleLabel: UI.updateCountryToggleLabel,
          locationFilter, searchInput, cpuMaxFilter, ioMaxFilter, nicMaxFilter, congestionMaxFilter,
          selectedCountryCodes,
          refreshCountryFilterUI: UI.refreshCountryFilterUI,
          setSortState: (s) => { sortState = s; }
        });
        Table.updateSortIndicators(document.querySelectorAll("#serverTable thead th[data-sort-key]"));
        Table.renderTable(Filters.getFilteredNodes());
      } else {
        Table.renderTable(nodes);
      }

      // 背景刷新最新資料
      startBackgroundRefresh();
      return;
    } catch (e) {
      console.warn("讀取快取時發生問題，改為線上載入", e);
    }
  }
  // 沒有快取或快取失敗，走原本初始化流程
  await initialize();
}

async function startBackgroundRefresh() {
  try {
    const [fetchedNodes, statusMetrics] = await Promise.all([
      fetchStaticNodes(),
      fetchGlobalMetrics(),
    ]);
    mergeGlobalMetrics(statusMetrics);

    const newNodes = Table.sortNodes(fetchedNodes.map(enrichNode));
    // 更新 nodeLookup 與 in-memory nodes
    nodeLookup.clear();
    newNodes.forEach((n) => nodeLookup.set(String(n.sid), n));

    // 依目前篩選 + 排序，計算應顯示清單
    const desiredList = Table.sortForDisplay(Filters.getFilteredNodes(newNodes));

    // 增量更新表格
    Table.updateTableIncremental(desiredList);

    // 最後替換記憶中的 nodes
    nodes = newNodes;

    // 更新快取
    saveServerCache(nodes, globalMetrics);
  } catch (e) {
    console.warn("背景更新失敗", e);
  }
}


async function initialize() {
  Table.setTablePlaceholder(t('table.loading'));
  try {
    const [fetchedNodes, statusMetrics] = await Promise.all([
      fetchStaticNodes(),
      fetchGlobalMetrics(),
    ]);

    mergeGlobalMetrics(statusMetrics);

    nodes = Table.sortNodes(fetchedNodes.map(enrichNode));
    nodeLookup.clear();
    nodes.forEach((node) => {
      nodeLookup.set(String(node.sid), node);
    });

    UI.populateLocationFilter(nodes);
    UI.populateCountryFilter(nodes);
    Table.renderTable(nodes);
    UI.attachEventListeners();
    Table.setupSorting();
    // 套用使用者設定（首次線上載入情境）
    const savedFiltersOnInit = loadUserFilters();
    if (savedFiltersOnInit) {
      applyUserFiltersFromStorage(savedFiltersOnInit, {
        setLanguage,
        updateCountryToggleLabel: UI.updateCountryToggleLabel,
        locationFilter, searchInput, cpuMaxFilter, ioMaxFilter, nicMaxFilter, congestionMaxFilter,
        selectedCountryCodes,
        refreshCountryFilterUI: UI.refreshCountryFilterUI,
        setSortState: (s) => { sortState = s; }
      });
      Table.updateSortIndicators(document.querySelectorAll("#serverTable thead th[data-sort-key]"));
      Table.renderTable(Filters.getFilteredNodes());
    }

    //        
    saveServerCache(nodes, globalMetrics);

  } catch (error) {
    console.error("初始化失敗", error);
    Table.setTablePlaceholder(t('errors.loadFailed'));
  }
}



function mergeGlobalMetrics(metricsMap) {
  globalMetrics.clear();
  metricsMap.forEach((value, key) => {
    globalMetrics.set(String(key), value);
  });
}

// 依使用者 IP 自動推測語言（KR->ko, JP->ja, HK/TW/CN->zh, 其他->en）
async function detectLanguageByIP({ timeoutMs = 1500 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // 若網頁以 https 服務，避免混合內容，優先使用支援 https 的 ipapi；
    // 否則用 ip-api（免費方案多為 http）。
    let lang = null;
    if (location.protocol === 'https:') {
      const resp = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      if (resp.ok) {
        const j = await resp.json();
        const cc = String(j.country_code || '').toUpperCase();
        lang = mapCountryToLang(cc);
      }
    } else {
      const resp = await fetch('http://ip-api.com/json/?fields=status,countryCode', { signal: controller.signal });
      if (resp.ok) {
        const j = await resp.json();
        if (j.status === 'success') {
          const cc = String(j.countryCode || '').toUpperCase();
          lang = mapCountryToLang(cc);
        }
      }
    }
    return lang; // 可能為 null/undefined -> 交由呼叫者決定是否使用預設
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function mapCountryToLang(cc) {
  if (!cc) return null;
  if (cc === 'KR') return 'ko';
  if (cc === 'JP') return 'ja';
  if (cc === 'HK' || cc === 'TW' || cc === 'CN') return 'zh';
  return 'en';
}









function applyBestServerPreset() {
  const base = Filters.getFilteredNodes();
  const subset = base.filter((node) => {
    const m = globalMetrics.get(String(node.sid));
    if (!m) return false;
    const isZero = (v) => Number.isFinite(v) && v === 0;
    return isZero(m.cpuLoadValue) && isZero(m.ioWaitValue) && isZero(m.nicErrorValue) && isZero(m.congestionValue);
  });
  //






  sortState = { key: "network", direction: "asc" };
  const headers = document.querySelectorAll("#serverTable thead th[data-sort-key]");
  Table.updateSortIndicators(headers);
  Table.renderTable(subset);
  UI.hideHoverCard();
}










function createCountryOption(code, label, count) {
  const wrapper = document.createElement("label");
  wrapper.className = "country-filter__option";
  wrapper.tabIndex = 0;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = code;
  checkbox.className = "country-filter__checkbox";

  const text = document.createElement("span");
  text.className = "country-filter__label";
  text.textContent = label;

  const countBadge = document.createElement("span");
  countBadge.className = "country-filter__count";
  countBadge.textContent = String(count);

  wrapper.append(checkbox, text, countBadge);
  return { element: wrapper, input: checkbox };
}



function onTableRowClick(event) {
  const link = event.target.closest('.sid-link');
  if (!link) return; // 只有點 SID 欄位才作用
  event.preventDefault();
  window.open(link.href, "_blank", "noopener,noreferrer");
}































async function getServerDetailCached(sid) {
  if (detailCache.has(sid)) {
    return detailCache.get(sid);
  }
  if (pendingDetailRequests.has(sid)) {
    return pendingDetailRequests.get(sid);
  }

  const request = getServerDetailRaw(sid)
    .then((detail) => {
      detailCache.set(sid, detail);
      pendingDetailRequests.delete(sid);
      updateRowWithDetail(sid, detail);
      return detail;
    })
    .catch((error) => {
      pendingDetailRequests.delete(sid);
      throw error;
    });

  pendingDetailRequests.set(sid, request);
  return request;
}

function updateRowWithDetail(sid) {
  const row = tableBody.querySelector(`tr[data-sid="${sid}"]`);
  if (!row) {
    return;
  }
  const metrics = globalMetrics.get(String(sid)) ?? null;
  Table.applyRowSortDataset(row, metrics);
}

// Helpers for parsing list-based labels/values in server status panel


















function buildDetailRows(baseNode, detail) {
  const rows = [
    { label: t('hover.labels.ipv4'), value: baseNode.ip },
    { label: t('hover.labels.privateIp'), value: detail.privateIp || "—" },
    { label: t('hover.labels.uptime'), value: detail.uptime || "—" },
    { label: t('hover.labels.heartbeat'), value: detail.heartbeat || "—" },
  ];

  if (detail.pricePolicy?.length) {
    rows.push({ label: t('hover.labels.pricePolicy'), value: detail.pricePolicy.join("\n") });
  }

  const aggregated = globalMetrics.get(String(baseNode.sid));
  if (aggregated) {
    rows.push({ label: t('hover.labels.cpu'), value: aggregated.cpuLoadText ?? "—" });
    rows.push({ label: t('hover.labels.ioWait'), value: aggregated.ioWaitText ?? "—" });
    rows.push({ label: t('hover.labels.nicError'), value: aggregated.nicErrorText ?? "—" });
    rows.push({ label: t('hover.labels.network'), value: aggregated.networkText ?? "—" });
    rows.push({ label: t('hover.labels.congestion'), value: aggregated.congestionText ?? "—" });
  }

  const metrics = detail.metrics ?? {};
  [
    ["systemLoad", metrics.systemLoad],
    ["network", metrics.network],
    ["congestion", metrics.congestion],
  ].forEach(([key, metric]) => {
    if (!metric?.image) {
      return;
    }
    rows.push({
      label: METRIC_IMAGE_LABELS[key],
      value: { type: "image", src: metric.image, alt: METRIC_IMAGE_LABELS[key] },
    });
  });

  return rows;
}

function formatTime(date) {
  const locale =
    currentLang === 'en' ? 'en-US' :
    currentLang === 'ja' ? 'ja-JP' :
    currentLang === 'ko' ? 'ko-KR' : 'zh-TW';
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function splitLocationParts(fullLocation) {
  const text = fullLocation || "";
  const m = text.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (m) {
    return { region: m[1].trim(), provider: m[2].trim() };
  }
  return { region: text.trim(), provider: "" };
}

function deriveProviderBrand(provider) {
  const raw = (provider || "").trim();
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (s.includes("google")) return "Google";
  if (s.includes("amazon") || s.includes("aws")) return "Amazon";
  if (s.includes("azure") || s.includes("microsoft")) return "Azure";
  if (s.includes("lightnode")) return "LightNode";
  if (s.includes("linode")) return "Linode";
  if (s.includes("digitalocean") || /\bdo\b/.test(s)) return "DigitalOcean";
  if (s.includes("vultr")) return "Vultr";
  // fallback: 取最後一段並去除數字尾碼（如 "Google 4" -> "Google"）
  const parts = raw.split("-");
  const last = parts[parts.length - 1].trim();
  return last.replace(/\s+\d+$/, "");
}

function enrichNode(node) {
  const { region, provider } = splitLocationParts(node.location);
  const providerBrand = deriveProviderBrand(provider);
  return {
    ...node,
    locationRegion: region,
    provider,
    providerBrand,
    countryCode: deriveCountryCode({ ...node, location: region }),
  };
}

function deriveCountryCode(node) {
  const hostMatch = node.hostname?.match(/^node-([a-z]{2})-/i);
  if (hostMatch) {
    return hostMatch[1].toUpperCase();
  }
  const locationMatch = node.location?.match(/^([A-Z]{2})\s/);
  if (locationMatch) {
    return locationMatch[1].toUpperCase();
  }
  return "??";
}





function getGlobalMetricSortValue(sid, key) {
  const metrics = globalMetrics.get(String(sid));
  if (!metrics) {
    return Number.MAX_SAFE_INTEGER;
  }
  switch (key) {
    case "cpuLoad":
      return Number.isFinite(metrics.cpuLoadValue) ? metrics.cpuLoadValue : Number.MAX_SAFE_INTEGER;
    case "ioWait":
      return Number.isFinite(metrics.ioWaitValue) ? metrics.ioWaitValue : Number.MAX_SAFE_INTEGER;
    case "nicError":
      return Number.isFinite(metrics.nicErrorValue) ? metrics.nicErrorValue : Number.MAX_SAFE_INTEGER;
    case "network":
      return Number.isFinite(metrics.networkValue) ? metrics.networkValue : Number.MAX_SAFE_INTEGER;
    case "congestion":
      return Number.isFinite(metrics.congestionValue) ? metrics.congestionValue : Number.MAX_SAFE_INTEGER;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}









