// core.js
// DOM元素缓存 (只缓存核心需要的元素)
const CORE_DOM = {
    bookmarkTree: document.getElementById("bookmarkTree")
};

// 工具函数 (只包含核心需要的函数)
const CORE_UTILS = {
    createFavicon(url) {
        const icon = document.createElement("img");
        icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}`;
        icon.className = "favicon-icon";
        icon.onerror = () => { };
        return icon;
    }
};

/**
 * 创建书签列表项
 * @param   {Array}   nodes   -   书签节点数组
 * @param   {number}   level   -   当前层级
 * @returns   {Array<HTMLLIElement>}   书签列表项数组
 */
function createBookmarkList(nodes, level) {
    const items = [];
    if (!nodes) return items;

    nodes.forEach(node => {
        const li = document.createElement("li");
        li.className = `level-${level}`;

        const a = document.createElement("a");
        a.className = "menu-item";
        a.textContent = node.title || "(未命名)";

        if (node.url) {
            a.href = node.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.classList.add("bookmark-link");
            a.prepend(CORE_UTILS.createFavicon(node.url));
        }

        li.appendChild(a);

        if (node.children) {
            const subMenu = createBookmarkList(node.children, level + 1);
            const ul = document.createElement("ul");
            ul.className = "accordion-submenu";
            subMenu.forEach(item => ul.appendChild(item));
            li.appendChild(ul);
        }

        items.push(li);
    });

    return items;
}

/**
 * 渲染书签树
 * @param   {Array}   tree   -   书签树数据
 * @param   {HTMLElement}   container   -   书签容器元素
 */
function renderBookmarkTree(tree, container) {
    if (!tree || !container) {
        console.error("❌ 书签渲染失败");
        return;
    }

    container.innerHTML = "";
    const root = tree[0];
    const bar = root.children?.find(n => n.title === "书签栏" || n.title === "Bookmarks Bar");
    const children = bar?.children || root.children || []; // 避免 bar 为 undefined

    const bookmarkList = createBookmarkList(children, 2);
    bookmarkList.forEach(item => container.appendChild(item));

    bindFolderClickEvents("initial"); // 初始绑定
}

/**
 * 绑定文件夹点击事件
 * @param   {string}   calledFrom   -   调用来源（调试用）
 */
function bindFolderClickEvents(calledFrom) {
    let bindEventsTimeout;
    if (bindEventsTimeout) {
        clearTimeout(bindEventsTimeout);
    }
    bindEventsTimeout = setTimeout(() => {
        const folderLinks = document.querySelectorAll(".menu-item");
        folderLinks.forEach(a => {
            if (!a.parentElement) return;
            a.removeEventListener("click", setupFolderClick);
            a.addEventListener("click", setupFolderClick);
        });
    }, 100);
}

/**
 * 文件夹点击事件处理
 * @param   {Event}   e   -   点击事件
 */
function setupFolderClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleFolder(this.parentElement);
}

/**
 * 切换文件夹的展开/折叠状态
 * @param   {HTMLElement}   li   -   包含文件夹的li元素
 */
function toggleFolder(li) {
    const isOpen = li.classList.contains("open");
    const siblings = li.parentElement?.children || [];
    for (const sib of siblings) {
        if (sib !== li) sib.classList.remove("open");
    }
    if (isOpen) {
        li.classList.remove("open");
    } else {
        li.classList.add("open");
        // 向上展开所有父级
        let parent = li.parentElement;
        while (parent?.classList.contains("accordion-submenu")) {
            const container = parent.parentElement;
            if (container) container.classList.add("open");
            parent = container?.parentElement;
        }
        // 滚动到顶部
        li.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

// 导出核心功能函数
export {
    renderBookmarkTree,
    bindFolderClickEvents,
    toggleFolder
};