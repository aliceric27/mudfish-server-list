// ping.js - 使用 Fetch API 近似量測延遲（瀏覽器無法執行 ICMP Ping）
// 使用方式：
//   import { pingHost } from './ping.js';
//   const ms = await pingHost('1.2.3.4', { attempts: 3, timeoutMs: 3000 });
// 策略：
// - 以 Fetch 發送 `GET` 請求至 `${protocol}://${host}/favicon.ico`，並加入 cache-busting
// - 透過 AbortController 實作逾時，並取多次測量的最小值作為結果
// - 在跨網域無 CORS 標頭時使用 `mode: "no-cors"`，以確保請求仍可發出

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_DELAY_MS = 120;
const DEFAULT_PATH = '/favicon.ico';

export async function pingHost(
  host,
  {
    attempts = DEFAULT_ATTEMPTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    delayMs = DEFAULT_DELAY_MS,
    path = DEFAULT_PATH,
  } = {},
) {
  if (!host) {
    throw new Error('pingHost requires a hostname or IP');
  }

  const protocol = self.location?.protocol === 'https:' ? 'https' : 'http';
  const sanitizedPath = normalizePath(path);

  const rtts = [];
  for (let i = 0; i < attempts; i++) {
    const url = buildPingUrl(protocol, host, sanitizedPath);
    const ms = await fetchOnce(url, timeoutMs);
    rtts.push(ms);
    if (i < attempts - 1) {
      await wait(delayMs);
    }
  }

  const best = Math.min(...rtts);
  return Number.isFinite(best) ? best : timeoutMs;
}

function normalizePath(path) {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function buildPingUrl(protocol, host, path) {
  const cacheBuster = `cb=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${protocol}://${host}${path}${separator}${cacheBuster}`;
}

async function fetchOnce(url, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const start = performance.now();

  let timerId;
  if (controller) {
    timerId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller?.signal,
    });
    return Math.max(0, performance.now() - start);
  } catch (error) {
    if (error.name === 'AbortError') {
      return timeoutMs;
    }
    // 針對 Mixed Content 或 TLS 失敗等情況，回傳量測時間或逾時值
    const elapsed = Math.max(0, performance.now() - start);
    return elapsed > 0 ? elapsed : timeoutMs;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}

function wait(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

