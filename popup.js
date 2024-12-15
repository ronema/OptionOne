document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup script loaded');

    let allHistoryItems = [];

    // 获取历史记录
    const getHistory = () => {
        chrome.runtime.sendMessage({ type: 'getHistory' }, (historyItems) => {
            allHistoryItems = historyItems;
            populateList(historyItems);
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

    // 填充列表
    const populateList = (items) => {
        const list = document.getElementById('site-list');
        list.style.cssText += 'padding: 8px;';
        list.innerHTML = '';
        
        items.forEach(site => {
            const item = document.createElement('li');
            item.className = 'item';
            
            const link = document.createElement('a');
            link.href = site.url;
            link.className = 'link';
            
            const favicon = document.createElement('img');
            favicon.src = `chrome://favicon/size/16@2x/${site.url}`;
            favicon.className = 'favicon';
            favicon.onerror = () => {
                favicon.src = 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
                        <rect width="16" height="16" fill="#4a4a4a" rx="2"/>
                        <text x="8" y="12" font-size="10" fill="white" text-anchor="middle">${site.title?.[0] || 'W'}</text>
                    </svg>
                `);
            };
            
            const title = document.createElement('span');
            title.className = 'title';
            title.textContent = site.title || site.url;
            
            link.appendChild(favicon);
            link.appendChild(title);
            
            link.onclick = (e) => {
                e.preventDefault();
                chrome.runtime.sendMessage({ type: 'openTab', url: site.url });
                window.close();
            };
            
            item.appendChild(link);
            list.appendChild(item);
        });
    };

    // 添加搜索事件监听
    document.getElementById('search').addEventListener('input', (e) => {
        filterItems(e.target.value);
    });

    // 初始化
    getHistory();
});
