// i18n.js - 國際化模組
// 責任：維護 I18N 字典、目前語言、翻譯函數 t()、語言切換 setLanguage()、
// 以及將靜態文案套用到頁面上的 applyI18nStatic()

import { locationFilter, searchInput, langSelect, bestServerBtn, resetFiltersBtn, downloadSocks5Btn } from './config.js';

// 預設英語，若無使用者偏好且 IP 偵測失敗時使用
export let currentLang = 'en'; // zh | en | ja | ko

export const I18N = {
  zh: {
    title: 'Mudfish 伺服器狀態儀表板',
    subtitle: '查看全球節點狀態，並依位置與國家前綴快速篩選。',
    langLabel: '語言',
    provider: { filterLabel: '供應商篩選', all: '全部供應商' },
    search: { label: '關鍵字搜尋', placeholder: '主機名或 IP', aria: '輸入主機名或 IP 搜尋' },
    country: {
      all: '國家前綴（全部）',
      selected: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `國家前綴（已選 ${count}）`;
      },
    },
    load: { section: '系統負載篩選', aria: '系統負載數值篩選', cpu: 'CPU', io: 'IO', nic: '錯誤', congestion: '擁擠', any: '任意' },
    buttons: { best: '最佳伺服器', reset: '重置篩選', socks5Download: 'Socks5 設定檔下載' },
    socks5Modal: {
      title: 'Socks5 帳號密碼設定',
      username: '帳號',
      password: '密碼',
      port: '連接埠',
      download: '下載設定檔',
      cancel: '取消',
      ok: '確定',
      directDownload: '直接下載',
      messageTitle: '訊息',
      usernamePlaceholder: '請輸入 Socks5 帳號',
      passwordPlaceholder: '請輸入 Socks5 密碼',
      portPlaceholder: '預設 18081',
      confirmMessage: (count) => `即將下載 ${count} 個節點的 Socks5 設定檔。\n\n是否要填入帳號密碼？\n（選擇「直接下載」將不包含帳號密碼欄位）`,
  // 移除驗證模式顯示
  downloadSuccess: (count) => `✅ 下載成功！\n\n已產生 ${count} 個節點的 Socks5 設定檔`,
      downloadError: (error) => `❌ 下載失敗\n\n${error}`,
    },
    table: {
      headers: { region: '位置', provider: '供應商', ip: 'IPv4', sid: '節點 SID', cpu: 'CPU %', ioWait: 'IO 等待 %', nicError: '網卡錯誤數', network: '流量 (MB)', congestion: '擁擠度' },
      loading: '正在載入資料…',
      empty: '找不到符合條件的節點。',
    },
    errors: { loadFailed: '無法取得伺服器資料,請稍後再試。', noNodesFiltered: '沒有可用的節點，請調整篩選條件' },
    metricLabels: { systemLoad: '系統負載', network: '流量', congestion: '擁擠度' },
    metricImageLabels: { systemLoad: '系統負載圖表', network: '流量趨勢圖', congestion: '擁擠度趨勢圖' },
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
    map: {
      title: 'Mudfish 全球節點地圖',
      subtitle: '以 OpenStreetMap 與 Leaflet 即時檢視 Mudfish 伺服器位置與健康狀態。',
      back: '← 返回表格儀表板',
      sidebarTitle: '節點清單',
      sidebarHint: '點擊地圖上的國家節點以檢視城市與伺服器明細',
      placeholder: '請點擊地圖上的國家節點以檢視其伺服器列表。',
      selection: {
        none: '尚未選取國家',
        count: (value) => {
          const count = typeof value === 'number' ? value : value?.count ?? 0;
          return `${count} 台伺服器`;
        },
      },
      popupCount: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `${count} 台伺服器`;
      },
      pagination: {
        summary: ({ page, totalPages, start, end, total }) => `第 ${page} / ${totalPages} 頁 · 顯示 ${start}-${end} / ${total} 台`,
        prev: '上一頁',
        next: '下一頁',
      },
      statuses: {
        normal: '運作正常',
        congested: '伺服器壅擠',
        error: '伺服器錯誤',
        unknown: '狀態未知',
      },
      congestionLabel: '擁擠度：',
      markerTitle: ({ country, status, count }) => `${country}：${status}（${count} 台）`,
      serverTitle: ({ location, sid }) => `${location}（SID ${sid}）`,
      paginationAria: '節點分頁導航',
    },
  },
  en: {
    title: 'Mudfish Server Status Dashboard',
    subtitle: 'View global nodes and filter by provider and country prefix.',
    langLabel: 'Language',
    provider: { filterLabel: 'Provider Filter', all: 'All Providers' },
    search: { label: 'Search', placeholder: 'Hostname or IP', aria: 'Type hostname or IP to search' },
    country: {
      all: 'Country Prefix (All)',
      selected: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `Country Prefix (Selected ${count})`;
      },
    },
    load: { section: 'System Load Filters', aria: 'System load value filters', cpu: 'CPU', io: 'IO', nic: 'Errors', congestion: 'Congestion', any: 'Any' },
    buttons: { best: 'Best Server', reset: 'Reset Filters', socks5Download: 'Download Socks5 Config' },
    socks5Modal: {
      title: 'Socks5 Credentials Settings',
      username: 'Username',
      password: 'Password',
      port: 'Port',
      download: 'Download Config',
      cancel: 'Cancel',
      ok: 'OK',
      directDownload: 'Direct Download',
      messageTitle: 'Message',
      usernamePlaceholder: 'Enter Socks5 username',
      passwordPlaceholder: 'Enter Socks5 password',
      portPlaceholder: 'Default 18081',
      confirmMessage: (count) => `About to download Socks5 config for ${count} nodes.\n\nDo you want to include credentials?\n(Click "Direct Download" to skip username/password fields)`,
  // Authentication line removed per requirement
  downloadSuccess: (count) => `✅ Download Successful!\n\nGenerated Socks5 config for ${count} nodes`,
      downloadError: (error) => `❌ Download Failed\n\n${error}`,
    },
    table: {
      headers: { region: 'Region', provider: 'Provider', ip: 'IPv4', sid: 'Node SID', cpu: 'CPU %', ioWait: 'IO Wait %', nicError: 'NIC Errors', network: 'Traffic (MB)', congestion: 'Congestion' },
      loading: 'Loading…',
      empty: 'No matching nodes found.',
    },
    errors: { loadFailed: 'Failed to fetch data. Please try again later.', noNodesFiltered: 'No nodes available. Please adjust filter conditions' },
    metricLabels: { systemLoad: 'System Load', network: 'Traffic', congestion: 'Congestion' },
    metricImageLabels: { systemLoad: 'System Load Chart', network: 'Traffic Trend', congestion: 'Congestion Trend' },
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
    map: {
      title: 'Mudfish Global Node Map',
      subtitle: 'Inspect Mudfish server locations and health in real time with OpenStreetMap and Leaflet.',
      back: '← Back to Dashboard',
      sidebarTitle: 'Node List',
      sidebarHint: 'Select a country marker on the map to view city and server details.',
      placeholder: 'Click a country marker to view its server list.',
      selection: {
        none: 'No country selected',
        count: (value) => {
          const count = typeof value === 'number' ? value : value?.count ?? 0;
          return `${count} servers`;
        },
      },
      popupCount: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `${count} servers`;
      },
      pagination: {
        summary: ({ page, totalPages, start, end, total }) => `Page ${page} / ${totalPages} · Showing ${start}-${end} of ${total}`,
        prev: 'Previous',
        next: 'Next',
      },
      statuses: {
        normal: 'Online',
        congested: 'Congested',
        error: 'Server Error',
        unknown: 'Unknown',
      },
      congestionLabel: 'Congestion: ',
      markerTitle: ({ country, status, count }) => `${country}: ${status} (${count} servers)`,
      serverTitle: ({ location, sid }) => `${location} (SID ${sid})`,
      paginationAria: 'Node list pagination',
    },
  },
  ja: {
    title: 'Mudfish サーバーステータス ダッシュボード',
    subtitle: 'グローバルノードを表示し、プロバイダーや国コードで絞り込み。',
    langLabel: '言語',
    provider: { filterLabel: 'プロバイダー', all: 'すべてのプロバイダー' },
    search: { label: '検索', placeholder: 'ホスト名 または IP', aria: 'ホスト名または IP を入力' },
    country: {
      all: '国コード（すべて）',
      selected: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `国コード（${count} 件選択）`;
      },
    },
    load: { section: 'システム負荷フィルター', aria: 'システム負荷の数値フィルター', cpu: 'CPU', io: 'IO', nic: 'エラー', congestion: '混雑度', any: '指定なし' },
    buttons: { best: '最適サーバー', reset: 'フィルターをリセット', socks5Download: 'Socks5 設定ダウンロード' },
    socks5Modal: {
      title: 'Socks5 認証情報設定',
      username: 'ユーザー名',
      password: 'パスワード',
      port: 'ポート',
      download: '設定ファイルをダウンロード',
      cancel: 'キャンセル',
      ok: 'OK',
      directDownload: '直接ダウンロード',
      messageTitle: 'メッセージ',
      usernamePlaceholder: 'Socks5 ユーザー名を入力',
      passwordPlaceholder: 'Socks5 パスワードを入力',
      portPlaceholder: 'デフォルト 18081',
      confirmMessage: (count) => `${count} 個のノードの Socks5 設定をダウンロードします。\n\n認証情報を含めますか？\n（「直接ダウンロード」を選択するとユーザー名/パスワードフィールドは含まれません）`,
  // 認証行削除
  downloadSuccess: (count) => `✅ ダウンロード成功！\n\n${count} 個のノードの Socks5 設定を生成しました`,
      downloadError: (error) => `❌ ダウンロード失敗\n\n${error}`,
    },
    table: {
      headers: { region: '位置', provider: 'プロバイダー', ip: 'IPv4', sid: 'ノード SID', cpu: 'CPU %', ioWait: 'IO 待機 %', nicError: 'NIC エラー数', network: 'トラフィック (MB)', congestion: '混雑度' },
      loading: '読み込み中…',
      empty: '一致するノードがありません。',
    },
    errors: { loadFailed: 'データの取得に失敗しました。しばらくしてからお試しください。', noNodesFiltered: '利用可能なノードがありません。フィルター条件を調整してください' },
    metricLabels: { systemLoad: 'システム負荷', network: 'トラフィック', congestion: '混雑度' },
    metricImageLabels: { systemLoad: 'システム負荷グラフ', network: 'トラフィック推移', congestion: '混雑度推移' },
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
    map: {
      title: 'Mudfish グローバルノードマップ',
      subtitle: 'OpenStreetMap と Leaflet で Mudfish サーバーの位置と状態をリアルタイムに確認。',
      back: '← ダッシュボードへ戻る',
      sidebarTitle: 'ノード一覧',
      sidebarHint: '地図上の国マーカーをクリックすると都市とサーバー詳細を表示します',
      placeholder: '国マーカーをクリックしてサーバー一覧を表示してください。',
      selection: {
        none: '国が選択されていません',
        count: (value) => {
          const count = typeof value === 'number' ? value : value?.count ?? 0;
          return `${count} 台のサーバー`;
        },
      },
      popupCount: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `${count} 台のサーバー`;
      },
      pagination: {
        summary: ({ page, totalPages, start, end, total }) => `ページ ${page} / ${totalPages} · ${start}-${end} / ${total} 件を表示`,
        prev: '前へ',
        next: '次へ',
      },
      statuses: {
        normal: '正常',
        congested: '混雑',
        error: 'サーバーエラー',
        unknown: '不明',
      },
      congestionLabel: '混雑度：',
      markerTitle: ({ country, status, count }) => `${country}：${status}（${count} 台）`,
      serverTitle: ({ location, sid }) => `${location}（SID ${sid}）`,
      paginationAria: 'ノード一覧のページ切り替え',
    },
  },
  ko: {
    title: 'Mudfish 서버 상태 대시보드',
    subtitle: '전 세계 노드를 확인하고 제공업체와 국가 접두어로 필터링하세요.',
    langLabel: '언어',
    provider: { filterLabel: '제공업체 필터', all: '모든 제공업체' },
    search: { label: '검색', placeholder: '호스트명 또는 IP', aria: '호스트명 또는 IP 입력' },
    country: {
      all: '국가 접두어(전체)',
      selected: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `국가 접두어(${count}개 선택)`;
      },
    },
    load: { section: '시스템 부하 필터', aria: '시스템 부하 값 필터', cpu: 'CPU', io: 'IO', nic: '오류', congestion: '혼잡도', any: '제한 없음' },
    buttons: { best: '최적 서버', reset: '필터 초기화', socks5Download: 'Socks5 설정 다운로드' },
    socks5Modal: {
      title: 'Socks5 인증 정보 설정',
      username: '사용자명',
      password: '비밀번호',
      port: '포트',
      download: '설정 파일 다운로드',
      cancel: '취소',
      ok: '확인',
      directDownload: '직접 다운로드',
      messageTitle: '메시지',
      usernamePlaceholder: 'Socks5 사용자명 입력',
      passwordPlaceholder: 'Socks5 비밀번호 입력',
      portPlaceholder: '기본값 18081',
      confirmMessage: (count) => `${count}개 노드의 Socks5 설정을 다운로드합니다.\n\n인증 정보를 포함하시겠습니까?\n("직접 다운로드"를 선택하면 사용자명/비밀번호 필드가 포함되지 않습니다)`,
  // 인증 표시 제거
  downloadSuccess: (count) => `✅ 다운로드 성공!\n\n${count}개 노드의 Socks5 설정을 생성했습니다`,
      downloadError: (error) => `❌ 다운로드 실패\n\n${error}`,
    },
    table: {
      headers: { region: '위치', provider: '제공업체', ip: 'IPv4', sid: '노드 SID', cpu: 'CPU %', ioWait: 'IO 대기 %', nicError: 'NIC 오류 수', network: '트래픽 (MB)', congestion: '혼잡도' },
      loading: '로딩 중…',
      empty: '일치하는 노드가 없습니다.',
    },
    errors: { loadFailed: '데이터를 가져오지 못했습니다. 잠시 후 다시 시도하세요.', noNodesFiltered: '사용 가능한 노드가 없습니다. 필터 조건을 조정하세요' },
    metricLabels: { systemLoad: '시스템 부하', network: '트래픽', congestion: '혼잡도' },
    metricImageLabels: { systemLoad: '시스템 부하 차트', network: '트래픽 추이', congestion: '혼잡도 추이' },
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
    map: {
      title: 'Mudfish 글로벌 노드 지도',
      subtitle: 'OpenStreetMap과 Leaflet으로 Mudfish 서버 위치와 상태를 실시간 확인하세요.',
      back: '← 대시보드로 돌아가기',
      sidebarTitle: '노드 목록',
      sidebarHint: '지도에서 국가 마커를 선택하면 도시와 서버 상세 정보를 볼 수 있습니다.',
      placeholder: '국가 마커를 클릭하여 해당 서버 목록을 확인하세요.',
      selection: {
        none: '선택된 국가가 없습니다',
        count: (value) => {
          const count = typeof value === 'number' ? value : value?.count ?? 0;
          return `${count}대 서버`;
        },
      },
      popupCount: (value) => {
        const count = typeof value === 'number' ? value : value?.count ?? 0;
        return `${count}대 서버`;
      },
      pagination: {
        summary: ({ page, totalPages, start, end, total }) => `페이지 ${page} / ${totalPages} · ${start}-${end} / ${total}대 서버 표시`,
        prev: '이전',
        next: '다음',
      },
      statuses: {
        normal: '정상',
        congested: '혼잡',
        error: '서버 오류',
        unknown: '상태 미확인',
      },
      congestionLabel: '혼잡도: ',
      markerTitle: ({ country, status, count }) => `${country}: ${status} (${count}대)`,
      serverTitle: ({ location, sid }) => `${location} (SID ${sid})`,
      paginationAria: '노드 목록 페이지 탐색',
    },
  },
};

