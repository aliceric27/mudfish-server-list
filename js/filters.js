// filters.js - 資料過濾模組（依賴注入，避免循環相依）

let deps = {
  // 狀態與資料
  globalMetrics: null,           // Map<sid, metrics>
  selectedCountryCodes: null,    // Set<string>

  // DOM 來源（暫時，Step 7 會轉移到 ui.js）
  locationFilter: null,
  searchInput: null,
  cpuMaxFilter: null,
  ioMaxFilter: null,
  nicMaxFilter: null,
  congestionMaxFilter: null,

  // 其他依賴
  getNodes: null,                 // () => nodes array（可選）
  renderTable: null,              // (list) => void
  hideHoverCard: null,            // () => void
  saveUserFilters: null,          // (snapshot) => void
  buildFiltersSnapshot: null,     // () => object
  refreshCountryFilterUI: null,   // () => void
  toggleCountryPanel: null,       // (open:boolean) => void
  setSortState: null,             // (state) => void
  updateSortIndicators: null,     // (headers:NodeListOf<Element>) => void
  getHeaderEls: null,             // () => NodeListOf<Element>
};

export function initFilters(initDeps) {
  deps = { ...deps, ...initDeps };
}

function parseNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

function getCurrentValues() {
  const locationValue = deps.locationFilter?.value ?? 'all';
  const keyword = (deps.searchInput?.value ?? '').trim().toLowerCase();
  const cpuMax = parseNum(deps.cpuMaxFilter?.value ?? '');
  const ioMax = parseNum(deps.ioMaxFilter?.value ?? '');
  const nicMax = parseNum(deps.nicMaxFilter?.value ?? '');
  const congestionMax = parseNum(deps.congestionMaxFilter?.value ?? '');
  return { locationValue, keyword, cpuMax, ioMax, nicMax, congestionMax };
}

export function getFilteredNodes(list) {
  const base = Array.isArray(list) ? list : (deps.getNodes ? (deps.getNodes() || []) : []);
  const { locationValue, keyword, cpuMax, ioMax, nicMax, congestionMax } = getCurrentValues();
  const cpuActive = Number.isFinite(cpuMax);
  const ioActive = Number.isFinite(ioMax);
  const nicActive = Number.isFinite(nicMax);
  const congestionActive = Number.isFinite(congestionMax);
  const globalMetrics = deps.globalMetrics;
  const selected = deps.selectedCountryCodes;

  return base.filter((node) => {
    // 供應商品牌
    const region = node.locationRegion || node.location;
    const providerBrand = node.providerBrand || '';
    if (!(locationValue === 'all' || providerBrand === locationValue)) {
      return false;
    }

    // 國家
    if (!(selected?.size === 0 || selected?.has(node.countryCode))) {
      return false;
    }

    // 系統負載上限
    if (cpuActive || ioActive || nicActive || congestionActive) {
      const m = globalMetrics?.get(String(node.sid));
      if (!m) return false;
      if (cpuActive && !(Number.isFinite(m.cpuLoadValue) && m.cpuLoadValue <= cpuMax)) return false;
      if (ioActive && !(Number.isFinite(m.ioWaitValue) && m.ioWaitValue <= ioMax)) return false;
      if (nicActive && !(Number.isFinite(m.nicErrorValue) && m.nicErrorValue <= nicMax)) return false;
      if (congestionActive && !(Number.isFinite(m.congestionValue) && m.congestionValue <= congestionMax)) return false;
    }

    // 關鍵字（主機名 / IP / Region / Provider / Brand）
    if (keyword) {
      const haystack = `${node.hostname} ${node.ip} ${region} ${node.provider || ''} ${node.providerBrand || ''}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });
}

export function applyFilters() {
  const filtered = getFilteredNodes();
  deps.renderTable?.(filtered);
  deps.hideHoverCard?.();
  const snap = deps.buildFiltersSnapshot?.();
  if (snap) deps.saveUserFilters?.(snap);
}

export function resetFilters() {
  // 清空所有輸入與選擇
  if (deps.locationFilter) deps.locationFilter.value = 'all';
  if (deps.searchInput) deps.searchInput.value = '';
  if (deps.cpuMaxFilter) deps.cpuMaxFilter.value = '';
  if (deps.ioMaxFilter) deps.ioMaxFilter.value = '';
  if (deps.nicMaxFilter) deps.nicMaxFilter.value = '';
  if (deps.congestionMaxFilter) deps.congestionMaxFilter.value = '';

  // 重置國家前綴並關閉面板
  deps.selectedCountryCodes?.clear?.();
  deps.refreshCountryFilterUI?.();
  deps.toggleCountryPanel?.(false);

  // 恢復預設排序（以位置升序）並更新指示
  deps.setSortState?.({ key: 'region', direction: 'asc' });
  const headers = deps.getHeaderEls?.();
  if (headers) deps.updateSortIndicators?.(headers);

  // 重新渲染並儲存
  deps.renderTable?.(getFilteredNodes());
  deps.hideHoverCard?.();
  const snap = deps.buildFiltersSnapshot?.();
  if (snap) deps.saveUserFilters?.(snap);
}
