// i18n.js - 國際化模組
// 責任：維護 I18N 字典、目前語言、翻譯函數 t()、語言切換 setLanguage()、
// 以及將靜態文案套用到頁面上的 applyI18nStatic()

import { locationFilter, searchInput, langSelect, bestServerBtn, resetFiltersBtn } from './config.js';

// 預設英語，若無使用者偏好且 IP 偵測失敗時使用
export let currentLang = 'en'; // zh | en | ja | ko

export const I18N = {
  zh: {
    title: 'Mudfish 伺服器狀態儀表板',
    subtitle: '查看全球節點狀態，並依位置與國家前綴快速篩選。',
    langLabel: '語言',
    provider: { filterLabel: '供應商篩選', all: '全部供應商' },
    search: { label: '關鍵字搜尋', placeholder: '主機名或 IP', aria: '輸入主機名或 IP 搜尋' },
    country: { all: '國家前綴（全部）', selected: (n) => `國家前綴（已選 ${n}）` },
    load: { section: '系統負載篩選', aria: '系統負載數值篩選', cpu: 'CPU', io: 'IO', nic: '錯誤', congestion: '擁擠', any: '任意' },
    buttons: { best: '最佳伺服器', reset: '重置篩選', ping: '檢測', pingAll: '檢測所有伺服器延遲' },
    table: {
      headers: { region: '位置', provider: '供應商', ip: 'IPv4', sid: '節點 SID', cpu: 'CPU %', ioWait: 'IO 等待 %', nicError: '網卡錯誤數', network: '流量 (MB)', congestion: '擁擠度', ping: '延遲 (ms)' },
      loading: '正在載入資料…',
      empty: '找不到符合條件的節點。',
    },
    errors: { loadFailed: '無法取得伺服器資料，請稍後再試。' },
    metricLabels: { systemLoad: '系統負載', network: '流量', congestion: '擁擠度' },
    metricImageLabels: { systemLoad: '系統負載圖表', network: '流量趨勢圖', congestion: '擁擠度趨勢圖' },
    ping: { testing: '測試中…', timeout: '逾時', na: '—' },
    usage: {
      heading: '使用方式',
      items: [
        '將滑鼠移至任一列，可即時抓取詳細伺服器狀態並顯示。',
        '表格會在節點進入視窗時自動下載詳細資料並更新系統負載、流量與擁擠度欄位。',
        '下拉選單可依不同地區查看節點，搜尋欄支援主機名與 IP，國家前綴可多選。',
      ],
    },
    hover: {
      labels: {
        ipv4: 'IPv4',
        sid: '節點 SID',
        status: '狀態',
        privateIp: '內部地址',
        uptime: '運行時間',
        heartbeat: '心跳',
        pricePolicy: '價格政策',
        cpu: 'CPU %',
        ioWait: 'IO 等待 %',
        nicError: '網卡錯誤數',
        network: '流量 (MB)',
        congestion: '擁擠度',
      },
      fetching: '正在擷取詳細資料…',
      firstLoadHint: '首次載入約需 1-2 秒',
      fetchTimePrefix: '資料擷取時間：',
      liveSource: '即時資料來源：Mudfish',
      fetchFailed: '無法取得詳細資料',
      retryLater: '請稍後再試或檢查網路連線',
      noDetails: '暫無詳細資料',
      chartAlt: '圖表',
    },
  },
  en: {
    title: 'Mudfish Server Status Dashboard',
    subtitle: 'View global nodes and filter by provider and country prefix.',
    langLabel: 'Language',
    provider: { filterLabel: 'Provider Filter', all: 'All Providers' },
    search: { label: 'Search', placeholder: 'Hostname or IP', aria: 'Type hostname or IP to search' },
    country: { all: 'Country Prefix (All)', selected: (n) => `Country Prefix (Selected ${n})` },
    load: { section: 'System Load Filters', aria: 'System load value filters', cpu: 'CPU', io: 'IO', nic: 'Errors', congestion: 'Congestion', any: 'Any' },
    buttons: { best: 'Best Server', reset: 'Reset Filters', ping: 'Test', pingAll: 'Test Latency For All' },
    table: {
      headers: { region: 'Region', provider: 'Provider', ip: 'IPv4', sid: 'Node SID', cpu: 'CPU %', ioWait: 'IO Wait %', nicError: 'NIC Errors', network: 'Traffic (MB)', congestion: 'Congestion', ping: 'Latency (ms)' },
      loading: 'Loading…',
      empty: 'No matching nodes found.',
    },
    errors: { loadFailed: 'Failed to fetch data. Please try again later.' },
    metricLabels: { systemLoad: 'System Load', network: 'Traffic', congestion: 'Congestion' },
    metricImageLabels: { systemLoad: 'System Load Chart', network: 'Traffic Trend', congestion: 'Congestion Trend' },
    ping: { testing: 'Testing…', timeout: 'Timeout', na: '—' },
    usage: {
      heading: 'How to Use',
      items: [
        'Hover over any row to fetch and display detailed server status instantly.',
        'As rows enter the viewport, the table auto-fetches details and updates load, traffic and congestion columns.',
        'Use filters to narrow by provider and country prefix; the search supports hostname and IP; multiple country prefixes are supported.',
      ],
    },
    hover: {
      labels: {
        ipv4: 'IPv4',
        sid: 'Node SID',
        status: 'Status',
        privateIp: 'Private IP',
        uptime: 'Uptime',
        heartbeat: 'Heartbeat',
        pricePolicy: 'Price Policy',
        cpu: 'CPU %',
        ioWait: 'IO Wait %',
        nicError: 'NIC Errors',
        network: 'Traffic (MB)',
        congestion: 'Congestion',
      },
      fetching: 'Fetching details…',
      firstLoadHint: 'First load takes ~1–2s',
      fetchTimePrefix: 'Fetched at: ',
      liveSource: 'Live Source: Mudfish',
      fetchFailed: 'Failed to fetch details',
      retryLater: 'Please retry later or check your connection',
      noDetails: 'No details available',
      chartAlt: 'Chart',
    },
  },
  ja: {
    title: 'Mudfish サーバーステータス ダッシュボード',
    subtitle: 'グローバルノードを表示し、プロバイダーや国コードで絞り込み。',
    langLabel: '言語',
    provider: { filterLabel: 'プロバイダー', all: 'すべてのプロバイダー' },
    search: { label: '検索', placeholder: 'ホスト名 または IP', aria: 'ホスト名または IP を入力' },
    country: { all: '国コード（すべて）', selected: (n) => `国コード（${n} 件選択）` },
    load: { section: 'システム負荷フィルター', aria: 'システム負荷の数値フィルター', cpu: 'CPU', io: 'IO', nic: 'エラー', congestion: '混雑度', any: '指定なし' },
    buttons: { best: '最適サーバー', reset: 'フィルターをリセット', ping: 'テスト', pingAll: '全件レイテンシー測定' },
    table: {
      headers: { region: '位置', provider: 'プロバイダー', ip: 'IPv4', sid: 'ノード SID', cpu: 'CPU %', ioWait: 'IO 待機 %', nicError: 'NIC エラー数', network: 'トラフィック (MB)', congestion: '混雑度', ping: 'レイテンシー (ms)' },
      loading: '読み込み中…',
      empty: '一致するノードがありません。',
    },
    errors: { loadFailed: 'データの取得に失敗しました。しばらくしてからお試しください。' },
    metricLabels: { systemLoad: 'システム負荷', network: 'トラフィック', congestion: '混雑度' },
    metricImageLabels: { systemLoad: 'システム負荷グラフ', network: 'トラフィック推移', congestion: '混雑度推移' },
    ping: { testing: '計測中…', timeout: 'タイムアウト', na: '—' },
    usage: {
      heading: '使い方',
      items: [
        '任意の行にマウスオーバーすると、サーバー詳細が即時に取得・表示されます。',
        '行がビューポートに入ると、自動的に詳細を取得し、負荷・トラフィック・混雑度の列を更新します。',
        'プロバイダーや国コードで絞り込み、検索はホスト名と IP をサポート。国コードは複数選択可能です。',
      ],
    },
    hover: {
      labels: {
        ipv4: 'IPv4',
        sid: 'ノード SID',
        status: 'ステータス',
        privateIp: 'プライベート IP',
        uptime: '稼働時間',
        heartbeat: 'ハートビート',
        pricePolicy: '価格ポリシー',
        cpu: 'CPU %',
        ioWait: 'IO 待機 %',
        nicError: 'NIC エラー数',
        network: 'トラフィック (MB)',
        congestion: '混雑度',
      },
      fetching: '詳細を取得中…',
      firstLoadHint: '初回読み込みは約1～2秒',
      fetchTimePrefix: '取得時刻：',
      liveSource: 'ライブソース：Mudfish',
      fetchFailed: '詳細を取得できませんでした',
      retryLater: 'しばらくしてから再試行するか接続を確認してください',
      noDetails: '詳細はありません',
      chartAlt: 'チャート',
    },
  },
  ko: {
    title: 'Mudfish 서버 상태 대시보드',
    subtitle: '전 세계 노드를 확인하고 제공업체와 국가 접두어로 필터링하세요.',
    langLabel: '언어',
    provider: { filterLabel: '제공업체 필터', all: '모든 제공업체' },
    search: { label: '검색', placeholder: '호스트명 또는 IP', aria: '호스트명 또는 IP 입력' },
    country: { all: '국가 접두어(전체)', selected: (n) => `국가 접두어(${n}개 선택)` },
    load: { section: '시스템 부하 필터', aria: '시스템 부하 값 필터', cpu: 'CPU', io: 'IO', nic: '오류', congestion: '혼잡도', any: '제한 없음' },
    buttons: { best: '최적 서버', reset: '필터 초기화', ping: '측정', pingAll: '모두 지연 측정' },
    table: {
      headers: { region: '위치', provider: '제공업체', ip: 'IPv4', sid: '노드 SID', cpu: 'CPU %', ioWait: 'IO 대기 %', nicError: 'NIC 오류 수', network: '트래픽 (MB)', congestion: '혼잡도', ping: '지연시간 (ms)' },
      loading: '로딩 중…',
      empty: '일치하는 노드가 없습니다.',
    },
    errors: { loadFailed: '데이터를 가져오지 못했습니다. 잠시 후 다시 시도하세요.' },
    metricLabels: { systemLoad: '시스템 부하', network: '트래픽', congestion: '혼잡도' },
    metricImageLabels: { systemLoad: '시스템 부하 차트', network: '트래픽 추이', congestion: '혼잡도 추이' },
    ping: { testing: '측정 중…', timeout: '시간 초과', na: '—' },
    usage: {
      heading: '사용 방법',
      items: [
        '임의의 행에 마우스를 올리면 서버 상세 정보가 즉시 표시됩니다.',
        '행이 화면에 들어오면 자동으로 상세 정보를 가져와 부하/트래픽/혼잡도 열을 갱신합니다.',
        '제공업체와 국가 접두어로 필터링하고, 검색은 호스트명과 IP 를 지원합니다. 국가 접두어는 다중 선택이 가능합니다.',
      ],
    },
    hover: {
      labels: {
        ipv4: 'IPv4',
        sid: '노드 SID',
        status: '상태',
        privateIp: '프라이빗 IP',
        uptime: '업타임',
        heartbeat: '하트비트',
        pricePolicy: '요금 정책',
        cpu: 'CPU %',
        ioWait: 'IO 대기 %',
        nicError: 'NIC 오류 수',
        network: '트래픽 (MB)',
        congestion: '혼잡도',
      },
      fetching: '상세 정보를 가져오는 중…',
      firstLoadHint: '첫 로드는 약 1–2초 소요',
      fetchTimePrefix: '가져온 시각: ',
      liveSource: '라이브 소스: Mudfish',
      fetchFailed: '상세 정보를 가져오지 못했습니다',
      retryLater: '잠시 후 다시 시도하거나 연결을 확인하세요',
      noDetails: '표시할 상세 정보 없음',
      chartAlt: '차트',
    },
  },
};

