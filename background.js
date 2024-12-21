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
        return new Promise((resolve) => {
            chrome.history.search({
                text: '',              // 搜索所有历史记录
                maxResults: 100,       // 获取足够多的结果
                startTime: 0           // 从最早的记录开始
            }, async (historyItems) => {
                // 获取每个网站的访问次数
                const itemsWithVisits = await Promise.all(
                    historyItems.map(async (item) => {
                        const visits = await new Promise((resolve) => {
                            chrome.history.getVisits({ url: item.url }, (visits) => {
                                resolve(visits);
                            });
                        });
                        return {
                            ...item,
                            visitCount: visits.length
                        };
                    })
                );
                resolve(itemsWithVisits);
            });
        });
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

        // 移除内部页面的特殊处理，直接返回
        if (tab.url.startsWith('chrome://')) {
            return;
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

// 统一的消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'getHistory':
            handleGetHistory(sendResponse);
            return true;  // 保持消息通道开放
        case 'openTab':
            chrome.tabs.create({ 
                url: request.url || 'chrome://newtab',
                active: true 
            });
            break;
    }
});

async function handleGetHistory(sendResponse) {
    try {
        console.log('Getting history items...');
        const historyItems = await utils.getHistoryItems();
        console.log('Got history items:', historyItems);
        sendResponse(historyItems);
    } catch (error) {
        console.error('Failed to get history:', error);
        sendResponse([]);
    }
}
