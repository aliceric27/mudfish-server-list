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









function __removed_applyI18nStatic_DO_NOT_USE() {
  // Title/subtitle
  const titleEl = document.querySelector('.page__title');
  if (titleEl) titleEl.textContent = t('title');
  const subEl = document.querySelector('.page__subtitle');
  if (subEl) subEl.textContent = t('subtitle');

  // Provider filter
  const provLabel = document.querySelector('label[for="locationFilter"]');
  if (provLabel) provLabel.textContent = t('provider.filterLabel');
  const allOpt = locationFilter?.querySelector('option[value="all"]');
  if (allOpt) allOpt.textContent = t('provider.all');

  // Language selector label + aria
  const langLabelEl = document.querySelector('label[for="langSelect"]');
  if (langLabelEl) langLabelEl.textContent = t('langLabel');
  if (langSelect) langSelect.setAttribute('aria-label', t('langLabel'));

  // Search
  const searchLabel = document.querySelector('label[for="searchInput"]');
  if (searchLabel) searchLabel.textContent = t('search.label');
  if (searchInput) {
    searchInput.placeholder = t('search.placeholder');
    searchInput.setAttribute('aria-label', t('search.aria'));
  }

  // Country toggle label
  UI.updateCountryToggleLabel();

  // Load section + labels
  const loadLabel = document.querySelector('.controls__group--load .controls__label');
  if (loadLabel) loadLabel.textContent = t('load.section');
  const cpuL = document.querySelector('label[for="cpuMaxFilter"]');
  if (cpuL) cpuL.childNodes[0].textContent = `${t('load.cpu')} ≤\n            `;
  const ioL = document.querySelector('label[for="ioMaxFilter"]');
  if (ioL) ioL.childNodes[0].textContent = `${t('load.io')} ≤\n            `;
  const nicL = document.querySelector('label[for="nicMaxFilter"]');
  if (nicL) nicL.childNodes[0].textContent = `${t('load.nic')} ≤\n            `;
  const congL = document.querySelector('label[for="congestionMaxFilter"]');
  if (congL) congL.childNodes[0].textContent = `${t('load.congestion')} ≤\n            `;
  document.querySelectorAll('.load-filter__input').forEach(inp => inp.setAttribute('placeholder', t('load.any')));
  const loadGroup = document.querySelector('.load-filter');
  if (loadGroup) loadGroup.setAttribute('aria-label', t('load.aria'));

  // Buttons
  if (bestServerBtn) bestServerBtn.textContent = t('buttons.best');
  if (resetFiltersBtn) resetFiltersBtn.textContent = t('buttons.reset');

  // Table headers
  const headerMap = {
    region: t('table.headers.region'),
    provider: t('table.headers.provider'),
    ip: t('table.headers.ip'),
    sid: t('table.headers.sid'),
    cpuLoad: t('table.headers.cpu'),
    ioWait: t('table.headers.ioWait'),
    nicError: t('table.headers.nicError'),
    network: t('table.headers.network'),
    congestion: t('table.headers.congestion'),
  };
  document.querySelectorAll('#serverTable thead th[data-sort-key]').forEach(th => {
    const key = th.getAttribute('data-sort-key');
    if (headerMap[key]) th.textContent = headerMap[key];
  });
}


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

