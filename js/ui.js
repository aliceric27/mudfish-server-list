// ui.js - UI 互動模組（事件、面板切換、過濾器 UI）

let deps = {
  // DOM 元素
  tableBody: null,
  countryFilterContainer: null,
  countryToggle: null,
  langSelect: null,
  locationFilter: null,
  searchInput: null,
  cpuMaxFilter: null,
  ioMaxFilter: null,
  nicMaxFilter: null,
  congestionMaxFilter: null,
  bestServerBtn: null,
  resetFiltersBtn: null,

  // 狀態/資料
  selectedCountryCodes: null, // Set

  // 回呼/工具
  t: null,
  setLanguage: null,
  onAfterLanguageChange: null, // () => void （語言切換後，re-render 與保存設定）
  onFiltersChange: null,       // () => void
  onResetFilters: null,        // () => void
  onTableRowClick: null,       // (event) => void
  renderTable: null,           // (list) => void
};

// 本模組的內部狀態
let isCountryPanelOpen = false;
const countryCheckboxes = new Map();

export function initUI(initDeps) {
  deps = { ...deps, ...initDeps };
}

export function attachEventListeners() {
  // 過濾器輸入
  deps.locationFilter?.addEventListener('change', () => deps.onFiltersChange?.());
  deps.searchInput?.addEventListener('input', () => deps.onFiltersChange?.());
  deps.cpuMaxFilter?.addEventListener('input', () => deps.onFiltersChange?.());
  deps.ioMaxFilter?.addEventListener('input', () => deps.onFiltersChange?.());
  deps.nicMaxFilter?.addEventListener('input', () => deps.onFiltersChange?.());
  deps.congestionMaxFilter?.addEventListener('input', () => deps.onFiltersChange?.());
  deps.bestServerBtn?.addEventListener('click', () => deps.onBestServerPreset?.());
  deps.resetFiltersBtn?.addEventListener('click', () => deps.onResetFilters?.());
  // 語言切換
  if (deps.langSelect) {
    deps.langSelect.addEventListener('change', (e) => {
      deps.setLanguage?.(e.target.value);
      updateCountryToggleLabel();
      deps.onAfterLanguageChange?.();
    });
  }

  // 表格列點擊：僅限 SID 欄位
  deps.tableBody?.addEventListener('click', (evt) => deps.onTableRowClick?.(evt));

  // 國家面板切換
  deps.countryToggle?.addEventListener('click', () => toggleCountryPanel());
  deps.countryToggle?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleCountryPanel();
    }
  });
}







export function toggleCountryPanel(forceOpen) {
  const next = typeof forceOpen === 'boolean' ? forceOpen : !isCountryPanelOpen;
  isCountryPanelOpen = next;
  if (deps.countryFilterContainer) {
    deps.countryFilterContainer.hidden = !next;
    deps.countryFilterContainer.classList.toggle('country-filter--open', next);
  }
  updateCountryToggleLabel();
}

export function updateCountryToggleLabel() {
  const count = deps.selectedCountryCodes?.size ?? 0;
  const label = count === 0 ? deps.t?.('country.all') : deps.t?.('country.selected', { count });
  if (deps.countryToggle) deps.countryToggle.textContent = label ?? '';
  if (deps.countryToggle) deps.countryToggle.setAttribute('aria-expanded', String(isCountryPanelOpen));
}

export function createCountryOption(code, label, count) {
  const wrapper = document.createElement('label');
  wrapper.className = 'country-filter__option';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = code;

  const span = document.createElement('span');
  span.textContent = `${label} (${count})`;

  wrapper.appendChild(input);
  wrapper.appendChild(span);
  return { element: wrapper, input };
}

export function refreshCountryFilterUI() {
  countryCheckboxes.forEach((input, code) => {
    if (code === '__all__') {
      input.checked = (deps.selectedCountryCodes?.size ?? 0) === 0;
    } else {
      input.checked = deps.selectedCountryCodes?.has(code) ?? false;
    }
  });
}

export function populateLocationFilter(nodeList) {
  if (!deps.locationFilter) return;
  // 供應商品牌選項（排除空字串），依字母排序
  const providers = Array.from(new Set(nodeList.map((n) => n.providerBrand).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  const fragment = document.createDocumentFragment();
  providers.forEach((brand) => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    fragment.appendChild(option);
  });
  deps.locationFilter.appendChild(fragment);
}

export function populateCountryFilter(nodeList) {
  if (!deps.countryFilterContainer) return;
  deps.countryFilterContainer.innerHTML = '';
  countryCheckboxes.clear();

  const counts = new Map();
  nodeList.forEach((node) => {
    const code = node.countryCode;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'en'));
  const fragment = document.createDocumentFragment();

  const allOption = createCountryOption('__all__', '全部', nodeList.length);
  fragment.appendChild(allOption.element);
  countryCheckboxes.set('__all__', allOption.input);
  allOption.input.addEventListener('change', () => {
    deps.selectedCountryCodes?.clear?.();
    refreshCountryFilterUI();
    deps.onFiltersChange?.();
    // 交由外部保存
    deps.onAfterLanguageChange?.(); // 可讓外層保存或 re-render（可選）
  });

  sorted.forEach(([code, count]) => {
    const option = createCountryOption(code, code, count);
    fragment.appendChild(option.element);
    countryCheckboxes.set(code, option.input);
    option.input.addEventListener('change', () => {
      if (option.input.checked) deps.selectedCountryCodes?.add(code);
      else deps.selectedCountryCodes?.delete(code);
      refreshCountryFilterUI();
      deps.onFiltersChange?.();
    });
  });

  deps.countryFilterContainer.appendChild(fragment);
}







