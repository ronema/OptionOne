document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup script loaded');

    let allHistoryItems = [];

    // 获取历史记录
    chrome.runtime.sendMessage({ type: 'getHistory' }, (historyItems) => {
        if (chrome.runtime.lastError) {
            console.warn('Failed to get history:', chrome.runtime.lastError.message);
            return;
        }
        if (historyItems) {
            populateList(historyItems);
        }
    });

    // 填充列表
    function populateList(historyItems) {
        const list = document.getElementById('list');
        const search = document.getElementById('search');

        // 搜索功能
        search.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = historyItems.filter(item => 
                (item.title && item.title.toLowerCase().includes(query)) ||
                (item.url && item.url.toLowerCase().includes(query))
            );
            renderItems(filtered);
        });

        // 渲染列表项
        function renderItems(items) {
            list.innerHTML = '';
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'item';
                
                const a = document.createElement('a');
                a.className = 'link';
                a.href = item.url;
                
                // 创建图标
                const favicon = document.createElement('img');
                favicon.className = 'favicon';
                try {
                    const url = new URL(item.url);
                    favicon.src = `https://${url.hostname}/favicon.ico`;
                } catch (e) {
                    favicon.src = 'icon.png';
                }
                
                // 创建标题
                const title = document.createElement('span');
                title.className = 'title';
                title.textContent = item.title || item.url;
                
                a.appendChild(favicon);
                a.appendChild(title);
                
                // 点击事件
                a.onclick = (e) => {
                    e.preventDefault();
                    chrome.runtime.sendMessage({ 
                        type: 'openTab', 
                        url: item.url 
                    });
                    window.close();
                };
                
                li.appendChild(a);
                list.appendChild(li);
            });
        }

        // 初始渲染
        renderItems(historyItems);
    }
});
