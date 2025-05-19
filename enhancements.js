// enhancements.js
import { renderBookmarkTree } from './core.js'; // 导入核心渲染函数

// DOM元素缓存
const ENHANCEMENTS_DOM = {
    topBarTitle: document.querySelector(".top-bar-title"),
    searchIcon: document.querySelector(".search-icon"),
    searchBox: document.querySelector(".search-box"),
    exportBtn: document.getElementById("export-btn"),
    syncBtn: document.getElementById("more-btn"),
    settingsBtn: document.getElementById("more-settings"),
    bookmarkContainer: document.getElementById("bookmark-container")
};

// 工具函数
const ENHANCEMENTS_UTILS = {
    flattenNodes(nodes, level) {
        const results = [];
        if (!nodes) return results;

        nodes.forEach(node => {
            const flatNode = {
                title: node.title || "(未命名)",
                url: node.url,
                level,
                originalNode: node
            };
            results.push(flatNode);
            if (node.children) {
                results.push(...this.flattenNodes(node.children, level + 1));
            }
        });

        return results;
    }
};

const GITHUB_API_BASE = "https://api.github.com";
const MESSAGES = {
    CONFIG_REQUIRED: "❌ 请先在设置页面填写完整 GitHub 配置信息！",
    SYNC_SUCCESS: "✅ 书签同步成功",
    SYNC_FAILED: "❌ 书签同步失败",
    EXPORT_SUCCESS: "✅ 书签导出成功",
    RENDER_ERROR: "❌ 书签渲染失败"
};

const fileInput = document.getElementById("bookmark-file");
const importBtn = document.getElementById("import-btn");
const uploadBtn = document.getElementById("upload");

let rawJSON = "";
let allNodes = [];
let originalBookmarkTreeHTML = "";
let observer = null;
let bindEventsTimeout = null; // 用于防抖

const Enhancements = {
    init() {
        this.setupTopBar();
        this.setupImportExport();
        this.setupGitHubSync();
        this.setupSettings();
        this.observeBookmarkTree();
    },

    setupTopBar() {
        ENHANCEMENTS_DOM.topBarTitle?.addEventListener("click", () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
        });

        ENHANCEMENTS_DOM.searchIcon?.addEventListener("click", this.toggleSearch.bind(this));
        ENHANCEMENTS_DOM.searchBox?.addEventListener("blur", this.handleSearchBlur.bind(this));
        ENHANCEMENTS_DOM.searchBox?.addEventListener("input", this.handleSearchInput.bind(this));

        window.addEventListener("resize", this.toggleTitleVisibility.bind(this));
    },

    setupImportExport() {
        importBtn?.addEventListener("click", () => fileInput?.click());
        fileInput?.addEventListener("change", this.handleFileChange.bind(this));
        exportBtn?.addEventListener("click", this.handleExport.bind(this));
    },

    setupGitHubSync() {
        ENHANCEMENTS_DOM.syncBtn?.addEventListener("click", GitHubSync.sync.bind(GitHubSync));
    },

    setupSettings() {
        ENHANCEMENTS_DOM.settingsBtn?.addEventListener("click", () => {
            chrome.runtime.openOptionsPage();
        });
    },

    toggleSearch() {
        ENHANCEMENTS_DOM.searchIcon.style.display = "none";
        ENHANCEMENTS_DOM.searchBox.style.display = "block";
        ENHANCEMENTS_DOM.searchBox.focus();
        this.toggleTitleVisibility();
    },

    handleSearchBlur() {
        if (!ENHANCEMENTS_DOM.searchBox.value) {
            ENHANCEMENTS_DOM.searchBox.style.display = "none";
            ENHANCEMENTS_DOM.searchIcon.style.display = "block";
            this.toggleTitleVisibility();
        }
    },

    async handleSearchInput(e) {
        const keyword = e.target.value.trim();
        if (keyword) {
            const results = await this.searchBookmarks(keyword);
            await renderBookmarkTree(results, CORE_DOM.bookmarkTree); // 使用核心渲染函数
        } else {
            await this.renderFullBookmarks();
        }
    },

    toggleTitleVisibility() {
        if (window.innerWidth <= 480) {
            ENHANCEMENTS_DOM.topBarTitle.style.display = ENHANCEMENTS_DOM.searchBox.style.display === "block" ? "none" : "flex";
        } else {
            ENHANCEMENTS_DOM.topBarTitle.style.display = "flex";
        }
    },

    async handleFileChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            rawJSON = await file.text();
            const jsonData = JSON.parse(rawJSON);
            await this.renderBookmarks(jsonData);
        } catch (error) {
            console.error("文件读取或解析失败", error);
            alert("文件读取或解析失败，请检查文件格式！");
        }
    },

    async renderBookmarks(tree, container = CORE_DOM.bookmarkTree) { // 使用核心DOM
        if (!tree || !container) {
            alert(MESSAGES.RENDER_ERROR);
            return;
        }

        originalBookmarkTreeHTML = container.innerHTML;
        allNodes = ENHANCEMENTS_UTILS.flattenNodes(tree, 2);
        await renderBookmarkTree(tree, container); // 使用核心渲染函数
    },

    async renderFullBookmarks() {
        chrome.bookmarks.getTree(async (tree) => {
            await this.renderBookmarks(tree);
        });
    },

    async searchBookmarks(keyword) {
        return allNodes.filter(node => node.title.includes(keyword));
    },

    async exportBookmarks() {
        const tree = await chrome.bookmarks.getTree();
        const json = JSON.stringify(tree, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bookmarks.json";
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ☁️ 点击导出按钮 → 导出书签为JSON文件
ENHANCEMENTS_DOM.exportBtn?.addEventListener("click", async () => {
    try {
        const password = prompt("请输入导出密码：");
        if (!password) {
            alert("导出已取消。");
            return;
        }

        const response = await fetch("http://localhost:3000/verifyPassword", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        if (data.success) {
            await Enhancements.exportBookmarks();
            alert(MESSAGES.EXPORT_SUCCESS);
        } else {
            alert("密码错误，导出已取消。");
        }
    } catch (error) {
        console.error("密码验证失败", error);
        alert("网络错误，请稍后再试！");
    }
});

// GitHub 同步相关代码 (保持不变，但移到 enhancements.js)
const GitHubSync = {
    async sync() {
        const config = await chrome.storage.local.get([
            "github_username",
            "github_repo",
            "github_token",
            "github_filename"
        ]);

        const { github_username, github_repo, github_token, github_filename } = config;

        if (!github_username || !github_repo || !github_token || !github_filename) {
            alert(MESSAGES.CONFIG_REQUIRED);
            return;
        }

        const path = `data/${github_filename}`;
        const url = `${GITHUB_API_BASE}/repos/${github_username}/${github_repo}/contents/${path}`;

        const tree = await chrome.bookmarks.getTree();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(tree, null, 2))));

        let sha = null;
        try {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${config.github_token}` }
            });
            if (res.ok) {
                const json