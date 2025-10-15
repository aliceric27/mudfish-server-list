// storage.js - 本地儲存模組
// 職責：
// - 提供 localStorage 安全包裝（safeGetLS/safeSetLS）
// - 伺服器資料快取（loadServerCache/saveServerCache）
// - 使用者篩選設定存取（loadUserFilters/saveUserFilters）
// - 從儲存套用使用者設定（applyUserFiltersFromStorage）
//   為避免循環依賴，applyUserFiltersFromStorage 透過 deps 參數接收外部所需的 DOM/狀態/函式。

import { LS_CACHE_KEY, LS_FILTERS_KEY } from './config.js';

// 安全讀取 localStorage
export function safeGetLS(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('讀取 localStorage 失敗', key, e);
    return null;
  }
}

// 安全寫入 localStorage
export function safeSetLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('寫入 localStorage 失敗', key, e);
  }
}

// 載入伺服器資料快取
export function loadServerCache() {
  const data = safeGetLS(LS_CACHE_KEY);
  if (!data || !Array.isArray(data.nodes) || !data.metrics) return null;
  return data;
}

// 儲存伺服器資料快取（metricsMap 可為 Map 或 Plain Object）
export function saveServerCache(nodesList, metricsMap) {
  let metricsObj;
  if (metricsMap instanceof Map) {
    metricsObj = Object.fromEntries(metricsMap.entries());
  } else if (metricsMap && typeof metricsMap === 'object') {
    metricsObj = metricsMap;
  } else {
    metricsObj = {};
  }
  const payload = {
    timestamp: Date.now(),
    nodes: nodesList,
    metrics: metricsObj,
  };
  safeSetLS(LS_CACHE_KEY, payload);
}

// 讀取/儲存使用者篩選設定
export function loadUserFilters() {
  return safeGetLS(LS_FILTERS_KEY);
}

export function saveUserFilters(filters) {
  // filters 為序列化後的純資料物件（由呼叫端組裝）
  safeSetLS(LS_FILTERS_KEY, filters);
}

// 從儲存套用使用者設定
// deps: 由呼叫端傳入所需的 DOM/狀態與函式，避免此模組直接依賴其他功能模組
// 期望的 deps 欄位：
// - setLanguage(lang: string)
// - updateCountryToggleLabel(): void（可選，如果需更新按鈕文案）
// - locationFilter, searchInput, cpuMaxFilter, ioMaxFilter, nicMaxFilter, congestionMaxFilter
// - selectedCountryCodes: Set<string>
// - refreshCountryFilterUI(): void
// - setSortState: (state: {key: string, direction: 'asc'|'desc'}) => void
export function applyUserFiltersFromStorage(filters, deps) {
  if (!filters || !deps) return;

  // 語言
  if (filters.lang && typeof deps.setLanguage === 'function') {
    deps.setLanguage(filters.lang);
    if (typeof deps.updateCountryToggleLabel === 'function') deps.updateCountryToggleLabel();
    if (typeof deps.updateCountryFilterLabels === 'function') deps.updateCountryFilterLabels();
  }

  // DOM 欄位
  if (deps.locationFilter) {
    const found = Array.from(deps.locationFilter.options).some((o) => o.value === filters.location);
    deps.locationFilter.value = found ? filters.location : 'all';
  }
  if (deps.searchInput) deps.searchInput.value = filters.keyword ?? '';
  if (deps.cpuMaxFilter) deps.cpuMaxFilter.value = filters.cpuMax ?? '';
  if (deps.ioMaxFilter) deps.ioMaxFilter.value = filters.ioMax ?? '';
  if (deps.nicMaxFilter) deps.nicMaxFilter.value = filters.nicMax ?? '';
  if (deps.congestionMaxFilter) deps.congestionMaxFilter.value = filters.congestionMax ?? '';

  // 國家前綴
  if (deps.selectedCountryCodes && typeof deps.selectedCountryCodes.clear === 'function') {
    deps.selectedCountryCodes.clear();
    if (Array.isArray(filters.countryCodes)) {
      filters.countryCodes.forEach((code) => deps.selectedCountryCodes.add(code));
    }
  }
  if (typeof deps.refreshCountryFilterUI === 'function') deps.refreshCountryFilterUI();

  // 排序
  if (filters.sort && filters.sort.key && typeof deps.setSortState === 'function') {
    const direction = filters.sort.direction === 'desc' ? 'desc' : 'asc';
    deps.setSortState({ key: filters.sort.key, direction });
  }
}