export function t(path, vars) {
  const segs = path.split('.');
  let cur = I18N[currentLang] || I18N.zh;
  for (const s of segs) cur = cur?.[s];
  if (typeof cur === 'function') return cur(vars?.count ?? vars ?? 0);
  if (cur == null) {
    cur = I18N.zh;
    for (const s of segs) cur = cur?.[s];
  }
  return cur ?? path;
}

export let METRIC_LABELS = { ...I18N.zh.metricLabels };
export let METRIC_IMAGE_LABELS = { ...I18N.zh.metricImageLabels };

export function setLanguage(lang) {
  if (!I18N[lang]) lang = 'zh';
  currentLang = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
  if (langSelect) langSelect.value = lang;
  METRIC_LABELS = { ...I18N[lang].metricLabels };
  METRIC_IMAGE_LABELS = { ...I18N[lang].metricImageLabels };
  applyI18nStatic();
}

export function applyI18nStatic() {
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
  document.querySelectorAll('.load-filter__input').forEach((inp) => inp.setAttribute('placeholder', t('load.any')));
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
    ping: t('table.headers.ping'),
  };
  document.querySelectorAll('#serverTable thead th[data-sort-key]').forEach((th) => {
    const key = th.getAttribute('data-sort-key');
    if (headerMap[key]) th.textContent = headerMap[key];
  });

  // Usage section (page footer)
  const usageHeading = document.querySelector('.page__footer h2');
  if (usageHeading) usageHeading.textContent = t('usage.heading');
  const usageList = document.querySelectorAll('.page__footer ul li');
  const items = (I18N[currentLang]?.usage?.items) || I18N.zh.usage.items;
  if (usageList && usageList.length) {
    usageList.forEach((li, idx) => {
      if (items[idx]) li.textContent = items[idx];
    });
  }
}
