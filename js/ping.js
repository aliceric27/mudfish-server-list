// ping.js - 在瀏覽器以 Image 請求近似量測延遲（無法做真正 ICMP）
// 使用方式：
//   import { pingHost } from './ping.js';
//   const ms = await pingHost('1.2.3.4', { attempts: 3, timeoutMs: 3000 });
// 策略：
// - 以 Image 請求 `${protocol}://${host}/favicon.ico?cb=<ts>` 量測往返
// - 每次量測逾時則視為 timeout；回傳時取最小值較接近 RTT

export async function pingHost(host, { attempts = 3, timeoutMs = 3000 } = {}) {
  const protocol = location.protocol === 'https:' ? 'https' : 'http';
  const tryOnce = () => new Promise((resolve) => {
    const img = new Image();
    const start = performance.now();
    let done = false;

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve(timeoutMs);
    }, timeoutMs);

    img.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(Math.max(0, performance.now() - start));
    };
    img.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(Math.max(0, performance.now() - start));
    };
    // cache-busting
    img.src = `${protocol}://${host}/favicon.ico?cb=${Date.now()}_${Math.random()}`;
  });

  const results = [];
  for (let i = 0; i < attempts; i++) {
    // 兩次間隔 120ms，降低偶發抖動
    const ms = await tryOnce();
    results.push(ms);
    await new Promise(r => setTimeout(r, 120));
  }
  // 取最小值較貼近 RTT 下界
  return Math.min(...results);
}