function attachEventListeners() {
  locationFilter.addEventListener("change", Filters.applyFilters);
  searchInput.addEventListener("input", Filters.applyFilters);
  cpuMaxFilter.addEventListener("input", Filters.applyFilters);
  ioMaxFilter.addEventListener("input", Filters.applyFilters);
  nicMaxFilter.addEventListener("input", Filters.applyFilters);
  congestionMaxFilter.addEventListener("input", Filters.applyFilters);
  bestServerBtn.addEventListener("click", applyBestServerPreset);
  resetFiltersBtn.addEventListener("click", Filters.resetFilters);

  // 語言切換
  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      setLanguage(e.target.value);
      updateCountryToggleLabel();
      saveUserFilters(buildFiltersSnapshot());
      // 語言切換後，重新渲染目前的列表（僅更新標題與表頭，資料無需重取）
      Table.renderTable(Filters.getFilteredNodes());
    });
  }

  // 表格列點擊：跳轉到該節點的管理頁
  tableBody.addEventListener("click", onTableRowClick);

  countryToggle.addEventListener("click", () => toggleCountryPanel());
  countryToggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCountryPanel();
    }
  });

  tableBody.addEventListener("pointerover", (event) => {
    const row = event.target.closest("tr[data-sid]");
    if (!row) {
      if (activeRow) {
        hideHoverCard();
      }
      return;
    }
    if (activeRow !== row) {
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      showHoverForRow(row, lastPointerPosition);
    }
  });

  tableBody.addEventListener("pointermove", (event) => {
    if (!activeRow) {
      return;
    }
    lastPointerPosition = { x: event.clientX, y: event.clientY };
    positionHoverCard(lastPointerPosition);
  });

  tableBody.addEventListener("pointerout", (event) => {
    const relatedRow = event.relatedTarget?.closest?.("tr[data-sid]");
    if (!relatedRow) {
      hideHoverCard();
    }
  });

  tableBody.addEventListener("focusin", (event) => {
    const row = event.target.closest("tr[data-sid]");
    if (row) {
      showHoverForRow(row, getRowViewportCenter(row));
    }
  });

  tableBody.addEventListener("focusout", (event) => {
    if (!tableBody.contains(event.relatedTarget)) {
      hideHoverCard();
    }
  });

  window.addEventListener("scroll", () => {
    if (activeRow) {
      positionHoverCard(getRowViewportCenter(activeRow));
    }
  });
  window.addEventListener("resize", () => {
    if (activeRow) {
      positionHoverCard(getRowViewportCenter(activeRow));
    }
  });
}


function setupSorting() {
  const headers = document.querySelectorAll("#serverTable thead th[data-sort-key]");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) {
        return;
      }
      if (sortState.key === key) {
        sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
      } else {
        sortState = { key, direction: "asc" };
      }
      Table.updateSortIndicators(headers);
      Table.renderTable(Filters.getFilteredNodes());
      saveUserFilters(buildFiltersSnapshot());
    });
  });
  Table.updateSortIndicators(headers);
}

