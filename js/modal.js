// modal.js - Modal 對話框管理模組

// 已改為動態查找 DOM，不再直接使用 config.js 匯入的節點參考，避免 innerHTML 破壞引用。
// 若未來需要初始化副作用，可再解開下列匯入。
// import { socks5Modal, socks5ModalClose, socks5ModalCancel, socks5ModalDownload, socks5Username, socks5Password, socks5Port } from './config.js';

import { t } from './i18n.js';

// 常數定義
const FOCUS_DELAY = 100; // 聚焦延遲（避免動畫或重繪尚未完成）
const DEBUG_LEVEL = 0;   // 0=關閉, 1=基本, 2=詳細

function debug(level, ...args) {
  if (level <= DEBUG_LEVEL && DEBUG_LEVEL > 0) {
    // eslint-disable-next-line no-console
    console.log('[Modal]', ...args);
  }
}

let activeCleanup = null;          // 通用清理函數（事件、焦點陷阱）
let focusTrapCleanup = null;       // 焦點陷阱清理
let previousActiveElement = null;  // 關閉時還原焦點
let currentModalType = null;       // 'socks5' | 'confirm' | 'message'

// 基礎模板（載入後第一次取得，用於還原）
let BASELINE_TEMPLATE = null; // { body, footer }

function ensureBaselineTemplate() {
  if (BASELINE_TEMPLATE) return BASELINE_TEMPLATE;
  const body = document.querySelector('.modal__body');
  const footer = document.querySelector('.modal__footer');
  BASELINE_TEMPLATE = {
    body: body ? body.innerHTML : '',
    footer: footer ? footer.innerHTML : ''
  };
  return BASELINE_TEMPLATE;
}

function restoreBaselineTemplate() {
  const body = document.querySelector('.modal__body');
  const footer = document.querySelector('.modal__footer');
  const title = document.querySelector('.modal__title');
  if (!BASELINE_TEMPLATE) return;
  if (body) body.innerHTML = BASELINE_TEMPLATE.body;
  if (footer) footer.innerHTML = BASELINE_TEMPLATE.footer;
  if (title) title.textContent = t('socks5Modal.title');
}

function restoreTemplate(original, elements) {
  const { bodyEl, footerEl, titleEl } = elements || getModalElements();
  if (original && original.bodyHTML != null && original.footerHTML != null) {
    if (bodyEl) bodyEl.innerHTML = original.bodyHTML;
    if (footerEl) footerEl.innerHTML = original.footerHTML;
  } else {
    restoreBaselineTemplate();
  }
  if (titleEl) titleEl.textContent = t('socks5Modal.title');
}

function renderMessage(container, type, message) {
  if (!container) return;
  const wrapper = document.createElement('div');
  wrapper.className = `modal__message modal__message--${type}`;
  message.split('\n').forEach(line => {
    const p = document.createElement('p');
    p.textContent = line; // 避免 XSS
    wrapper.appendChild(p);
  });
  container.replaceChildren(wrapper);
}

function setupAria(modalEl, describedById) {
  if (!modalEl) return;
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  const titleEl = modalEl.querySelector('.modal__title');
  if (titleEl) {
    if (!titleEl.id) titleEl.id = 'socks5ModalTitle';
    modalEl.setAttribute('aria-labelledby', titleEl.id);
  }
  if (describedById) {
    modalEl.setAttribute('aria-describedby', describedById);
  } else {
    modalEl.removeAttribute('aria-describedby');
  }
}

