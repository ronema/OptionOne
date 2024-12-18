console.log("[Modal] Content script loaded");

// 创建并显示模态对话框
function createModal(data) {
    console.log("[Modal] Creating modal...");

    // 检查是否已经存在模态框
    const existingOverlay = document.querySelector('.onetab-modal-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'onetab-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(32px);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 100px;
        z-index: 999999;
    `;

    const modal = document.createElement('div');
    modal.className = 'onetab-modal';
    modal.style.cssText = `
        background: rgba(40, 43, 50, 0.95);
        backdrop-filter: blur(40px);
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
        position: relative;
        width: 680px;
    `;

    let allHistoryItems = []; // 存储所有历史记录

    // 获取历史记录
    const getHistory = () => {
        chrome.runtime.sendMessage({ type: 'getHistory' }, (historyItems) => {
            allHistoryItems = historyItems;
            if (historyItems.length === 0) {
                const noHistoryMessage = document.createElement('div');
                noHistoryMessage.textContent = '你的浏览器没有任何浏览痕迹';
                noHistoryMessage.style.cssText = `
                    padding: 20px;
                    text-align: center;
                    color: #ffffff;
                    font-size: 18px;
                `;
                modal.appendChild(noHistoryMessage);
            } else {
                populateList(historyItems);
            }
        });
    };

    // 搜索功能
    const filterItems = (query) => {
        if (!query) {
            populateList(allHistoryItems);
            return;
        }
        const filtered = allHistoryItems.filter(item => 
            item.title?.toLowerCase().includes(query.toLowerCase()) ||
            item.url.toLowerCase().includes(query.toLowerCase())
        );
        populateList(filtered);
    };

    // 创建搜索输入框
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'onetab-search';
    search.placeholder = 'Search history...';
    search.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #2d3238;
        background: #23272e;
        color: white;
        font-size: 14px;
        outline: none;
    `;

    // 自动聚焦到搜索框
    setTimeout(() => {
        search.focus();
    }, 100);

    // 添加搜索事件监听
    search.addEventListener('input', (e) => {
        filterItems(e.target.value);
    });

    // 添加快捷键支持
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
        }
    });

    const list = document.createElement('ul');
    list.className = 'onetab-list';
    list.style.cssText = `
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        margin: 0;
        padding: 8px 12px; 
        border-radius: 10px;
        list-style: none;
        background: rgba(30, 33, 40, 0.95); 
        margin-top: 8px;
    `;

    // 填充列表的函数
    const populateList = (items) => {
        list.innerHTML = ''; // 清空现有项
        items.forEach(site => {
            const item = document.createElement('li');
            item.className = 'onetab-item';
            item.style.cssText = `
                margin-bottom: 8px;
                background: #23272e;
                border-radius: 6px;
                transition: all 0.2s ease;
                margin: 8px 0;
            `;

            const link = document.createElement('a');
            link.href = site.url;
            link.className = 'onetab-link';
            link.style.cssText = `
                display: flex;
                align-items: center;
                padding: 12px;
                color: rgba(255, 255, 255, 0.9);
                text-decoration: none;
                transition: all 0.2s ease;
                gap: 12px;
                background: #23272e;
                border-radius: 6px;
                font-size: 14px;
            `;

            // 创建图标元素
            const createLetterIcon = (title) => {
                const firstLetter = document.createElement('div');
                firstLetter.textContent = title.charAt(0).toUpperCase();
                firstLetter.style.cssText = `
                    width: 16px;
                    height: 16px;
                    min-width: 16px;
                    background: #3d4451;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.9);
                    margin-right: 8px;
                `;
                return firstLetter;
            };

            // 尝试获取网站图标
            const getFavicon = (url, title) => {
                const favicon = document.createElement('img');
                favicon.style.cssText = `
                    width: 16px;
                    height: 16px;
                    min-width: 16px;
                    border-radius: 4px;
                    margin-right: 8px;
                `;
                
                try {
                    const urlObj = new URL(url);
                    
                    // 检查是否是本地地址
                    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                        return createLetterIcon(title); // 返回字母图标
                    }

                    // 使用 HTTPS 协议
                    favicon.src = `https://${urlObj.hostname}/favicon.ico`;
                    
                    favicon.onerror = () => {
                        link.prepend(createLetterIcon(title));
                        favicon.remove();
                    };
                    
                    return favicon;
                } catch (e) {
                    return createLetterIcon(title);
                }
            };

            const icon = getFavicon(site.url, site.title);
            link.prepend(icon);

            const text = document.createElement('span');
            text.textContent = site.title || site.url;
            text.style.cssText = `
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #ffffff;
            `;

            link.appendChild(text);

            link.onmouseover = () => {
                link.style.background = '#2d3238';
            };
            
            link.onmouseout = () => {
                link.style.background = '#23272e';
            };

            link.onclick = (e) => {
                e.preventDefault();
                chrome.runtime.sendMessage({ type: 'openTab', url: site.url });
                overlay.remove();
            };

            item.appendChild(link);
            list.appendChild(item);
        });
    };

    modal.appendChild(search);
    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 添加滚动条样式
    const style = document.createElement('style');
    style.textContent = `
        .onetab-list::-webkit-scrollbar {
            width: 6px;
        }
        .onetab-list::-webkit-scrollbar-track {
            background: transparent;
        }
        .onetab-list::-webkit-scrollbar-thumb {
            background: #2d3238;
            border-radius: 3px;
        }
        .onetab-list::-webkit-scrollbar-thumb:hover {
            background: #363b42;
        }
    `;
    document.head.appendChild(style);

    // 点击背景关闭模态框
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };

    getHistory(); // Initial population
}

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Modal] Message received:", message);
    if (message.type === 'SHOW_MODAL') {
        createModal(message.data);
    }
});
