import { fetchStaticNodes, fetchGlobalMetrics } from './api.js';
import { NODE_DETAIL_ENDPOINT } from './config.js';

const CONGESTION_THRESHOLD = 60;
const RESTCOUNTRIES_ENDPOINT = 'https://restcountries.com/v3.1/all?fields=cca2,name,latlng';
const TILE_LAYER_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LAYER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>';

const STATUS_LABELS = {
  normal: '運作正常',
  congested: '伺服器壅擠',
  error: '伺服器錯誤',
  unknown: '狀態未知',
};

const regionDisplay = supportsIntlDisplayNames()
  ? new Intl.DisplayNames(['zh-Hant'], { type: 'region' })
  : null;

let listContainer = null;
let markerByCountry = new Map();
let activeCountryCode = null;
let selectionContainer = null;
let selectionLabelEl = null;
let selectionCountEl = null;
let leafletMap = null;
let metricsStore = null;
let countryEntries = new Map();
let countPopup = null;
let listPaging = { page: 1, pageSize: 12 };

document.addEventListener('DOMContentLoaded', () => {
  initMapPage().catch((err) => {
    console.error(err);
  });
});

async function initMapPage() {
  const mapEl = document.getElementById('mapView');
  const listEl = document.getElementById('mapList');
  const selectionEl = document.getElementById('mapSelection');

  listContainer = listEl || null;
  selectionContainer = selectionEl || null;
  selectionLabelEl = selectionEl ? selectionEl.querySelector('[data-selection-label]') : null;
  selectionCountEl = selectionEl ? selectionEl.querySelector('[data-selection-count]') : null;

  if (!mapEl) {
    console.warn('map.html 缺少必要的容器元素');
    return;
  }


  try {
    const [centroidMap, nodes, metricsMap] = await Promise.all([
      loadCountryCentroids(),
      fetchStaticNodes(),
      fetchGlobalMetrics(),
    ]);

    if (!window.L) {
      throw new Error('Leaflet 尚未正確載入');
    }

    const enrichedNodes = nodes.map((node) => ({
      ...node,
      countryCode: deriveCountryCode(node),
    }));

    const grouped = groupByCountry(enrichedNodes);
    const map = setupLeafletMap(mapEl);
    leafletMap = map;

    const { plottedCountries, plottedServers, entries } = renderCountryMarkers({
      map,
      grouped,
      centroidMap,
      metricsMap,
    });

    metricsStore = metricsMap;
    countryEntries = new Map(entries.map((entry) => [entry.countryCode, entry]));

    setActiveCountry(activeCountryCode && countryEntries.has(activeCountryCode) ? activeCountryCode : null, {
      openPopup: false,
      focusMap: false,
    });

    if (!plottedCountries) {
      return;
    }

    console.info(`完成載入：共 ${enrichedNodes.length} 台伺服器，覆蓋 ${plottedCountries} 個國家（顯示 ${plottedServers} 台）。`);
  } catch (error) {
    console.error(error);
  }
}

function setupLeafletMap(mapEl) {
  const map = L.map(mapEl, {
    worldCopyJump: true,
    minZoom: 2,
  }).setView([20, 0], 2);

  L.tileLayer(TILE_LAYER_URL, {
    maxZoom: 19,
    attribution: TILE_LAYER_ATTRIBUTION,
  }).addTo(map);

  return map;
}