function setupFocusTrap(modalEl) {
  if (!modalEl) return () => {};
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const list = Array.from(focusable).filter(el => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

/**
 * 更新 Modal 的多語言文字
 */
export function updateModalI18n() {
  // 每次都重新獲取元素，避免 innerHTML 替換導致的引用失效
  const modalTitle = document.querySelector('.modal__title');
  const usernameLabel = document.querySelector('label[for="socks5Username"]');
  const passwordLabel = document.querySelector('label[for="socks5Password"]');
  const portLabel = document.querySelector('label[for="socks5Port"]');
  const downloadBtn = document.getElementById('socks5ModalDownload');
  const cancelBtn = document.getElementById('socks5ModalCancel');
  const usernameInput = document.getElementById('socks5Username');
  const passwordInput = document.getElementById('socks5Password');
  const portInput = document.getElementById('socks5Port');

  if (modalTitle) modalTitle.textContent = t('socks5Modal.title');
  if (usernameLabel) usernameLabel.textContent = t('socks5Modal.username');
  if (passwordLabel) passwordLabel.textContent = t('socks5Modal.password');
  if (portLabel) portLabel.textContent = t('socks5Modal.port');
  if (downloadBtn) downloadBtn.textContent = t('socks5Modal.download');
  if (cancelBtn) cancelBtn.textContent = t('socks5Modal.cancel');

  if (usernameInput) usernameInput.placeholder = t('socks5Modal.usernamePlaceholder');
  if (passwordInput) passwordInput.placeholder = t('socks5Modal.passwordPlaceholder');
  if (portInput) portInput.placeholder = t('socks5Modal.portPlaceholder');
}

/**
 * 顯示 Socks5 設定 Modal
 * @param {Object} defaultValues - 預設值 { username, password, port }
 * @returns {Promise<Object|null>} 返回使用者輸入的值或 null（取消）
 */
export function showSocks5Modal(defaultValues = {}) {
  return openModal({
    type: 'socks5',
    title: t('socks5Modal.title'),
    formDefaults: defaultValues
  });
}

/**
 * 關閉 Socks5 Modal
 */
export function closeSocks5Modal() { // 保留向後相容名稱
  closeModal();
}

function closeModal() {
  const { modalEl } = getModalElements();
  if (modalEl) modalEl.hidden = true;
  if (activeCleanup) { activeCleanup(); activeCleanup = null; }
  if (focusTrapCleanup) { focusTrapCleanup(); focusTrapCleanup = null; }
  if (previousActiveElement && typeof previousActiveElement.focus === 'function') previousActiveElement.focus();
  previousActiveElement = null;
  currentModalType = null;
  // 移除 aria-describedby（避免殘留）
  if (modalEl) modalEl.removeAttribute('aria-describedby');
}

/**
 * 顯示確認對話框（使用原生 confirm）
 * @param {string} message - 提示訊息
 * @returns {Promise<boolean>} 使用者是否確認
 * @deprecated 請使用 showConfirmModal 替代
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const result = window.confirm(message);
    resolve(result);
  });
}

/**
 * 顯示確認對話框 Modal
 * @param {Object} options - 選項 { title, message, confirmText, cancelText }
 * @returns {Promise<boolean|null>} 使用者選擇（true=確定, false=直接下載, null=取消）
 */
export function showConfirmModal(options = {}) {
  const { title = t('socks5Modal.messageTitle'), message = '', confirmText = t('socks5Modal.ok') || '確定', cancelText = t('socks5Modal.directDownload') || '直接下載' } = options;
  return openModal({
    type: 'confirm',
    title,
    message,
    messageType: 'info',
    buttons: [
      { id: 'confirmModalCancel', text: cancelText, class: 'modal__button modal__button--danger', value: false },
      { id: 'confirmModalOk', text: confirmText, class: 'modal__button modal__button--primary', value: true }
    ],
    cancelValue: null,
    focusSelector: '#confirmModalOk'
  });
}

/**
 * 顯示訊息提示 Modal
 * @param {Object} options - 選項 { title, message, type }
 * @returns {Promise<void>}
 */
export function showMessageModal(options = {}) {
  const { title = t('socks5Modal.messageTitle'), message = '', type = 'success' } = options;
  return openModal({
    type: 'message',
    title,
    message,
    messageType: type,
    buttons: [
      { id: 'messageModalOk', text: t('socks5Modal.ok') || '確定', class: 'modal__button modal__button--primary', value: undefined }
    ],
    cancelValue: undefined,
    focusSelector: '#messageModalOk'
  });
}

// 通用：取得當前 Modal 主要元素
function getModalElements() {
  return {
    modalEl: document.getElementById('socks5Modal'),
    closeBtn: document.getElementById('socks5ModalClose'),
    bodyEl: document.querySelector('.modal__body'),
    footerEl: document.querySelector('.modal__footer'),
    titleEl: document.querySelector('.modal__title')
  };
}

/**
 * 通用 Modal 開啟
 * @param {Object} config
 * @param {'socks5'|'confirm'|'message'} config.type
 * @param {String} config.title
 * @param {String} [config.message]
 * @param {'info'|'success'|'error'} [config.messageType]
 * @param {Array<{id:string,text:string,class?:string,value:any}>} [config.buttons]
 * @param {*} [config.cancelValue]  ESC / X / overlay 回傳值
 * @param {String} [config.focusSelector]
 * @param {Object} [config.formDefaults]  (type=socks5)
 * @returns {Promise<any>}
 */
export function openModal(config) {
  ensureBaselineTemplate();
  const elements = getModalElements();
  const { modalEl, bodyEl, footerEl, titleEl, closeBtn } = elements;
  if (!modalEl) return Promise.reject(new Error('Modal element not found'));

  return new Promise((resolve) => {
    previousActiveElement = document.activeElement;
    currentModalType = config.type;

    // 保存原始內容（用於非 socks5 類型還原）
    const original = {
      bodyHTML: bodyEl ? bodyEl.innerHTML : '',
      footerHTML: footerEl ? footerEl.innerHTML : ''
    };

    // 依類型建立內容
    if (config.type === 'socks5') {
      // 還原 baseline（包含原本的帳號/密碼/port 欄位與按鈕）
      restoreTemplate(null, elements);
      updateModalI18n();
      const u = document.getElementById('socks5Username');
      const p = document.getElementById('socks5Password');
      const port = document.getElementById('socks5Port');
      if (u) u.value = config.formDefaults?.username || '';
      if (p) p.value = config.formDefaults?.password || '';
      if (port) port.value = config.formDefaults?.port || 18081;
    } else {
      // 覆寫 body/ footer
      if (titleEl) titleEl.textContent = config.title || '';
      if (bodyEl) {
        const msgId = `modalMessage-${Date.now()}`;
        renderMessage(bodyEl, config.messageType || 'info', config.message || '');
        const wrapper = bodyEl.querySelector('.modal__message');
        if (wrapper) wrapper.id = msgId;
        setupAria(modalEl, msgId);
      }
      if (footerEl && Array.isArray(config.buttons)) {
        footerEl.innerHTML = config.buttons.map(btn => `<button id="${btn.id}" class="${btn.class || 'modal__button'}" type="button">${btn.text}</button>`).join('');
      }
    }

    // 顯示與 ARIA（socks5 類型尚未設定 describedby，此處補）
    if (config.type === 'socks5') setupAria(modalEl, null);
    modalEl.hidden = false;
    focusTrapCleanup = setupFocusTrap(modalEl);

    // 建立事件處理
    const overlayHandler = (e) => { if (e.target === modalEl) finalize(config.cancelValue); };
    const escHandler = (e) => { if (e.key === 'Escape') finalize(config.cancelValue); };

    const buttonHandlers = [];
    if (config.type === 'socks5') {
      const downloadBtn = document.getElementById('socks5ModalDownload');
      const cancelBtn = document.getElementById('socks5ModalCancel');
      const closeX = closeBtn;
      const u = document.getElementById('socks5Username');
      const p = document.getElementById('socks5Password');
      const port = document.getElementById('socks5Port');
      const confirmFn = () => finalize({ username: u?.value?.trim() || '', password: p?.value?.trim() || '', port: parseInt(port?.value, 10) || 18081 });
      const cancelFn = () => finalize(null);
      downloadBtn?.addEventListener('click', confirmFn);
      cancelBtn?.addEventListener('click', cancelFn);
      closeX?.addEventListener('click', cancelFn);
      buttonHandlers.push(() => { downloadBtn?.removeEventListener('click', confirmFn); cancelBtn?.removeEventListener('click', cancelFn); closeX?.removeEventListener('click', cancelFn); });
      setTimeout(() => (u || downloadBtn)?.focus(), FOCUS_DELAY);
    } else if (Array.isArray(config.buttons)) {
      config.buttons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (!el) return;
        const handler = () => finalize(btn.value);
        el.addEventListener('click', handler);
        buttonHandlers.push(() => el.removeEventListener('click', handler));
      });
      if (closeBtn) {
        const closeHandler = () => finalize(config.cancelValue);
        closeBtn.addEventListener('click', closeHandler);
        buttonHandlers.push(() => closeBtn.removeEventListener('click', closeHandler));
      }
      setTimeout(() => {
        const focusTarget = config.focusSelector ? modalEl.querySelector(config.focusSelector) : modalEl.querySelector('.modal__button--primary, button');
        if (focusTarget) focusTarget.focus();
      }, FOCUS_DELAY);
    }

    modalEl.addEventListener('click', overlayHandler);
    document.addEventListener('keydown', escHandler);

    function finalize(value) {
      // 還原模板（非 socks5 類型才需要）
      if (config.type !== 'socks5') restoreTemplate(original, elements);
      closeModal();
      resolve(value);
    }

    activeCleanup = () => {
      modalEl.removeEventListener('click', overlayHandler);
      document.removeEventListener('keydown', escHandler);
      buttonHandlers.forEach(off => off());
    };
  });
}