function updateSortIndicators(headers) {
  headers.forEach((th) => {
    th.classList.remove("is-asc", "is-desc");
    if (th.dataset.sortKey === sortState.key) {
      th.classList.add(sortState.direction === "asc" ? "is-asc" : "is-desc");
    }
  });
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




function getFilteredNodes(list = nodes) {

  const locationValue = locationFilter.value;
  const keyword = searchInput.value.trim().toLowerCase();
  const cpuMax = parseFloat(cpuMaxFilter.value);
  const ioMax = parseFloat(ioMaxFilter.value);
  const nicMax = parseFloat(nicMaxFilter.value);
  const congestionMax = parseFloat(congestionMaxFilter.value);
  const cpuActive = Number.isFinite(cpuMax);
  const ioActive = Number.isFinite(ioMax);
  const nicActive = Number.isFinite(nicMax);
  const congestionActive = Number.isFinite(congestionMax);

  return list.filter((node) => {
    // 供應商篩選
    const region = node.locationRegion || node.location;
    const providerBrand = node.providerBrand || "";
    if (!(locationValue === "all" || providerBrand === locationValue)) {
      return false;
    }

    // 國家
    if (!(selectedCountryCodes.size === 0 || selectedCountryCodes.has(node.countryCode))) {
      return false;
    }

    // 系統負載（CPU / IO / NIC 錯誤）上限篩選
    if (cpuActive || ioActive || nicActive || congestionActive) {
      const m = globalMetrics.get(String(node.sid));
      if (!m) {
        return false;
      }
      if (cpuActive && !(Number.isFinite(m.cpuLoadValue) && m.cpuLoadValue <= cpuMax)) {
        return false;

      }
      if (ioActive && !(Number.isFinite(m.ioWaitValue) && m.ioWaitValue <= ioMax)) {
        return false;
      }
      if (nicActive && !(Number.isFinite(m.nicErrorValue) && m.nicErrorValue <= nicMax)) {
        return false;
      }
      if (congestionActive && !(Number.isFinite(m.congestionValue) && m.congestionValue <= congestionMax)) {
        return false;
      }
      }

    // 關鍵字（主機名 / IP / Region / Provider）
    if (keyword) {
      const haystack = `${node.hostname} ${node.ip} ${region} ${node.provider || ""} ${node.providerBrand || ""}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

function populateLocationFilter(nodeList) {
  // 供應商品牌選項（排除空字串），依字母排序
  const providers = Array.from(new Set(nodeList.map((node) => node.providerBrand).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const fragment = document.createDocumentFragment();
  providers.forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    fragment.appendChild(option);
  });
  locationFilter.appendChild(fragment);
}

function populateCountryFilter(nodeList) {
  countryFilterContainer.innerHTML = "";
  countryCheckboxes.clear();

  const counts = new Map();
  nodeList.forEach((node) => {
    const code = node.countryCode;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "en"));
  const fragment = document.createDocumentFragment();

  const allOption = createCountryOption("__all__", "全部", nodeList.length);
  fragment.appendChild(allOption.element);
  countryCheckboxes.set("__all__", allOption.input);
  allOption.input.addEventListener("change", () => {
    selectedCountryCodes.clear();
    refreshCountryFilterUI();
    Table.renderTable(Filters.getFilteredNodes());
    saveUserFilters(buildFiltersSnapshot());
  });

//            :       
function updateRowContent(row, node) {
  row.dataset.sid = String(node.sid);
  row.dataset.location = node.locationRegion || node.location;
  row.dataset.hostname = node.hostname;
  row.dataset.country = node.countryCode;
  row.dataset.provider = node.provider || "";

  const region = node.locationRegion || node.location;
  const provider = node.provider || "—";
  const regionSpan = row.querySelector('.region-cell .truncate-15ch');
  if (regionSpan) {
    regionSpan.textContent = region;
    regionSpan.title = region;
  }
  const tds = row.children;
  if (tds[1]) tds[1].textContent = provider;
  if (tds[2]) tds[2].textContent = node.ip;

  const metrics = globalMetrics.get(String(node.sid)) ?? null;
  if (tds[4]) tds[4].innerHTML = renderMetricValue(metrics?.cpuLoadText, "cpuLoad");
  if (tds[5]) tds[5].innerHTML = renderMetricValue(metrics?.ioWaitText, "ioWait");
  if (tds[6]) tds[6].innerHTML = renderMetricValue(metrics?.nicErrorText, "nicError");
  if (tds[7]) tds[7].innerHTML = renderMetricValue(metrics?.networkText, "network");
  if (tds[8]) tds[8].innerHTML = renderMetricValue(metrics?.congestionText, "congestion");

  applyRowSortDataset(row, metrics);
}

function updateTableIncremental(desiredList) {
  //          
  const desiredIndex = new Map(desiredList.map((n, i) => [String(n.sid), i]));

  //      
  Array.from(tableBody.querySelectorAll('tr[data-sid]')).forEach((row) => {
    const sid = row.dataset.sid;
    if (!desiredIndex.has(sid)) {
      tableBody.removeChild(row);
    }
  });

  //          
  desiredList.forEach((node, index) => {
    const sid = String(node.sid);
    let row = tableBody.querySelector(`tr[data-sid="${sid}"]`);
    const ref = tableBody.children[index] || null;

    if (!row) {
      row = createRow(node);
      tableBody.insertBefore(row, ref);
      observeRow(row);
    } else {
      if (row !== ref) {
        tableBody.insertBefore(row, ref);
      }
      updateRowContent(row, node);
    }
  });
}



  sorted.forEach(([code, count]) => {
    const option = createCountryOption(code, code, count);
    fragment.appendChild(option.element);
    countryCheckboxes.set(code, option.input);
    option.input.addEventListener("change", () => {
      if (option.input.checked) {
        selectedCountryCodes.add(code);
      } else {
        selectedCountryCodes.delete(code);
      }
      refreshCountryFilterUI();
      Table.renderTable(Filters.getFilteredNodes());
      saveUserFilters(buildFiltersSnapshot());
    });
  });

  countryFilterContainer.appendChild(fragment);
  refreshCountryFilterUI();
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

function refreshCountryFilterUI() {
  countryCheckboxes.forEach((input, code) => {
    if (code === "__all__") {
      input.checked = selectedCountryCodes.size === 0;
    } else {
      input.checked = selectedCountryCodes.has(code);
    }
  });
  updateCountryToggleLabel();
}

function onTableRowClick(event) {
  const link = event.target.closest('.sid-link');
  if (!link) return; // 只有點 SID 欄位才作用
  event.preventDefault();
  window.open(link.href, "_blank", "noopener,noreferrer");
}

function updateCountryToggleLabel() {
  const count = selectedCountryCodes.size;
  const label = count === 0 ? t('country.all') : t('country.selected', { count });
  countryToggle.textContent = label;
  countryToggle.setAttribute("aria-expanded", String(isCountryPanelOpen));
}

function renderTable(data) {
  tableBody.innerHTML = "";
  if (!data.length) {
    clearRowObserver();
    Table.setTablePlaceholder(t('table.empty'));
    return;
  }

  const sorted = Table.sortForDisplay(data);
  clearRowObserver();
  const fragment = document.createDocumentFragment();
  const rowsToObserve = [];

  sorted.forEach((node) => {
    const row = createRow(node);
    fragment.appendChild(row);
    rowsToObserve.push(row);
  });

  tableBody.appendChild(fragment);
  rowsToObserve.forEach((row) => observeRow(row));
}

function createRow(node) {
  const row = document.createElement("tr");
  row.dataset.sid = String(node.sid);
  row.dataset.location = node.locationRegion || node.location;
  row.dataset.hostname = node.hostname;
  row.dataset.country = node.countryCode;
  row.dataset.provider = node.provider || "";
  row.tabIndex = 0;

  const metrics = globalMetrics.get(String(node.sid)) ?? null;
  const region = node.locationRegion || node.location;
  const provider = node.provider || "—";
  row.innerHTML = `
    <td class="region-cell"><span class="truncate-15ch"></span></td>
    <td>${provider}</td>
    <td>${node.ip}</td>
    <td class="sid-cell"><a class="sid-link" href="https://mudfish.net/admin/serverstatus/${node.sid}" target="_blank" rel="noopener noreferrer">${node.sid}</a></td>
    <td class="metric-cell" data-metric="cpuLoad">${renderMetricValue(metrics?.cpuLoadText, "cpuLoad")}</td>
    <td class="metric-cell" data-metric="ioWait">${renderMetricValue(metrics?.ioWaitText, "ioWait")}</td>
    <td class="metric-cell" data-metric="nicError">${renderMetricValue(metrics?.nicErrorText, "nicError")}</td>
    <td class="metric-cell" data-metric="network">${renderMetricValue(metrics?.networkText, "network")}</td>
    <td class="metric-cell" data-metric="congestion">${renderMetricValue(metrics?.congestionText, "congestion")}</td>
  `;

  // 設定位置欄位顯示與 tooltip（不影響排序/篩選）
  const regionSpan = row.querySelector('.region-cell .truncate-15ch');
  if (regionSpan) {
    regionSpan.textContent = region;
    regionSpan.title = region;
  }

  applyRowSortDataset(row, metrics);
  return row;
}

function renderMetricValue(value, key) {
  if (value === null || value === undefined) {
    return '<span class="metric-cell__placeholder">—</span>';
  }
  const raw = String(value).trim();
  if (!raw || raw === '—') {
    return '<span class="metric-cell__placeholder">—</span>';
  }
  const needsUnit = key === 'network' && /^[\d.]+$/.test(raw);
  const text = needsUnit ? `${raw} MB` : raw;
  return `<span class="metric-value metric-value--${key}">${text}</span>`;
}


function applyRowSortDataset(row, metrics) {
  row.dataset.sortCpuLoad = metrics && Number.isFinite(metrics.cpuLoadValue)
    ? String(metrics.cpuLoadValue)
    : String(Number.MAX_SAFE_INTEGER);
  row.dataset.sortIoWait = metrics && Number.isFinite(metrics.ioWaitValue)
    ? String(metrics.ioWaitValue)
    : String(Number.MAX_SAFE_INTEGER);
  row.dataset.sortNicError = metrics && Number.isFinite(metrics.nicErrorValue)
    ? String(metrics.nicErrorValue)
    : String(Number.MAX_SAFE_INTEGER);
  row.dataset.sortNetwork = metrics && Number.isFinite(metrics.networkValue)
    ? String(metrics.networkValue)
    : String(Number.MAX_SAFE_INTEGER);
  row.dataset.sortCongestion = metrics && Number.isFinite(metrics.congestionValue)
    ? String(metrics.congestionValue)
    : String(Number.MAX_SAFE_INTEGER);
}


function setTablePlaceholder(message) {
  tableBody.innerHTML = `
    <tr>
      <td colspan="9" class="status-table__placeholder">${message}</td>
    </tr>
  `;
}

function sortNodes(list) {
  return [...list].sort((a, b) => {
    const locA = a.locationRegion || a.location || "";
    const locB = b.locationRegion || b.location || "";
    const locationCompare = locA.localeCompare(locB, "zh-Hant");
    if (locationCompare !== 0) {
      return locationCompare;
    }
    return a.hostname.localeCompare(b.hostname, "zh-Hant");
  });
}

function sortForDisplay(list) {
  const extractor = SORTERS[sortState.key] ?? SORTERS.region;
  const sorted = [...list].sort((a, b) => {
    const valueA = extractor(a);
    const valueB = extractor(b);
    return compareValues(valueA, valueB);
  });
  if (sortState.direction === "desc") {
    sorted.reverse();
  }
  return sorted;
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, "zh-Hant", { sensitivity: "base" });
  }
  return String(a).localeCompare(String(b));
}

async function showHoverForRow(row, position) {
  const sid = row.dataset.sid;
  if (!sid) {
    return;
  }
  activeRow = row;

  const baseNode = nodeLookup.get(sid);
  if (!baseNode) {
    return;
  }

  hoverCard.hidden = false;
  updateHoverCardContent({
    title: baseNode.hostname,
    subtitle: baseNode.location,
    details: [
      { label: t('hover.labels.ipv4'), value: baseNode.ip },
      { label: t('hover.labels.sid'), value: String(baseNode.sid) },
      { label: t('hover.labels.status'), value: t('hover.fetching') },
    ],
    footer: t('hover.firstLoadHint'),
  });

  const anchor = position ?? lastPointerPosition ?? getRowViewportCenter(row);
  positionHoverCard(anchor);

  try {
    const detail = await getServerDetailCached(sid);
    if (activeRow !== row) {
      return;
    }
    const detailRows = buildDetailRows(baseNode, detail);
    const footerText = detail.fetchedAt
      ? `${t('hover.fetchTimePrefix')}${formatTime(detail.fetchedAt)}`
      : t('hover.liveSource');

    updateHoverCardContent({
      title: baseNode.hostname,
      subtitle: baseNode.location,
      details: detailRows,
      footer: footerText,
    });
    const updatedAnchor = lastPointerPosition ?? anchor ?? getRowViewportCenter(row);
    positionHoverCard(updatedAnchor);
  } catch (error) {
    if (activeRow !== row) {
      return;
    }
    console.error(`載入節點 ${sid} 詳細資料失敗`, error);
    updateHoverCardContent({
      title: baseNode.hostname,
      subtitle: baseNode.location,
      details: [
        { label: t('hover.labels.ipv4'), value: baseNode.ip },
        { label: t('hover.labels.sid'), value: String(baseNode.sid) },
        { label: t('hover.labels.status'), value: t('hover.fetchFailed') },
      ],
      footer: t('hover.retryLater'),
    });
    const fallbackAnchor = lastPointerPosition ?? anchor ?? getRowViewportCenter(row);
    positionHoverCard(fallbackAnchor);
  }
}

function hideHoverCard() {
  activeRow = null;
  hoverCard.hidden = true;
}

function positionHoverCard(position) {
  if (!position) {
    return;
  }
  const offset = 18;
  const viewportPadding = 12;
  const rect = hoverCard.getBoundingClientRect();
  let left = position.x + offset;
  let top = position.y + offset;

  if (left + rect.width + viewportPadding > window.innerWidth) {
    left = position.x - rect.width - offset;
  }
  if (left < viewportPadding) {
    left = viewportPadding;
  }

  if (top + rect.height + viewportPadding > window.innerHeight) {
    top = position.y - rect.height - offset;
  }
  if (top < viewportPadding) {
    top = viewportPadding;
  }

  hoverCard.style.left = `${Math.round(left)}px`;
  hoverCard.style.top = `${Math.round(top)}px`;
}

function getRowViewportCenter(row) {
  const rect = row.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function updateHoverCardContent({ title, subtitle, details, footer }) {
  const fragment = hoverCardTemplate.content.cloneNode(true);
  const titleEl = fragment.querySelector(".hover-card__title");
  const subtitleEl = fragment.querySelector(".hover-card__subtitle");
  const detailsEl = fragment.querySelector(".hover-card__details");
  const footerEl = fragment.querySelector(".hover-card__footer");

  titleEl.textContent = title ?? "";
  subtitleEl.textContent = subtitle ?? "";

  detailsEl.innerHTML = "";
  if (Array.isArray(details) && details.length) {
    details.forEach((entry) => {
      const item = Array.isArray(entry)
        ? { label: entry[0], value: entry[1] }
        : entry;
      if (!item) {
        return;
      }
      const dt = document.createElement("dt");
      dt.textContent = item.label ?? "";
      const dd = document.createElement("dd");
      appendDetailValue(dd, item.value);
      detailsEl.appendChild(dt);
      detailsEl.appendChild(dd);
    });
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "hover-card__placeholder";
    placeholder.textContent = t('hover.noDetails');
    detailsEl.appendChild(placeholder);
  }

  footerEl.textContent = footer ?? "";

  hoverCard.innerHTML = "";
  hoverCard.appendChild(fragment);
}

function appendDetailValue(container, value) {
  if (value && typeof value === "object" && value.type === "image") {
    const img = document.createElement("img");
    img.src = value.src;
    img.alt = value.alt ?? value.label ?? t('hover.chartAlt');
    img.loading = "lazy";
    container.appendChild(img);
    if (value.caption) {
      const caption = document.createElement("div");
      caption.textContent = value.caption;
      container.appendChild(caption);
    }
    return;
  }
  if (Array.isArray(value)) {
    container.textContent = formatDetailValue(value.join("\n"));
    return;
  }
  container.textContent = formatDetailValue(value);
}

function formatDetailValue(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "—";
  }
  return String(value);
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



function ensureRowObserver() {
  if (!rowObserver) {
    rowObserver = new IntersectionObserver(handleRowIntersection, {
      root: null,
      threshold: 0.2,
    });
  }
}

function observeRow(row) {
  if (!row) {
    return;
  }
  ensureRowObserver();
  rowObserver.observe(row);
}

function clearRowObserver() {
  if (rowObserver) {
    rowObserver.disconnect();
  }
}

function handleRowIntersection(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) {
      return;
    }
    const row = entry.target;
    const sid = row.dataset.sid;
    if (!sid) {
      return;
    }
    rowObserver.unobserve(row);
    getServerDetailCached(sid).catch(() => {
      /* 詳細資料抓取失敗時在 getServerDetail 已處理錯誤 */
    });
  });
}



