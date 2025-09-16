// api.js - 資料請求與解析模組
// 職責：
// - 向後端/頁面抓取資料（節點列表、全域指標、節點詳細）
// - 解析回傳的 HTML/JSON 並轉成應用可用的資料結構
// 依賴：從 config.js 取得端點；從 i18n.js 取得指標標籤常數

import { STATIC_NODES_ENDPOINT, GLOBAL_STATUS_ENDPOINT, NODE_DETAIL_ENDPOINT } from './config.js';
import { METRIC_LABELS, METRIC_IMAGE_LABELS } from './i18n.js';

// 取得靜態節點清單
export async function fetchStaticNodes() {
  const response = await fetch(STATIC_NODES_ENDPOINT);
  if (!response.ok) {
    throw new Error(`取得節點資料時發生錯誤：${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.staticnodes) {
    throw new Error('回傳格式不如預期');
  }
  return payload.staticnodes;
}

// 取得全域指標（解析 HTML 表格）
export async function fetchGlobalMetrics() {
  const response = await fetch(GLOBAL_STATUS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`取得節點指標時發生錯誤：${response.status}`);
  }
  const html = await response.text();
  return parseGlobalStatusHtml(html);
}

// 取得單一節點詳細（純抓取＋解析，不含快取；由呼叫端管理快取）
export async function getServerDetail(sid) {
  const response = await fetch(NODE_DETAIL_ENDPOINT(sid));
  if (!response.ok) {
    throw new Error(`取得節點 ${sid} 詳細資料失敗：${response.status}`);
  }
  const html = await response.text();
  const detail = parseServerStatusHtml(html);
  detail.fetchedAt = new Date();
  return detail;
}

// ===== 解析：節點詳細頁 =====
function parseServerStatusHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const panel = doc.querySelector('.panel.panel-info .panel-body');
  if (!panel) {
    throw new Error('未能解析伺服器狀態面板');
  }

  const topLevelItems = Array.from(panel.querySelectorAll(':scope > ul > li'));
  const detail = {
    uptime: '',
    heartbeat: '',
    privateIp: '',
    pricePolicy: [],
    metrics: {},
  };

  // 以固定順序的第 N 個 <li> 取值，避免語言差異
  if (topLevelItems.length >= 5) {
    // 0: Hostname, 1: IPv4, 2: Private IP, 3: Uptime, 4: Heartbeat
    detail.privateIp = detail.privateIp || getListItemValue(topLevelItems[2]);
    detail.uptime = detail.uptime || getListItemValue(topLevelItems[3]);
    detail.heartbeat = detail.heartbeat || getListItemValue(topLevelItems[4]);
  }

  topLevelItems.forEach((item) => {
    const label = getListItemLabel(item);
    if (!label) return;
    if (labelMatches(label, ['uptime', '運行時間'])) {
      detail.uptime = getListItemValue(item);
    } else if (labelMatches(label, ['heartbeat', '心跳'])) {
      detail.heartbeat = getListItemValue(item);
    } else if (labelMatches(label, ['private ip', '內部地址'])) {
      detail.privateIp = getListItemValue(item);
    } else if (labelMatches(label, ['price policy', '價格政策'])) {
      const priceItems = Array.from(item.querySelectorAll('ul li'))
        .map((li) => normalizeText(li.textContent ?? ''))
        .filter(Boolean);
      if (priceItems.length) {
        detail.pricePolicy = priceItems;
      }
    }
  });

  // Fallbacks：保險解析
  if (!detail.uptime) {
    const uptimeLi = topLevelItems.find((li) => /uptime|運行時間/i.test(li.textContent || ''));
    if (uptimeLi) {
      const badge = uptimeLi.querySelector('.badge');
      const raw = badge ? badge.textContent : uptimeLi.textContent;
      const text = normalizeText(raw || '');
      detail.uptime = normalizeText(text.replace(/^(?:uptime|運行時間)[:：]?\s*/i, ''));
    }
  }

  if (!detail.privateIp) {
    const privLi = topLevelItems.find((li) => /private\s*ip|內部地址/i.test(li.textContent || ''));
    if (privLi) {
      const text = normalizeText(privLi.textContent || '');
      detail.privateIp = normalizeText(text.replace(/^(?:private\s*ip|內部地址)[:：]?\s*/i, ''));
    }
  }

  if (!detail.pricePolicy.length) {
    detail.pricePolicy = Array.from(panel.querySelectorAll('ul > li ul li'))
      .map((li) => normalizeText(li.textContent ?? ''))
      .filter((text) => text && !/\.png$/i.test(text));
  }

  collectMetricImages(panel, detail.metrics);
  return detail;
}

function getListItemLabel(li) {
  if (!li) return '';
  const clone = li.cloneNode(true);
  clone.querySelectorAll('ul,ol,img').forEach((el) => el.remove());
  const strong = clone.querySelector('strong, b');
  let text = normalizeText(clone.textContent || '');
  if (strong && normalizeText(strong.textContent)) {
    return normalizeText(strong.textContent);
  }
  const colonMatch = text.match(/^([^:：]+)[:：]/);
  if (colonMatch) {
    return normalizeText(colonMatch[1]);
  }
  return normalizeText(text.split(/\s+/)[0] || text.slice(0, 16));
}

function getListItemValue(li) {
  if (!li) return '';
  const clone = li.cloneNode(true);
  clone.querySelectorAll('ul,ol').forEach((el) => el.remove());
  let text = normalizeText(clone.textContent || '');
  const colonIndex = text.search(/[:：]/);
  if (colonIndex !== -1) {
    return normalizeText(text.slice(colonIndex + 1));
  }
  const strong = clone.querySelector('strong, b');
  if (strong && normalizeText(strong.textContent)) {
    const label = normalizeText(strong.textContent);
    return normalizeText(text.replace(new RegExp(`^${label}\\s*`), ''));
  }
  return text;
}

function labelMatches(label, candidates) {
  const l = normalizeText(label || '').toLowerCase();
  return candidates.some((c) => {
    const cc = normalizeText(String(c) || '').toLowerCase();
    return l.includes(cc) || cc.includes(l);
  });
}

function collectMetricImages(panel, metricStore) {
  const images = Array.from(panel.querySelectorAll("img[src*='mongraph']"));
  images.forEach((img) => {
    const src = toAbsoluteUrl(img.getAttribute('src'));
    const title = resolveMetricTitle(img);
    const key = resolveMetricKeyFromSource(src, title);
    if (!key) return;
    metricStore[key] = {
      label: METRIC_LABELS[key],
      image: src,
      sortScore: computeMetricSortScore(src),
    };
  });
}

function resolveMetricTitle(img) {
  const container = img.closest('li') ?? img.parentElement;
  const clone = container ? container.cloneNode(true) : null;
  if (clone) {
    const nestedList = clone.querySelector('ul');
    if (nestedList) nestedList.remove();
  }
  return normalizeText(clone?.textContent ?? '');
}

function resolveMetricKeyFromSource(src, title) {
  if (/loadavg/i.test(src)) return 'congestion';
  if (/eth0|traffic|io/i.test(src)) return 'network';
  if (/proc|system/i.test(src) || /cpu/i.test(src)) return 'systemLoad';

  const matchedEntry = Object.entries(METRIC_IMAGE_LABELS).find(([, label]) =>
    label && title && title.toLowerCase().includes(label.toLowerCase())
  );
  return matchedEntry?.[0] ?? null;
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function computeMetricSortScore(url) {
  if (!url) return Number.MAX_SAFE_INTEGER;
  const match = url.match(/\/(\d+)_/);
  if (match) return parseInt(match[1], 10);
  return Number.MAX_SAFE_INTEGER - 5;
}

// ===== 解析：全域狀態頁 =====
function parseGlobalStatusHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const rows = Array.from(doc.querySelectorAll('#staticnodes_table tbody tr'));
  const metrics = new Map();

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;
    const onClick = cells[1].getAttribute('onClick') || '';
    const sidMatch = onClick.match(/openStatusWindow\((\d+)\)/i);
    if (!sidMatch) return;
    const sid = sidMatch[1];
    const systemLoadRaw = normalizeText(cells[2].textContent || '').replace(/\s+/g, '');
    const trafficRaw = normalizeText(cells[3].textContent || '');
    const congestionRaw = normalizeText(cells[4].textContent || '');

    const tuple = parseSystemLoadTuple(systemLoadRaw);
    const networkValue = parseFloat(trafficRaw.replace(/[^\d.\-]/g, ''));
    const congestionValue = parseFloat(congestionRaw.replace(/[^\d.\-]/g, ''));

    metrics.set(sid, {
      cpuLoadText: tuple[0]?.text ?? null,
      cpuLoadValue: tuple[0]?.value ?? null,
      ioWaitText: tuple[1]?.text ?? null,
      ioWaitValue: tuple[1]?.value ?? null,
      nicErrorText: tuple[2]?.text ?? null,
      nicErrorValue: tuple[2]?.value ?? null,
      networkText: trafficRaw || null,
      networkValue: Number.isFinite(networkValue) ? networkValue : null,
      congestionText: congestionRaw || null,
      congestionValue: Number.isFinite(congestionValue) ? congestionValue : null,
    });
  });

  return metrics;
}

function parseSystemLoadTuple(text) {
  if (!text) return [];
  const rawParts = text.split('/');
  const labels = ['CPU %', 'IO %', 'NIC'];
  const keys = ['cpu', 'io', 'nic'];
  return rawParts.map((part, index) => {
    const cleaned = part.replace(/<[^>]*>/g, '').trim();
    const numeric = parseFloat(cleaned.replace(/[^\d.\-]/g, ''));
    return {
      key: keys[index] ?? `part${index}`,
      text: cleaned || '—',
      value: Number.isFinite(numeric) ? numeric : null,
      label: labels[index] ?? `Part ${index + 1}`,
    };
  });
}

