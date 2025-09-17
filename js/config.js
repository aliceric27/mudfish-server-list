// config.js - 設定與常數、DOM 元素選取器
// 職責：集中管理環境常數、API endpoint、localStorage key 與常用 DOM 元素。

// API endpoints
export const STATIC_NODES_ENDPOINT = "https://mudfish.net/api/staticnodes";
export const NODE_DETAIL_ENDPOINT = (sid) => `https://mudfish.net/admin/serverstatus/${sid}`;
export const GLOBAL_STATUS_ENDPOINT = "https://mudfish.net/server/status";

// localStorage keys
export const LS_CACHE_KEY = "mudfish_server_cache";
export const LS_FILTERS_KEY = "mudfish_user_filters";

// DOM elements (在 index.html 的 <script type="module"> 於 body 結尾載入，故此時 DOM 已可選取)
export const tableBody = document.getElementById("tableBody");
export const locationFilter = document.getElementById("locationFilter");
export const searchInput = document.getElementById("searchInput");
export const countryFilterContainer = document.getElementById("countryFilter");
export const countryToggle = document.getElementById("countryToggle");
export const hoverCard = document.getElementById("hoverCard");
export const hoverCardTemplate = document.getElementById("hoverCardTemplate");
export const cpuMaxFilter = document.getElementById("cpuMaxFilter");
export const ioMaxFilter = document.getElementById("ioMaxFilter");
export const nicMaxFilter = document.getElementById("nicMaxFilter");
export const congestionMaxFilter = document.getElementById("congestionMaxFilter");
export const bestServerBtn = document.getElementById("bestServerBtn");
export const resetFiltersBtn = document.getElementById("resetFiltersBtn");
export const pingAllBtn = document.getElementById("pingAllBtn");
export const langSelect = document.getElementById("langSelect");
