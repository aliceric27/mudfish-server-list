// socks5.js - Socks5 設定檔生成與下載模組

/**
 * 將節點列表轉換為 Clash YAML 格式的 Socks5 設定檔
 * @param {Array} nodes - 節點列表
 * @param {string} username - Socks5 使用者名稱（空字串表示不使用驗證）
 * @param {string} password - Socks5 密碼（空字串表示不使用驗證）
 * @param {number} port - Socks5 連接埠（預設 18081）
 * @returns {string} YAML 格式的設定內容
 */
export function generateClashSocks5Config(nodes, username = '', password = '', port = 18081) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('沒有可用的節點資料');
  }

  // 正規化輸入（避免傳入 null / undefined / 非字串）
  const userStr = (username ?? '').toString().trim();
  const passStr = (password ?? '').toString().trim();
  const portNum = parseInt(port, 10) || 18081;

  // 判斷是否需要驗證（帳號與密碼都不可為空白字串）
  const needsAuth = userStr.length > 0 && passStr.length > 0;

  // 調試輸出（僅在需要時可手動打開）
  // console.debug('[Socks5Config] needsAuth:', needsAuth, 'username:', userStr, 'passwordLength:', passStr.length);

  // 生成 YAML 標頭
  let yaml = '# Clash Socks5 代理設定檔\n';
  yaml += `# 產生時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n`;
  yaml += `# 節點數量: ${nodes.length}\n`;
  yaml += `# 驗證模式: ${needsAuth ? '需要帳號密碼' : '無需驗證'}\n\n`;
  
  yaml += '# 代理伺服器列表\n';
  yaml += 'proxies:\n';

  // 為每個節點生成 Socks5 設定
  const formatNodeName = (node) => node.location || node.locationRegion || `Node-${node.sid}`;

  nodes.forEach((node) => {
    const name = formatNodeName(node);
    const ip = node.ip;
    
    if (!ip) {
      console.warn(`節點 ${node.sid} 缺少 IP 位址，已跳過`);
      return;
    }

    yaml += `  - name: "${name}"\n`;
    yaml += `    type: socks5\n`;
    yaml += `    server: "${ip}"\n`;
  yaml += `    port: ${portNum}\n`;
    
    // 只有在需要驗證時才添加帳號密碼欄位
    if (needsAuth) {
      yaml += `    username: "${userStr}"\n`;
      yaml += `    password: "${passStr}"\n`;
    }
    
    yaml += `    # sid: ${node.sid}\n`;
    yaml += `    # hostname: ${node.hostname}\n`;
    yaml += '\n';
  });

  // 添加代理組設定
  yaml += '# 代理組設定\n';
  yaml += 'proxy-groups:\n';
  yaml += '  - name: "Mudfish-Auto"\n';
  yaml += '    type: url-test\n';
  yaml += '    proxies:\n';
  
  nodes.forEach((node) => {
    const name = formatNodeName(node);
    if (node.ip) {
      yaml += `      - "${name}"\n`;
    }
  });
  
  yaml += '    url: "http://www.gstatic.com/generate_204"\n';
  yaml += '    interval: 300\n\n';

  yaml += '  - name: "Mudfish-Select"\n';
  yaml += '    type: select\n';
  yaml += '    proxies:\n';
  
  nodes.forEach((node) => {
    const name = formatNodeName(node);
    if (node.ip) {
      yaml += `      - "${name}"\n`;
    }
  });

  return yaml;
}

/**
 * 下載文字內容為檔案
 * @param {string} content - 檔案內容
 * @param {string} filename - 檔案名稱
 * @param {string} mimeType - MIME 類型
 */
export function downloadFile(content, filename = 'config.yaml', mimeType = 'text/yaml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // 清理
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 產生並下載 Clash Socks5 設定檔
 * @param {Array} nodes - 篩選後的節點列表
 * @param {Object} options - 設定選項
 */
export function downloadClashSocks5Config(nodes, options = {}) {
  const {
    username = '',
    password = '',
    port = 18081,
    filename = `mudfish-socks5-${new Date().toISOString().split('T')[0]}.yaml`
  } = options;

  try {
    const yamlContent = generateClashSocks5Config(nodes, username, password, port);
    downloadFile(yamlContent, filename, 'text/yaml');
    return true;
  } catch (error) {
    console.error('產生設定檔時發生錯誤:', error);
    alert(`產生設定檔失敗: ${error.message}`);
    return false;
  }
}