function renderCountryMarkers({ map, grouped, centroidMap, metricsMap }) {
  const boundsPoints = [];
  const entries = [];
  let plottedCountries = 0;
  let plottedServers = 0;

  markerByCountry = new Map();

  grouped.forEach((servers, countryCode) => {
    if (!countryCode) return;
    const centroid = centroidMap.get(countryCode);
    if (!centroid) return;

    const position = [centroid.lat, centroid.lng];
    const markerStatus = computeGroupStatus(servers, metricsMap);
    const marker = L.marker(position, {
      icon: createStatusIcon(markerStatus, servers.length),
      title: buildMarkerTitle(
        countryCode,
        centroid.name?.common || centroid.name,
        servers.length,
        markerStatus
      ),
      keyboard: true,
    });

    const entry = {
      countryCode,
      centroid,
      servers,
      status: markerStatus,
      marker,
    };

    marker.on('click', () => {
      setActiveCountry(countryCode, { openPopup: true, focusMap: false });
    });

    marker.on('keypress', (event) => {
      const key = event?.originalEvent?.key;
      if (key === 'Enter' || key === ' ') {
        setActiveCountry(countryCode, { openPopup: true, focusMap: false });
      }
    });

    marker.addTo(map);

    boundsPoints.push(position);
    plottedCountries += 1;
    plottedServers += servers.length;

    markerByCountry.set(countryCode, marker);
    entries.push(entry);
  });

  if (boundsPoints.length) {
    map.fitBounds(boundsPoints, { padding: [48, 48], maxZoom: 5.5 });
  }

  return { plottedCountries, plottedServers, entries };
}

function buildMarkerTitle(countryCode, fallbackName, serverCount, status) {
  const label = getCountryLabel(countryCode, fallbackName);
  return `${label}：${STATUS_LABELS[status]}（${serverCount} 台）`;
}

function renderServerList(listEl, entry) {
  if (!listEl) return;

  listEl.innerHTML = '';

  if (!entry) {
    listEl.innerHTML = '<div class="map-city-list__placeholder">請點擊地圖上的國家節點以檢視其伺服器列表。</div>';
    return;
  }

  const sortedServers = [...entry.servers].sort((a, b) =>
    String(a.location || a.hostname || a.sid).localeCompare(
      String(b.location || b.hostname || b.sid),
      'zh-Hant'
    )
  );

  const totalServers = sortedServers.length;
  const pageSize = listPaging.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalServers / pageSize));

  if (!Number.isFinite(listPaging.page) || listPaging.page < 1) {
    listPaging.page = 1;
  } else if (listPaging.page > totalPages) {
    listPaging.page = totalPages;
  }

  const start = (listPaging.page - 1) * pageSize;
  const pageItems = sortedServers.slice(start, start + pageSize);
  const fragment = document.createDocumentFragment();

  pageItems.forEach((server) => {
    const metrics = metricsStore ? metricsStore.get(String(server.sid)) || null : null;
    const baseStatus = computeServerStatus(metrics);
    const status = deriveVisualStatus(metrics, baseStatus);
    const congestion = metrics?.congestionText ?? '—';
    const locationLabel = server.location || server.hostname || `SID ${server.sid}`;
    const locationText = escapeHtml(locationLabel);
    const providerLabel = server.provider ?? '';
    const providerText = escapeHtml(providerLabel);
    const congestionText = escapeHtml(String(congestion));
    const detailUrl = NODE_DETAIL_ENDPOINT(String(server.sid));

    const providerFragment = providerText
      ? `<span class="map-city__provider">${providerText}</span>`
      : '';

    const item = document.createElement('a');
    item.className = `map-city map-city--${status}`;
    item.href = detailUrl;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.title = `${locationLabel}（SID ${server.sid}）`;
    item.innerHTML = `
      <span class="map-city__indicator"></span>
      <div class="map-city__body">
        <div class="map-city__header">
          <span class="map-city__name">${locationText}</span>
          ${providerFragment}
        </div>
        <div class="map-city__meta">
          <span class="map-city__sid">SID ${escapeHtml(String(server.sid))}</span>
          <span class="map-city__status">${STATUS_LABELS[status] ?? STATUS_LABELS[baseStatus]}</span>
          <span class="map-city__congestion">擁擠度：${congestionText}</span>
        </div>
      </div>
    `;

    fragment.appendChild(item);
  });

  listEl.appendChild(fragment);

  const startDisplay = totalServers ? start + 1 : 0;
  const endDisplay = Math.min(totalServers, start + pageItems.length);

  if (totalPages > 1) {
    const pagination = document.createElement('nav');
    pagination.className = 'map-city-list__pagination';

    const summary = document.createElement('span');
    summary.className = 'map-city-list__pagination-summary';
    summary.textContent = `第 ${listPaging.page} / ${totalPages} 頁 · 顯示 ${startDisplay}-${endDisplay} / ${totalServers} 台`;
    pagination.appendChild(summary);

    const controls = document.createElement('div');
    controls.className = 'map-city-list__pagination-controls';

    const makeButton = (label, disabled, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-city-list__pagination-btn';
      btn.textContent = label;
      btn.disabled = disabled;
      if (!disabled) {
        btn.addEventListener('click', onClick);
      }
      return btn;
    };

    controls.appendChild(
      makeButton('上一頁', listPaging.page <= 1, () => {
        listPaging.page -= 1;
        renderServerList(listEl, entry);
      })
    );

    controls.appendChild(
      makeButton('下一頁', listPaging.page >= totalPages, () => {
        listPaging.page += 1;
        renderServerList(listEl, entry);
      })
    );

    pagination.appendChild(controls);
    listEl.appendChild(pagination);
  }
}

