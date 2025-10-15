// TODO: 刪除app.js 沒用到的函數、修復Hover 圖片不會顯示問題

import {
  tableBody,
  locationFilter,
  searchInput,
  countryFilterContainer,
  countryToggle,
  cpuMaxFilter,
  ioMaxFilter,
  nicMaxFilter,
  congestionMaxFilter,
  bestServerBtn,
  resetFiltersBtn,
  downloadSocks5Btn,
  langSelect,
} from './config.js';

import { t, setLanguage, applyI18nStatic, currentLang } from './i18n.js';

import { loadServerCache, saveServerCache, loadUserFilters, saveUserFilters, applyUserFiltersFromStorage } from './storage.js';

import { fetchStaticNodes, fetchGlobalMetrics } from './api.js';
import * as Table from './table.js';
import * as Filters from './filters.js';
import * as UI from './ui.js';
import { downloadClashSocks5Config } from './socks5.js';
import { showSocks5Modal, showConfirmModal, showMessageModal, updateModalI18n } from './modal.js';

let nodes = [];
const nodeLookup = new Map();
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

// METRIC_LABELS are defined via i18n and setLanguage()

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
    onSortChanged: () => {
      const list = Filters.getFilteredNodes();
      Table.renderTable(list);
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
    langSelect,
    locationFilter,
    searchInput,
    cpuMaxFilter,
    ioMaxFilter,
    nicMaxFilter,
    congestionMaxFilter,
    bestServerBtn,
    resetFiltersBtn,
    downloadSocks5Btn,
    selectedCountryCodes,
    t,
    setLanguage,
    onAfterLanguageChange: () => {
      UI.updateCountryToggleLabel();
      UI.updateCountryFilterLabels();
      updateModalI18n(); // 更新 Modal 的多語言文字
      const list = Filters.getFilteredNodes();
      Table.renderTable(list);
      saveUserFilters(buildFiltersSnapshot());
    },
    onFiltersChange: () => Filters.applyFilters(),
    onResetFilters: () => Filters.resetFilters(),
    onTableRowClick,
    renderTable: Table.renderTable,
    onBestServerPreset: applyBestServerPreset,
    onDownloadSocks5: handleDownloadSocks5Config,
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
          updateCountryFilterLabels: UI.updateCountryFilterLabels,
          locationFilter, searchInput, cpuMaxFilter, ioMaxFilter, nicMaxFilter, congestionMaxFilter,
          selectedCountryCodes,
          refreshCountryFilterUI: UI.refreshCountryFilterUI,
          setSortState: (s) => { sortState = s; }
        });
        Table.updateSortIndicators(document.querySelectorAll("#serverTable thead th[data-sort-key]"));
        const list = Filters.getFilteredNodes();
        Table.renderTable(list);
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
        updateCountryFilterLabels: UI.updateCountryFilterLabels,
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
}

async function handleDownloadSocks5Config() {
  const filteredNodes = Filters.getFilteredNodes();
  
  if (filteredNodes.length === 0) {
    await showMessageModal({
      title: t('socks5Modal.messageTitle'),
      message: t('errors.noNodesFiltered'),
      type: 'error'
    });
    return;
  }

  // 詢問使用者是否要自訂帳號密碼
  const confirmMessage = t('socks5Modal.confirmMessage', filteredNodes.length) || 
    `即將下載 ${filteredNodes.length} 個節點的 Socks5 設定檔。\n\n是否要填入帳號密碼？\n（選擇「取消」將不包含帳號密碼欄位）`;
  
  const wantCustomize = await showConfirmModal({
    title: t('socks5Modal.messageTitle'),
    message: confirmMessage
  });

  // 使用者點擊 X 或 ESC 取消操作
  if (wantCustomize === null) {
    console.log('使用者取消下載操作');
    return;
  }

  let credentials = {
    username: '',
    password: '',
    port: 18081
  };

  if (wantCustomize) {
    // 顯示 Modal 讓使用者輸入
    const userInput = await showSocks5Modal({
      username: '',
      password: '',
      port: 18081
    });
    
    if (!userInput) {
      // 使用者在 Modal 中取消
      console.log('使用者取消下載');
      return;
    }
    
    credentials = userInput;
  }
  // 如果 wantCustomize === false，使用空憑證（直接下載無驗證模式）

  // 執行下載
  try {
    const success = downloadClashSocks5Config(filteredNodes, credentials);

    if (success) {
      // 與 socks5.js 的 needsAuth 判斷保持一致（去除空白並確保為字串）
      const userStr = (credentials.username ?? '').toString().trim();
      const passStr = (credentials.password ?? '').toString().trim();
      const hasAuth = userStr.length > 0 && passStr.length > 0;
      console.log(`已產生 ${filteredNodes.length} 個節點的 Socks5 設定檔`);
      if (hasAuth) console.log('使用的帳號:', userStr); else console.log('模式: 無需驗證（未包含帳號密碼）');

      // 顯示成功訊息
      await showMessageModal({
        title: t('socks5Modal.messageTitle'),
  message: t('socks5Modal.downloadSuccess', filteredNodes.length),
        type: 'success'
      });
    }
  } catch (error) {
    // 顯示錯誤訊息
    await showMessageModal({
      title: t('socks5Modal.messageTitle'),
      message: t('socks5Modal.downloadError', error.message || error),
      type: 'error'
    });
  }
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
  const locationSource = node.locationRegion || node.location || "";
  // 優先依據位置欄位前綴辨識，hostname 有時候會保留舊代碼（例如 US→HK）
  const locationMatch = locationSource.match(/^([A-Z]{2})(?:\s|$)/i);
  if (locationMatch) {
    return locationMatch[1].toUpperCase();
  }
  const hostMatch = node.hostname?.match(/^node-([a-z]{2})-/i);
  if (hostMatch) {
    return hostMatch[1].toUpperCase();
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
