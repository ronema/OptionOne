console.log("[Background] Script loaded");

// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// 显示模态框
async function showModal(tab) {
    try {
        // 获取历史记录，默认显示最近20条
        const historyItems = await chrome.history.search({
            text: '',
            maxResults: 1000,
            startTime: 0
        });
        console.log('History results:', historyItems);

        // 检查当前标签页是否是浏览器内部页面
        const isInternalPage = tab.url.startsWith('chrome://') || 
                             tab.url.startsWith('edge://') || 
                             tab.url.startsWith('about:');

        if (isInternalPage) {
            // 如果是浏览器内部页面，创建新标签并传递历史记录
            chrome.tabs.create({
                url: chrome.runtime.getURL('background.html')
            }, (newTab) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                        chrome.tabs.sendMessage(tabId, {
                            type: 'LOAD_HISTORY',
                            data: historyItems
                        });
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                });
            });
        } else {
            // 如果是普通网页，注入模态框
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
        }
    } catch (error) {
        console.log('Error showing modal:', error);
    }
}

// 监听图标点击
chrome.action.onClicked.addListener(async (tab) => {
    console.log('Icon clicked');
    await showModal(tab);
});

// 检查是否是 Chrome 内部页面
const isChromeInternalPage = (url) => {
    return url.startsWith('chrome://') || 
           url.startsWith('edge://') || 
           url.startsWith('about:') ||
           url.startsWith('chrome-extension://');
};

// 处理快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
    if (command === '_execute_action') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // 获取历史记录
        const historyItems = await chrome.history.search({
            text: '',
            maxResults: 1000,
            startTime: 0
        });
        console.log('History results:', historyItems);

        // 如果是 Chrome 内部页面，创建新标签
        if (isChromeInternalPage(tab.url)) {
            chrome.tabs.create({ 
                url: 'popup.html',
                active: true
            });
            return;
        }

        // 注入脚本到当前标签
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['modal.js']
            });

            // 注入样式
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

            // 发送历史数据到内容脚本
            await chrome.tabs.sendMessage(tab.id, {
                type: 'showModal',
                data: historyItems
            });
        } catch (error) {
            console.error('Failed to inject script:', error);
            // 如果注入失败，打开新标签
            chrome.tabs.create({ 
                url: 'popup.html',
                active: true
            });
        }
    }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getHistory') {
        // 获取最近1000条历史记录
        chrome.history.search({
            text: '',
            maxResults: 1000,
            startTime: 0
        }, (historyItems) => {
            sendResponse(historyItems);
        });
        return true; // 保持消息通道开启
    } else if (request.type === 'openTab') {
        chrome.tabs.create({ url: request.url });
    }
});

chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('edge://') || currentTab.url.startsWith('about:') || currentTab.url.startsWith('chrome-extension://')) {
            // 在内部页面时完全阻止命令的执行
            return;
        }
        
        // 处理其他快捷键逻辑
        if (command === 'open-modal') {
            chrome.windows.getCurrent((window) => {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('modal.html'),
                    active: true,
                    windowId: window.id
                });
            });
        }
    });
});
