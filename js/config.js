// config.js - 設定與常數、DOM 元素選取器
// 職責：集中管理環境常數、API endpoint、localStorage key 與常用 DOM 元素。

// API endpoints
const API_BASE_URL = "https://mud-server-list.aliceric27.workers.dev";
export const STATIC_NODES_ENDPOINT = `${API_BASE_URL}/staticnodes`;
export const GLOBAL_STATUS_ENDPOINT = `${API_BASE_URL}/server-status`;
export const NODE_DETAIL_ENDPOINT = (sid) => `${API_BASE_URL}/server-status/${sid}`;

// localStorage keys
export const LS_CACHE_KEY = "mudfish_server_cache";
export const LS_FILTERS_KEY = "mudfish_user_filters";

// DOM elements (在 index.html 的 <script type="module"> 於 body 結尾載入，故此時 DOM 已可選取)
export const tableBody = document.getElementById("tableBody");
export const locationFilter = document.getElementById("locationFilter");
export const searchInput = document.getElementById("searchInput");
export const countryFilterContainer = document.getElementById("countryFilter");
export const countryToggle = document.getElementById("countryToggle");
export const cpuMaxFilter = document.getElementById("cpuMaxFilter");
export const ioMaxFilter = document.getElementById("ioMaxFilter");
export const nicMaxFilter = document.getElementById("nicMaxFilter");
export const congestionMaxFilter = document.getElementById("congestionMaxFilter");
export const bestServerBtn = document.getElementById("bestServerBtn");
export const resetFiltersBtn = document.getElementById("resetFiltersBtn");
export const downloadSocks5Btn = document.getElementById("downloadSocks5Btn");
export const langSelect = document.getElementById("langSelect");

// Socks5 Modal elements
export const socks5Modal = document.getElementById("socks5Modal");
export const socks5ModalClose = document.getElementById("socks5ModalClose");
export const socks5ModalCancel = document.getElementById("socks5ModalCancel");
export const socks5ModalDownload = document.getElementById("socks5ModalDownload");
export const socks5Username = document.getElementById("socks5Username");
export const socks5Password = document.getElementById("socks5Password");
export const socks5Port = document.getElementById("socks5Port");
