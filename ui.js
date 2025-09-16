// ui.js - UI 互動模組（事件、面板切換、Hover Card、過濾器 UI）

let deps = {
  // DOM 元素
  tableBody: null,
  countryFilterContainer: null,
  countryToggle: null,
  hoverCard: null,
  hoverCardTemplate: null,
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
  nodeLookup: null,           // Map<sid, node>

  // 回呼/工具
  t: null,
  setLanguage: null,
  onAfterLanguageChange: null, // () => void （語言切換後，re-render 與保存設定）
  onFiltersChange: null,       // () => void
  onResetFilters: null,        // () => void
  onTableRowClick: null,       // (event) => void
  renderTable: null,           // (list) => void
  getServerDetailCached: null, // (sid) => Promise
  buildDetailRows: null,       // (baseNode, detail) => rows
  formatTime: null,            // (Date) => string
};

// 本模組的內部狀態
let isCountryPanelOpen = false;
let activeRow = null;
let lastPointerPosition = null;
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

  // Hover Card 互動
  deps.tableBody?.addEventListener('pointerover', (event) => {
    const row = event.target.closest('tr[data-sid]');
    if (!row) {
      if (activeRow) hideHoverCard();
      return;
    }
    if (activeRow !== row) {
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      showHoverForRow(row, lastPointerPosition);
    }
  });

  deps.tableBody?.addEventListener('pointermove', (event) => {
    if (!activeRow) return;
    lastPointerPosition = { x: event.clientX, y: event.clientY };
    positionHoverCard(lastPointerPosition);
  });

  deps.tableBody?.addEventListener('pointerout', (event) => {
    const relatedRow = event.relatedTarget?.closest?.('tr[data-sid]');
    if (!relatedRow) hideHoverCard();
  });

  deps.tableBody?.addEventListener('focusin', (event) => {
    const row = event.target.closest('tr[data-sid]');
    if (row) showHoverForRow(row, getRowViewportCenter(row));
  });

  deps.tableBody?.addEventListener('focusout', (event) => {
    if (!deps.tableBody.contains(event.relatedTarget)) hideHoverCard();
  });

  window.addEventListener('scroll', () => {
    if (activeRow) positionHoverCard(getRowViewportCenter(activeRow));
  });
  window.addEventListener('resize', () => {
    if (activeRow) positionHoverCard(getRowViewportCenter(activeRow));
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

export async function showHoverForRow(row, position) {
  const sid = row?.dataset?.sid;
  if (!sid) return;
  activeRow = row;

  const baseNode = deps.nodeLookup?.get?.(sid);
  if (!baseNode) return;

  if (deps.hoverCard) deps.hoverCard.hidden = false;
  updateHoverCardContent({
    title: baseNode.hostname,
    subtitle: baseNode.location,
    details: [
      { label: deps.t?.('hover.labels.ipv4'), value: baseNode.ip },
      { label: deps.t?.('hover.labels.sid'), value: String(baseNode.sid) },
      { label: deps.t?.('hover.labels.status'), value: deps.t?.('hover.fetching') },
    ],
    footer: deps.t?.('hover.firstLoadHint'),
  });

  const anchor = position ?? lastPointerPosition ?? getRowViewportCenter(row);
  positionHoverCard(anchor);

  try {
    const detail = await deps.getServerDetailCached?.(sid);
    if (activeRow !== row) return;
    const detailRows = deps.buildDetailRows?.(baseNode, detail) ?? [];
    const footerText = detail?.fetchedAt
      ? `${deps.t?.('hover.fetchTimePrefix')}${deps.formatTime?.(detail.fetchedAt)}`
      : deps.t?.('hover.liveSource');

    updateHoverCardContent({
      title: baseNode.hostname,
      subtitle: baseNode.location,
      details: detailRows,
      footer: footerText,
    });
    const updatedAnchor = lastPointerPosition ?? anchor ?? getRowViewportCenter(row);
    positionHoverCard(updatedAnchor);
  } catch (err) {
    if (activeRow !== row) return;
    updateHoverCardContent({
      title: baseNode.hostname,
      subtitle: baseNode.location,
      details: [
        { label: deps.t?.('hover.labels.ipv4'), value: baseNode.ip },
        { label: deps.t?.('hover.labels.sid'), value: String(baseNode.sid) },
        { label: deps.t?.('hover.labels.status'), value: deps.t?.('hover.fetchFailed') },
      ],
      footer: deps.t?.('hover.retryLater'),
    });
    const fallbackAnchor = lastPointerPosition ?? anchor ?? getRowViewportCenter(row);
    positionHoverCard(fallbackAnchor);
  }
}

export function hideHoverCard() {
  activeRow = null;
  if (deps.hoverCard) deps.hoverCard.hidden = true;
}

function positionHoverCard(position) {
  if (!position || !deps.hoverCard) return;
  const offset = 18;
  const viewportPadding = 12;
  const rect = deps.hoverCard.getBoundingClientRect();
  let left = position.x + offset;
  let top = position.y + offset;

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  if (left + rect.width + viewportPadding > vw) {
    left = Math.max(viewportPadding, vw - rect.width - viewportPadding);
  }
  if (top + rect.height + viewportPadding > vh) {
    top = Math.max(viewportPadding, vh - rect.height - viewportPadding);
  }

  deps.hoverCard.style.left = `${Math.round(left)}px`;
  deps.hoverCard.style.top = `${Math.round(top)}px`;
}

function getRowViewportCenter(row) {
  const rect = row.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function updateHoverCardContent({ title, subtitle, details, footer }) {
  if (!deps.hoverCardTemplate || !deps.hoverCard) return;
  const fragment = deps.hoverCardTemplate.content.cloneNode(true);
  const titleEl = fragment.querySelector('.hover-card__title');
  const subtitleEl = fragment.querySelector('.hover-card__subtitle');
  const detailsEl = fragment.querySelector('.hover-card__details');
  const footerEl = fragment.querySelector('.hover-card__footer');

  if (titleEl) titleEl.textContent = title ?? '';
  if (subtitleEl) subtitleEl.textContent = subtitle ?? '';

  detailsEl.innerHTML = '';
  (details ?? []).forEach((row) => appendDetailValue(detailsEl, row.value, row.label));

  footerEl.textContent = footer ?? '';

  deps.hoverCard.innerHTML = '';
  deps.hoverCard.appendChild(fragment);
}

function appendDetailValue(container, value, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'hover-card__detail';
  const labelEl = document.createElement('span');
  labelEl.className = 'hover-card__detail-label';
  labelEl.textContent = label ?? '';
  const valueEl = document.createElement('span');
  valueEl.className = 'hover-card__detail-value';
  valueEl.textContent = value ?? '—';
  wrapper.appendChild(labelEl);
  wrapper.appendChild(valueEl);
  container.appendChild(wrapper);
}

