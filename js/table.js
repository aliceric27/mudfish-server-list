// table.js - 表格渲染、排序與觀察者

let deps = {
  tableBody: null,
  globalMetrics: null,
  t: (s) => s,
  getSortState: () => ({ key: "region", direction: "asc" }),
  setSortState: (_s) => {},
  getDisplaySortExtractor: (_key) => (n) => n,
  getFilteredNodes: () => [],
  getServerDetailCached: (_sid) => Promise.resolve(),
  getPingMs: (_sid) => null,
};

let rowObserver = null;

export function initTable(initDeps) {
  deps = { ...deps, ...initDeps };
}

// ---------- 基本渲染 ----------
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

export function applyRowSortDataset(row, metrics) {
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

export function createRow(node) {
  const row = document.createElement("tr");
  row.dataset.sid = String(node.sid);
  row.dataset.location = node.locationRegion || node.location;
  row.dataset.hostname = node.hostname;
  row.dataset.country = node.countryCode;
  row.dataset.provider = node.provider || "";
  row.tabIndex = 0;

  const metrics = deps.globalMetrics.get(String(node.sid)) ?? null;
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
    <td class="ping-cell" data-metric="ping">${renderPingCell(node.sid)}</td>
  `;

  const regionSpan = row.querySelector('.region-cell .truncate-15ch');
  if (regionSpan) {
    regionSpan.textContent = region;
    regionSpan.title = region;
  }

  applyRowSortDataset(row, metrics);
  return row;
}

function renderPingCell(sid) {
  const value = deps.getPingMs(String(sid));
  const has = Number.isFinite(value);
  const text = has ? `${Math.round(value)} ms` : '';
  const btnLabel = deps.t('buttons.ping') || 'Test';
  const spanCls = has ? 'ping-value is-clickable' : 'ping-value';
  const spanStyle = has ? '' : 'display:none;';
  const btnStyle = has ? 'display:none;' : '';
  return `<span class="${spanCls}" style="${spanStyle}">${text}</span> <button type="button" class="action-button ping-test-btn" style="${btnStyle}">${btnLabel}</button>`;
}

export function updateRowContent(row, node) {
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

  const metrics = deps.globalMetrics.get(String(node.sid)) ?? null;
  if (tds[4]) tds[4].innerHTML = renderMetricValue(metrics?.cpuLoadText, "cpuLoad");
  if (tds[5]) tds[5].innerHTML = renderMetricValue(metrics?.ioWaitText, "ioWait");
  if (tds[6]) tds[6].innerHTML = renderMetricValue(metrics?.nicErrorText, "nicError");
  if (tds[7]) tds[7].innerHTML = renderMetricValue(metrics?.networkText, "network");
  if (tds[8]) tds[8].innerHTML = renderMetricValue(metrics?.congestionText, "congestion");
  if (tds[9]) tds[9].innerHTML = renderPingCell(node.sid);

  applyRowSortDataset(row, metrics);
}

export function setTablePlaceholder(message) {
  deps.tableBody.innerHTML = `
    <tr>
      <td colspan="10" class="status-table__placeholder">${message}</td>
    </tr>
  `;
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

export function sortForDisplay(list) {
  const { key, direction } = deps.getSortState();
  const extractor = deps.getDisplaySortExtractor(key);
  const sorted = [...list].sort((a, b) => compareValues(extractor(a), extractor(b)));
  if (direction === "desc") sorted.reverse();
  return sorted;
}

export function renderTable(data) {
  deps.tableBody.innerHTML = "";
  if (!data.length) {
    clearRowObserver();
    setTablePlaceholder(deps.t('table.empty'));
    return;
  }
  const sorted = sortForDisplay(data);
  clearRowObserver();
  const fragment = document.createDocumentFragment();
  const rowsToObserve = [];
  sorted.forEach((node) => {
    const row = createRow(node);
    fragment.appendChild(row);
    rowsToObserve.push(row);
  });
  deps.tableBody.appendChild(fragment);
  rowsToObserve.forEach((row) => observeRow(row));
}

export function updateTableIncremental(desiredList) {
  const desiredIndex = new Map(desiredList.map((n, i) => [String(n.sid), i]));
  Array.from(deps.tableBody.querySelectorAll('tr[data-sid]')).forEach((row) => {
    const sid = row.dataset.sid;
    if (!desiredIndex.has(sid)) {
      deps.tableBody.removeChild(row);
    }
  });
  desiredList.forEach((node, index) => {
    const sid = String(node.sid);
    let row = deps.tableBody.querySelector(`tr[data-sid="${sid}"]`);
    const ref = deps.tableBody.children[index] || null;
    if (!row) {
      row = createRow(node);
      deps.tableBody.insertBefore(row, ref);
      observeRow(row);
    } else {
      if (row !== ref) deps.tableBody.insertBefore(row, ref);
      updateRowContent(row, node);
    }
  });
}

// ---------- 初始排序設定 ----------
export function setupSorting() {
  const headers = document.querySelectorAll("#serverTable thead th[data-sort-key]");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) return;
      const cur = deps.getSortState();
      const next = cur.key === key
        ? { key, direction: cur.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" };
      deps.setSortState(next);
      updateSortIndicators(headers);
      deps.onSortChanged && deps.onSortChanged();
    });
  });
  updateSortIndicators(headers);
}

export function updateSortIndicators(headers) {
  const cur = deps.getSortState();
  headers.forEach((th) => {
    th.classList.remove("is-asc", "is-desc");
    if (th.dataset.sortKey === cur.key) {
      th.classList.add(cur.direction === "asc" ? "is-asc" : "is-desc");
    }
  });
}

// ---------- 觀察者 ----------
export function ensureRowObserver() {
  if (!rowObserver) {
    rowObserver = new IntersectionObserver(handleRowIntersection, {
      root: null,
      threshold: 0.2,
    });
  }
}

export function observeRow(row) {
  if (!row) return;
  ensureRowObserver();
  rowObserver.observe(row);
}

export function clearRowObserver() {
  if (rowObserver) {
    rowObserver.disconnect();
  }
}

function handleRowIntersection(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const row = entry.target;
    const sid = row.dataset.sid;
    if (!sid) return;
    rowObserver.unobserve(row);
    deps.getServerDetailCached(sid).catch(() => {});
  });
}

// ---------- 其他排序 ----------
export function sortNodes(list) {
  return [...list].sort((a, b) => {
    const locA = a.locationRegion || a.location || "";
    const locB = b.locationRegion || b.location || "";
    const locationCompare = locA.localeCompare(locB, "zh-Hant");
    if (locationCompare !== 0) return locationCompare;
    return a.hostname.localeCompare(b.hostname, "zh-Hant");
  });
}