export function t(path, vars) {
  const segs = path.split('.');
  let cur = I18N[currentLang] || I18N.zh;
  for (const s of segs) cur = cur?.[s];
  if (typeof cur === 'function') {
    if (vars != null && typeof vars === 'object' && !Array.isArray(vars)) {
      return cur(vars);
    }
    return cur(vars ?? 0);
  }
  if (cur == null) {
    cur = I18N.zh;
    for (const s of segs) cur = cur?.[s];
    if (typeof cur === 'function') {
      if (vars != null && typeof vars === 'object' && !Array.isArray(vars)) {
        return cur(vars);
      }
      return cur(vars ?? 0);
    }
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
  updateSharedLanguageControls();
  applyDashboardStatic();
  applyMapStatic();
}

function updateSharedLanguageControls() {
  const langLabelEl = document.querySelector('label[for="langSelect"]');
  if (langLabelEl) langLabelEl.textContent = t('langLabel');
  if (langSelect) langSelect.setAttribute('aria-label', t('langLabel'));
}

function applyDashboardStatic() {
  const root = document.querySelector('main.page:not(.page--map)');
  if (!root) return;

  const titleEl = root.querySelector('.page__title');
  if (titleEl) titleEl.textContent = t('title');
  const subEl = root.querySelector('.page__subtitle');
  if (subEl) subEl.textContent = t('subtitle');

  const provLabel = root.querySelector('label[for="locationFilter"]');
  if (provLabel) provLabel.textContent = t('provider.filterLabel');
  const allOpt = locationFilter?.querySelector?.('option[value="all"]');
  if (allOpt) allOpt.textContent = t('provider.all');

  const searchLabel = root.querySelector('label[for="searchInput"]');
  if (searchLabel) searchLabel.textContent = t('search.label');
  if (searchInput) {
    searchInput.placeholder = t('search.placeholder');
    searchInput.setAttribute('aria-label', t('search.aria'));
  }

  const loadLabel = root.querySelector('.controls__group--load .controls__label');
  if (loadLabel) loadLabel.textContent = t('load.section');
  const cpuL = root.querySelector('label[for="cpuMaxFilter"]');
  if (cpuL) cpuL.childNodes[0].textContent = `${t('load.cpu')} ≤\n            `;
  const ioL = root.querySelector('label[for="ioMaxFilter"]');
  if (ioL) ioL.childNodes[0].textContent = `${t('load.io')} ≤\n            `;
  const nicL = root.querySelector('label[for="nicMaxFilter"]');
  if (nicL) nicL.childNodes[0].textContent = `${t('load.nic')} ≤\n            `;
  const congL = root.querySelector('label[for="congestionMaxFilter"]');
  if (congL) congL.childNodes[0].textContent = `${t('load.congestion')} ≤\n            `;
  root.querySelectorAll('.load-filter__input').forEach((inp) => inp.setAttribute('placeholder', t('load.any')));
  const loadGroup = root.querySelector('.load-filter');
  if (loadGroup) loadGroup.setAttribute('aria-label', t('load.aria'));

  if (bestServerBtn) bestServerBtn.textContent = t('buttons.best');
  if (resetFiltersBtn) resetFiltersBtn.textContent = t('buttons.reset');
  if (downloadSocks5Btn) downloadSocks5Btn.textContent = t('buttons.socks5Download');

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
  };
  root.querySelectorAll('#serverTable thead th[data-sort-key]').forEach((th) => {
    const key = th.getAttribute('data-sort-key');
    if (key && headerMap[key]) th.textContent = headerMap[key];
  });

}

function applyMapStatic() {
  const root = document.querySelector('main.page--map');
  if (!root) return;

  const titleEl = root.querySelector('.page__title');
  if (titleEl) titleEl.textContent = t('map.title');
  const subEl = root.querySelector('.page__subtitle');
  if (subEl) subEl.textContent = t('map.subtitle');
  const backLink = root.querySelector('.page__link-back');
  if (backLink) backLink.textContent = t('map.back');

  const sidebarTitle = root.querySelector('.map-sidebar__title');
  if (sidebarTitle) sidebarTitle.textContent = t('map.sidebarTitle');
  const sidebarHint = root.querySelector('#mapSidebarHint');
  if (sidebarHint) sidebarHint.textContent = t('map.sidebarHint');

  const selectionLabel = root.querySelector('[data-selection-label]');
  if (selectionLabel) selectionLabel.textContent = t('map.selection.none');
  const selectionCount = root.querySelector('[data-selection-count]');
  if (selectionCount) selectionCount.textContent = '—';

  root.querySelectorAll('.map-city-list__pagination').forEach((nav) => {
    nav.setAttribute('aria-label', t('map.paginationAria'));
  });
}