function deriveVisualStatus(metrics, baseStatus) {
  if (!metrics) return baseStatus;

  if (hasNicError(metrics)) {
    return 'error';
  }

  if (exceedsWarningThreshold(metrics)) {
    return 'congested';
  }

  return baseStatus;
}

function hasNicError(metrics) {
  const value = extractMetricNumber(metrics.nicErrorValue, metrics.nicErrorText);
  return value !== null && value >= 1;
}

function exceedsWarningThreshold(metrics) {
  const congestionValue = extractMetricNumber(metrics.congestionValue, metrics.congestionText);
  if (congestionValue !== null && congestionValue > 10) {
    return true;
  }
  const cpuValue = extractMetricNumber(metrics.cpuLoadValue, metrics.cpuLoadText);
  const ioValue = extractMetricNumber(metrics.ioWaitValue, metrics.ioWaitText);
  return (cpuValue !== null && cpuValue > 1) || (ioValue !== null && ioValue > 1);
}

function extractMetricNumber(primaryValue, fallbackText) {
  if (Number.isFinite(primaryValue)) return primaryValue;
  if (typeof fallbackText === 'string' && fallbackText.trim()) {
    const parsed = parseFloat(fallbackText.replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function updateSelectionSummary(entry) {
  if (!selectionContainer || !selectionLabelEl || !selectionCountEl) return;

  if (!entry) {
    selectionContainer.removeAttribute('data-status');
    selectionLabelEl.textContent = '尚未選取國家';
    selectionCountEl.textContent = '—';
    return;
  }

  selectionContainer.setAttribute('data-status', entry.status);
  const label = getCountryLabel(entry.countryCode, entry.centroid.name?.common || entry.centroid.name);
  selectionLabelEl.textContent = label;
  selectionCountEl.textContent = `${entry.servers.length} 台伺服器`;
}

function updateMarkerHighlight(code) {
  markerByCountry.forEach((marker, countryCode) => {
    const element = marker.getElement();
    if (!element) return;
    element.classList.toggle('is-active', countryCode === code);
  });
}

function openCountPopup(entry) {
  if (!leafletMap || !entry?.marker) return;

  if (!countPopup) {
    countPopup = L.popup({
      closeButton: false,
      autoClose: true,
      className: 'map-count-popup-shell',
      offset: [0, -18],
    });
  }

  const latLng = entry.marker.getLatLng();
  const label = escapeHtml(getCountryLabel(entry.countryCode, entry.centroid.name?.common || entry.centroid.name));
  const content = `
    <div class="map-count-popup">
      <span class="map-count-popup__country">${label}</span>
      <span class="map-count-popup__count">${entry.servers.length} 台伺服器</span>
    </div>
  `;

  countPopup.setLatLng(latLng).setContent(content).openOn(leafletMap);
}

function closeCountPopup() {
  if (leafletMap && countPopup) {
    leafletMap.closePopup(countPopup);
  }
}

function computeGroupStatus(servers, metricsMap) {
  const statuses = servers.map((server) => computeServerStatus(metricsMap.get(String(server.sid)) || null));
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('congested')) return 'congested';
  if (statuses.every((s) => s === 'unknown')) return 'unknown';
  return 'normal';
}

function computeServerStatus(metrics) {
  if (!metrics) return 'unknown';
  if (hasErrorText(metrics)) return 'error';
  if (Number.isFinite(metrics.congestionValue) && metrics.congestionValue >= CONGESTION_THRESHOLD) {
    return 'congested';
  }
  return 'normal';
}

function hasErrorText(metrics) {
  return ['cpuLoadText', 'ioWaitText', 'nicErrorText', 'networkText', 'congestionText'].some((key) => {
    const value = metrics[key];
    return typeof value === 'string' && /down|err|fail|timeout/i.test(value);
  });
}

function groupByCountry(nodes) {
  const grouped = new Map();
  nodes.forEach((node) => {
    const code = node.countryCode || '??';
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(node);
  });
  return grouped;
}

async function loadCountryCentroids() {
  const response = await fetch(RESTCOUNTRIES_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('無法取得國家座標資料');
  }
  const payload = await response.json();
  const map = new Map();
  payload.forEach((item) => {
    const code = item.cca2?.toUpperCase();
    const coords = Array.isArray(item.latlng) ? item.latlng : null;
    if (!code || !coords || coords.length < 2) return;
    map.set(code, { lat: coords[0], lng: coords[1], name: item.name });
  });
  map.set('??', { lat: 0, lng: 0, name: { common: '未知位置' } });
  return map;
}

function deriveCountryCode(node) {
  const locationText = typeof node.location === 'string' ? node.location.trim() : '';
  if (locationText) {
    const locationMatch = locationText.match(/^([A-Z]{2})\b/);
    if (locationMatch) {
      return locationMatch[1].toUpperCase();
    }
  }

  const hostMatch = node.hostname?.match(/^node-([a-z]{2})-/i);
  if (hostMatch) {
    return hostMatch[1].toUpperCase();
  }
  const fallbackLocationMatch = node.location?.match(/\b([A-Z]{2})\b/);
  if (fallbackLocationMatch) {
    return fallbackLocationMatch[1].toUpperCase();
  }
  return '??';
}

function createStatusIcon(status, count) {
  return L.divIcon({
    html: `
      <span class="server-marker__badge">${count}</span>
      <span class="server-marker__dot"></span>
    `,
    className: `server-marker server-marker--${status}`,
    iconSize: [34, 38],
    iconAnchor: [17, 34],
    popupAnchor: [0, -26],
  });
}

function getCountryLabel(countryCode, fallbackName) {
  if (!countryCode || countryCode === '??') return fallbackName ? String(fallbackName) : '未知位置';
  try {
    if (regionDisplay) {
      const name = regionDisplay.of(countryCode);
      if (name) return name;
    }
  } catch (_) {
    // ignore
  }
  if (fallbackName) return String(fallbackName);
  return countryCode;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setActiveCountry(code, { focusMap = false, openPopup = true } = {}) {
  const previousCode = activeCountryCode;
  activeCountryCode = code;
  updateMarkerHighlight(code || null);

  const entry = code ? countryEntries.get(code) : null;

  if (!entry) {
    listPaging.page = 1;
    updateSelectionSummary(null);
    if (listContainer) {
      renderServerList(listContainer, null);
    }
    closeCountPopup();
    return;
  }

  if (previousCode !== code) {
    listPaging.page = 1;
  }

  if (focusMap && leafletMap && entry.marker) {
    const marker = entry.marker;
    const latLng = marker.getLatLng();
    const targetZoom = Math.max(leafletMap.getZoom(), 4.2);
    leafletMap.flyTo(latLng, targetZoom, { animate: true, duration: 0.8 });
  }

  if (openPopup) {
    openCountPopup(entry);
  }

  updateSelectionSummary(entry);
  if (listContainer) {
    renderServerList(listContainer, entry);
  }
}

function supportsIntlDisplayNames() {
  return typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function';
}



