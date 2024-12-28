console.log("[Background] Script loaded");

// 在文件开头添加工具函数
const CONSTANTS = {
    MAX_HISTORY_RESULTS: 1000,
    INTERNAL_URLS: ['chrome://', 'edge://', 'about:', 'chrome-extension://']
};

// 工具函数
const utils = {
    isInternalPage(url) {
        return CONSTANTS.INTERNAL_URLS.some(prefix => url.startsWith(prefix));
    },

    async getHistoryItems() {
        try {
            // 并行获取历史记录和书签
            const [historyItems, bookmarks] = await Promise.all([
                // 获取历史记录
                new Promise((resolve) => {
                    chrome.history.search({
                        text: '',              
                        maxResults: 100,       
                        startTime: 0           
                    }, async (items) => {
                        const itemsWithVisits = await Promise.all(
                            items.map(async (item) => {
                                const visits = await new Promise((resolve) => {
                                    chrome.history.getVisits({ url: item.url }, (visits) => {
                                        resolve(visits);
                                    });
                                });
                                return {
                                    ...item,
                                    visitCount: visits.length,
                                    type: 'history'
                                };
                            })
                        );
                        resolve(itemsWithVisits);
                    });
                }),
                // 获取所有书签
                new Promise((resolve) => {
                    chrome.bookmarks.getTree((tree) => {
                        const bookmarkItems = [];
                        
                        function traverseBookmarks(node) {
                            if (node.url) {  // 如果节点有 URL，说明是书签而不是文件夹
                                bookmarkItems.push({
                                    id: node.id,
                                    title: node.title,
                                    url: node.url,
                                    lastVisitTime: node.dateAdded,
                                    visitCount: 1,
                                    type: 'bookmark'
                                });
                            }
                            if (node.children) {  // 如果有子节点，递归遍历
                                node.children.forEach(traverseBookmarks);
                            }
                        }
                        
                        // 遍历整个书签树
                        tree.forEach(traverseBookmarks);
                        console.log('Found bookmarks:', bookmarkItems.length);
                        resolve(bookmarkItems);
                    });
                })
            ]);

            // 合并并排序结果
            const allItems = [...historyItems, ...bookmarks];
            console.log('Total items:', allItems.length, 'History:', historyItems.length, 'Bookmarks:', bookmarks.length);
            return allItems.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
        } catch (error) {
            console.error('Error getting items:', error);
            return historyItems || [];
        }
    }
};

// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// 显示模态框
async function showModal(tab) {
    try {
        const historyItems = await utils.getHistoryItems();
        console.log('History results:', historyItems);

        // 如果是内部页面，直接返回
        if (utils.isInternalPage(tab.url)) {
            return; // 不做任何处理
        }

        // 只处理普通页面
        await handleNormalPage(tab, historyItems);
    } catch (error) {
        console.error('Error showing modal:', error);
    }
}

async function handleNormalPage(tab, historyItems) {
    try {
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['modal.css']
        });

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['modal.js']
        });

        await chrome.tabs.sendMessage(tab.id, {
            type: 'SHOW_MODAL',
            data: historyItems
        });
    } catch (error) {
        console.error('Failed to handle normal page:', error);
    }
}

// 监听图标点击
chrome.action.onClicked.addListener(async (tab) => {
    // 如果是 Chrome 内部页面，直接返回
    if (tab.url.startsWith('chrome://')) {
        return;
    }
    
    console.log('Icon clicked');
    await showModal(tab);
});

// 处理快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 如果是 Chrome 内部页面，直接返回
    if (tab.url.startsWith('chrome://')) {
        return;
    }

    switch (command) {
        case '_execute_action':
            await handleExecuteAction(tab);
            break;
    }
});

async function handleExecuteAction(tab) {
    try {
        const historyItems = await utils.getHistoryItems();
        
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['modal.js']
        });

        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            css: `
                .onetab-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 999999;
                }
            `
        });

        await chrome.tabs.sendMessage(tab.id, {
            type: 'showModal',
            data: historyItems
        });
    } catch (error) {
        console.error('Failed to handle execute action:', error);
        await chrome.tabs.create({ 
            url: 'popup.html',
            active: true
        });
    }
}

// 修改消息处理部分
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 保持消息通道开放以处理异步响应
    try {
        switch (request.type) {
            case 'getHistory':
                handleGetHistory(sendResponse);
                return true;  // 保持通道开放以等待异步响应
                
            case 'openTab':
                // openTab 可以同步处理
                handleOpenTab(request.url).then(result => {
                    sendResponse(result);
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;  // 保持通道开放以等待 Promise
                
            case 'cleanTabs':
                handleCleanTabs(sendResponse);
                return true;  // 保持通道开放以等待异步响应
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }
});

// 修改打开标签页的处理函数
async function handleOpenTab(url) {
    try {
        // 特殊处理新标签页
        if (url === 'chrome://newtab') {
            const tab = await chrome.tabs.create({});  // 不指定 URL 就会打开新标签页
            return { success: true, tab };
        }

        // 检查是否已经有相同URL的标签页
        const existingTabs = await chrome.tabs.query({ url: url });
        if (existingTabs.length > 0) {
            // 如果存在，激活第一个找到的标签页
            await chrome.tabs.update(existingTabs[0].id, { active: true });
            return { success: true, tab: existingTabs[0] };
        }

        // 如果不存在，创建新标签页
        const tab = await chrome.tabs.create({ 
            url: url,
            active: true 
        });
        return { success: true, tab };
    } catch (error) {
        console.error('Failed to open tab:', error);
        return { success: false, error: error.message };
    }
}

// 修改获取历史记录的处理函数
async function handleGetHistory(sendResponse) {
    try {
        console.log('Getting history items...');
        const historyItems = await utils.getHistoryItems();
        console.log('Got history items:', historyItems.length);
        sendResponse(historyItems);
    } catch (error) {
        console.error('Failed to get history:', error);
        sendResponse([]);
    }
}

// 修改清理标签的处理函数
async function handleCleanTabs(sendResponse) {
    try {
        // 使用 Promise 包装 chrome.tabs.query
        const tabs = await new Promise((resolve, reject) => {
            try {
                chrome.tabs.query({}, (tabs) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(tabs);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });

        const seenDomains = new Map();
        let closedCount = 0;

        // 处理标签
        for (const tab of tabs) {
            try {
                if (!tab.url) continue;
                
                const url = new URL(tab.url);
                if (url.protocol === 'chrome:' || 
                    url.protocol === 'chrome-extension:' || 
                    url.protocol === 'about:') {
                    continue;
                }
                
                if (seenDomains.has(url.hostname)) {
                    const existingTab = seenDomains.get(url.hostname);
                    if (tab.id > existingTab.id) {
                        seenDomains.set(url.hostname, tab);
                    }
                } else {
                    seenDomains.set(url.hostname, tab);
                }
            } catch (e) {
                console.warn('Invalid URL:', tab.url);
            }
        }

        // 关闭重复的标签
        const tabsToKeep = new Set(Array.from(seenDomains.values()).map(tab => tab.id));
        const tabsToClose = tabs
            .filter(tab => {
                try {
                    if (!tab.url) return false;
                    const url = new URL(tab.url);
                    return (url.protocol === 'http:' || url.protocol === 'https:') && 
                           !tabsToKeep.has(tab.id);
                } catch (e) {
                    return false;
                }
            })
            .map(tab => tab.id);

        if (tabsToClose.length > 0) {
            await new Promise((resolve, reject) => {
                try {
                    chrome.tabs.remove(tabsToClose, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            closedCount = tabsToClose.length;
                            resolve();
                        }
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }

        sendResponse({ success: true, closedCount });
    } catch (error) {
        console.error('Error cleaning tabs:', error);
        sendResponse({ success: false, error: error.message });
    }
}
