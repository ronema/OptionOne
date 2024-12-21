console.log("[Modal] Content script loaded");

// 创建并显示模态对话框
function createModal(data) {
    console.log("[Modal] Creating modal...");

    // 在函数开头声明所有变量
    let selectedIndex = -1;
    let items = [];
    let allHistoryItems = [];
    let overlay = null;
    let search = null;
    let list = null;

    // 检查是否已经存在模态框
    const existingOverlay = document.querySelector('.modal-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // 创建 DOM 元素
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(24px);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 100px;
        z-index: 999999;
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        background: rgba(40, 43, 50, 0.7);
        backdrop-filter: blur(32px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 20px 20px 0 20px;
        box-shadow: 
            0 4px 30px rgba(0, 0, 0, 0.3),
            inset 0 0 0 1px rgba(255, 255, 255, 0.1);
        position: relative;
        width: 680px;
        height: 600px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    // 创建搜索框容器
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    `;

    // 创建搜索输入框
    search = document.createElement('input');
    search.type = 'text';
    search.className = 'search';
    search.placeholder = 'Search history...';
    search.style.cssText = `
        flex: 1;
        box-sizing: border-box;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(35, 39, 46, 0.7);
        backdrop-filter: blur(8px);
        color: white;
        font-size: 14px;
        outline: none;
        transition: all 0.2s;
    `;

    // 创建排序按钮
    const sortButton = document.createElement('button');
    sortButton.className = 'sort-button';
    sortButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(45, 50, 56, 0.7);
        backdrop-filter: blur(8px);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        color: #0AE5DD;
    `;

    // 排序图标
    sortButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 4H13M5 8H11M7 12H9" stroke="#0AE5DD" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    `;

    // 排序按钮悬停效果
    sortButton.onmouseover = () => {
        sortButton.style.background = '#3d4451';
    };
    sortButton.onmouseout = () => {
        sortButton.style.background = '#2d3238';
    };

    // 排序状态
    let sortByFrequency = true;  // 默认按频率排序

    // 排序函数
    function sortHistoryItems(items) {
        return sortByFrequency
            ? [...items].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
            : [...items].sort((a, b) => b.lastVisitTime - a.lastVisitTime);
    }

    // 排序按钮点击事件
    sortButton.onclick = () => {
        sortByFrequency = !sortByFrequency;
        if (allHistoryItems) {
            populateList(sortHistoryItems(allHistoryItems));
        }
    };

    // 修改文本显示的函数
    function truncateText(text, maxLength = 40) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // 修改列表项的样式
    function createListItemStyle(isSelected = false) {
        return `
            margin: 4px 0;
            background: ${isSelected ? 'rgba(35, 39, 46, 0.95)' : 'rgba(40, 43, 50, 0.7)'};
            backdrop-filter: blur(8px);
            border: none;
            border-radius: 6px;
            transition: all 0.2s ease;
            transform: scale(${isSelected ? '1.01' : '1'});
            box-shadow: ${isSelected ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none'};
        `;
    }

    // 修改列表项链接的样式
    function createListLinkStyle(isSelected = false) {
        return `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            text-decoration: none;
            transition: all 0.2s ease;
            gap: 12px;
            background: transparent;
            border-radius: 6px;
            font-size: 14px;
        `;
    }

    // 修改文本样式
    function createTextStyle(isSelected = false) {
        return `
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: ${isSelected ? '#0AE5DD' : '#ffffff'};
            margin-right: 8px;
            min-width: 0;
            font-size: 13px;
        `;
    }

    // 修改选中状态的样式
    function updateSelection() {
        try {
            if (!items || !items.length) return;

            items.forEach(item => {
                if (item && item.element) {
                    item.element.parentElement.style.cssText = createListItemStyle(false);
                    const text = item.element.querySelector('span');
                    if (text) {
                        text.style.cssText = createTextStyle(false);
                    }
                    const hint = item.element.querySelector('.enter-hint');
                    if (hint) hint.remove();
                }
            });

            if (selectedIndex >= 0 && items[selectedIndex]) {
                const selectedItem = items[selectedIndex];
                if (selectedItem && selectedItem.element) {
                    selectedItem.element.parentElement.style.cssText = createListItemStyle(true);
                    const text = selectedItem.element.querySelector('span');
                    if (text) {
                        text.style.cssText = createTextStyle(true);
                    }
                    
                    // 创建包含箭头和文字的提示容器
                    const hint = document.createElement('div');
                    hint.className = 'enter-hint';
                    hint.style.cssText = `
                        display: flex;
                        align-items: center;
                        margin-left: 8px;
                        color: rgba(255, 255, 255, 0.3);
                        font-size: 12px;
                        min-width: 50px;
                        justify-content: flex-end;
                    `;

                    // 添加 "Enter" 文字（首字母大写）
                    const enterText = document.createElement('span');
                    enterText.textContent = 'Enter';
                    enterText.style.marginRight = '4px';

                    // 添加 SVG 箭头
                    const arrow = document.createElement('div');
                    arrow.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                            <desc>Created with Pixso.</desc>
                            <defs>
                                <clipPath id="clip7_4">
                                    <rect id="arrow" width="16" height="16" fill="white" fill-opacity="0"/>
                                </clipPath>
                            </defs>
                            <g clip-path="url(#clip7_4)">
                                <path id="合并" d="M9.0705 10.7849L12.8942 7.99997L9.0705 5.21503L9.0705 6.99994L3.10587 6.99994L3.10587 8.99994L9.0705 8.99994L9.0705 10.7849Z" clip-rule="evenodd" fill="#0AE5DD" fill-opacity="1.000000" fill-rule="evenodd"/>
                            </g>
                        </svg>
                    `;
                    arrow.style.cssText = `
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    `;

                    hint.appendChild(enterText);
                    hint.appendChild(arrow);
                    selectedItem.element.appendChild(hint);

                    selectedItem.element.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                    });
                }
            }
            
            if (search) {
                search.focus();
            }
        } catch (err) {
            console.warn('Update selection failed:', err);
        }
    }

    // 搜索功能
    function filterItems(query) {
        try {
            if (!allHistoryItems) return;

            if (!query) {
                populateList(allHistoryItems);
                return;
            }

            const filtered = allHistoryItems.filter(item => 
                (item.title && item.title.toLowerCase().includes(query.toLowerCase())) ||
                (item.url && item.url.toLowerCase().includes(query.toLowerCase()))
            );
            populateList(filtered);
        } catch (err) {
            console.warn('Filter items failed:', err);
        }
    }

    // 搜索框事件
    search.addEventListener('input', (e) => {
        filterItems(e.target.value);
    });

    // 键盘导航
    function handleKeyNavigation(e) {
        if (e.key === 'Escape') {
            if (overlay) {
                overlay.remove();
            }
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items || items.length === 0) return;

            if (e.key === 'ArrowDown') {
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            } else {
                selectedIndex = Math.max(selectedIndex - 1, -1);
            }
            updateSelection();
        } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
            e.preventDefault();
            const selectedItem = items[selectedIndex];
            chrome.runtime.sendMessage({ type: 'openTab', url: selectedItem.url });
            if (overlay) {
                overlay.remove();
            }
        }
    }

    // 修改事件监听器的绑定
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const input = e.target.value.trim();
            
            // 检查是否是网址
            if (isValidUrl(input)) {
                e.preventDefault();
                // 如果是网址，直接打开
                const url = formatUrl(input);
                chrome.runtime.sendMessage({ type: 'openTab', url });
                overlay.remove();
                return;
            }
        }
        // 其他按键继续原有的处理逻辑
        handleKeyNavigation(e);
    });

    list = document.createElement('ul');
    list.className = 'list';
    list.style.cssText = `
        flex: 1;
        overflow-y: auto;
        margin: 0;
        padding: 0 2px;
        list-style: none;
        min-height: 0;
        max-height: 500px;
    `;

    // 填充列表
    function populateList(historyItems) {
        if (!list) return;
        
        // 清空列表并显示骨架屏
        list.innerHTML = '';
        const skeleton = createSkeletonScreen();
        list.appendChild(skeleton);

        // 使用 setTimeout 来模拟异步加载
        setTimeout(() => {
            list.innerHTML = '';
            items = [];
            selectedIndex = 0;

            // 添加新标签页选项
            const newTabItem = document.createElement('li');
            newTabItem.className = 'onetab-item';
            newTabItem.style.cssText = createListItemStyle();

            const newTabLink = document.createElement('a');
            newTabLink.href = 'chrome://newtab';
            newTabLink.className = 'onetab-link new-tab-item';
            newTabLink.style.cssText = createListLinkStyle();

            const icon = document.createElement('div');
            icon.innerHTML = `
                <svg fill="none" height="16" viewBox="0 0 20 16" width="20" xmlns="http://www.w3.org/2000/svg">
                    <path clip-rule="evenodd" d="m2 0h16c1.1046 0 2 .895416 2 2v12c0 1.1046-.8954 2-2 2h-16c-1.104584 0-2-.8954-2-2v-12c0-1.104584.895416-2 2-2zm2.38574 10.5h-.83935v-4.4458h.90527l1.29053 2.37012.44385.95947h.02929c-.04101-.46143-.11279-1.05029-.11279-1.5542v-1.77539h.83935v4.4458h-.89941l-1.28467-2.37598-.4497-.95361h-.03077c.04248.479.1084 1.03711.1084 1.54688zm6.44366 0h-2.78903v-4.4458h2.72313v.74414h-1.83543v1.02539h1.56003v.74414h-1.56003v1.18799h1.90133zm2.4068 0h-1.0869l-.8511-4.4458h.8995l.3545 2.17236c.0659.46729.1376.93604.2036 1.41504h.0249c.0893-.479.186-.95361.2812-1.41504l.5156-2.17236h.7618l.5112 2.17236c.0952.45557.186.93604.2812 1.41504h.0308c.0659-.479.1318-.95361.1978-1.41504l.353-2.17236h.8408l-.8218 4.4458h-1.1045l-.498-2.1958c-.0718-.34863-.1377-.68994-.1919-1.03272h-.0234c-.0601.34278-.1202.68409-.1919 1.03272z" 
                    fill="#0ae5dd" 
                    fill-rule="evenodd"/>
                </svg>
            `;
            icon.style.cssText = `
                width: 16px;
                height: 16px;
                min-width: 16px;
                border-radius: 4px;
                margin-right: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const text = document.createElement('span');
            text.textContent = '+ 新标签页';
            text.style.cssText = `
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #ffffff;
                margin-right: 8px;
                min-width: 0;
                font-size: 13px;
            `;

            newTabLink.appendChild(icon);
            newTabLink.appendChild(text);

            newTabLink.onclick = (e) => {
                e.preventDefault();
                try {
                    chrome.runtime.sendMessage({ type: 'openTab', url: 'chrome://newtab' }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Failed to open new tab:', chrome.runtime.lastError.message);
                            return;
                        }
                    });
                } catch (err) {
                    console.warn('Failed to send message:', err);
                }
                overlay.remove();
            };

            newTabItem.appendChild(newTabLink);
            list.appendChild(newTabItem);
            items.push({ element: newTabLink, url: 'chrome://newtab' });

            // 显示历史记录项
            if (historyItems && historyItems.length > 0) {
                const sortedItems = sortHistoryItems(historyItems);
                sortedItems.forEach(site => {
                    const item = document.createElement('li');
                    item.className = 'onetab-item';
                    item.style.cssText = createListItemStyle();

                    const link = document.createElement('a');
                    link.href = site.url;
                    link.className = 'onetab-link';
                    link.style.cssText = createListLinkStyle();

                    // 创建图标元素
                    const createLetterIcon = (title) => {
                        try {
                            const firstLetter = document.createElement('div');
                            firstLetter.textContent = (title || 'U').charAt(0).toUpperCase();
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
                        } catch (err) {
                            console.warn('Create letter icon failed:', err);
                            return createDefaultIcon();  // 返回一个默认图标
                        }
                    };

                    // 添加默认图标函数
                    function createDefaultIcon() {
                        const defaultIcon = document.createElement('div');
                        defaultIcon.textContent = 'U';
                        defaultIcon.style.cssText = `
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
                        return defaultIcon;
                    }

                    // 试获取网站图标
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
                            if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                                return createLetterIcon(title);
                            }
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
                    link.appendChild(icon);

                    const text = document.createElement('span');
                    text.textContent = truncateText(site.title || site.url);
                    text.style.cssText = `
                        flex: 1;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        color: #ffffff;
                        margin-right: 8px;
                        min-width: 0;
                        font-size: 13px;
                    `;

                    link.appendChild(text);

                    link.onmouseover = () => {
                        item.style.cssText = createListItemStyle(true);
                    };
                    
                    link.onmouseout = () => {
                        if (!items[selectedIndex] || items[selectedIndex].element !== link) {
                            item.style.cssText = createListItemStyle(false);
                        }
                    };

                    link.onclick = (e) => {
                        e.preventDefault();
                        try {
                            chrome.runtime.sendMessage({ type: 'openTab', url: site.url }, () => {
                                if (chrome.runtime.lastError) {
                                    console.warn('Failed to open tab:', chrome.runtime.lastError.message);
                                    return;
                                }
                            });
                        } catch (err) {
                            console.warn('Failed to send message:', err);
                        }
                        overlay.remove();
                    };

                    item.appendChild(link);
                    list.appendChild(item);
                    items.push({ element: link, url: site.url });
                });
            }

            if (items.length > 0) {
                updateSelection();
            }

            // 移除骨架屏
            skeleton.remove();
        }, 300);  // 添加300ms延迟以示骨架屏
    }

    // 将搜索框和排序按钮添加到容器
    searchContainer.appendChild(search);
    searchContainer.appendChild(sortButton);

    // 修改添加到模态框的顺序
    modal.appendChild(searchContainer);
    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 点击背景关闭
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };

    // 修改获取历史记录的部分
    chrome.runtime.sendMessage({ type: 'getHistory' }, (historyItems) => {
        if (chrome.runtime.lastError) {
            console.warn('Failed to get history:', chrome.runtime.lastError.message);
            return;
        }
        if (historyItems) {
            allHistoryItems = historyItems;
            populateList(historyItems);
        }
    });

    // 修改滚动条样式
    const style = document.createElement('style');
    style.textContent = `
        .list {
            overflow-x: hidden !important;
        }

        .list::-webkit-scrollbar {
            width: 4px;
            height: 0;
        }
        
        .list::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            transition: background 0.2s;
        }
        
        .list::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .list::-webkit-scrollbar-corner {
            background: transparent;
        }
    `;
    document.head.appendChild(style);

    // 清理函数
    function cleanup() {
        document.removeEventListener('keydown', handleKeyNavigation);
        if (overlay) {
            overlay.remove();
        }
    }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_MODAL') {
        createModal(message.data);
    }
});

// 添加加载动画组件
function createLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: rgba(255, 255, 255, 0.5);
    `;
    
    spinner.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.2"/>
            <path d="M12 2C13.3132 2 14.6136 2.25866 15.8268 2.76121C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
    `;

    // 添加转动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .loading-spinner svg {
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);

    return spinner;
}

// 修改骨架屏组件
function createSkeletonScreen() {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-screen';
    skeleton.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 0;
    `;
    
    // 创建新标签页骨架
    const newTabSkeleton = document.createElement('div');
    newTabSkeleton.className = 'skeleton-item';
    newTabSkeleton.style.cssText = `
        display: flex;
        align-items: center;
        padding: 12px;
        margin: 8px 0;
        background: #2d3238;
        border-radius: 6px;
        animation: pulse 1.5s ease-in-out infinite;
    `;

    // 新标签页图标骨架
    const newTabIconSkeleton = document.createElement('div');
    newTabIconSkeleton.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 4px;
        background: #3d4451;
        margin-right: 8px;
        flex-shrink: 0;
    `;

    // 新标签页文本骨架
    const newTabTextSkeleton = document.createElement('div');
    newTabTextSkeleton.style.cssText = `
        width: 80px;
        height: 14px;
        background: #3d4451;
        border-radius: 4px;
    `;

    newTabSkeleton.appendChild(newTabIconSkeleton);
    newTabSkeleton.appendChild(newTabTextSkeleton);
    skeleton.appendChild(newTabSkeleton);
    
    // 创建历史记录骨架项
    for (let i = 0; i < 8; i++) {
        const item = document.createElement('div');
        item.className = 'skeleton-item';
        item.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            margin: 8px 0;
            background: #2d3238;
            border-radius: 6px;
            animation: pulse 1.5s ease-in-out infinite;
            animation-delay: ${i * 0.1}s;
        `;

        // 图标骨架
        const iconSkeleton = document.createElement('div');
        iconSkeleton.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 4px;
            background: #3d4451;
            margin-right: 8px;
            flex-shrink: 0;
        `;

        // 文本���架
        const textSkeleton = document.createElement('div');
        textSkeleton.style.cssText = `
            flex: 1;
            height: 14px;
            background: #3d4451;
            border-radius: 4px;
        `;

        item.appendChild(iconSkeleton);
        item.appendChild(textSkeleton);
        skeleton.appendChild(item);
    }

    // 添加骨架屏动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 0.3; }
            100% { opacity: 0.6; }
        }
    `;
    document.head.appendChild(style);

    return skeleton;
}

// 添加 URL 检测函数
function isValidUrl(string) {
    try {
        // 检查是否已经是完整的 URL
        new URL(string);
        return true;
    } catch (_) {
        // 检查是否是域名格式
        const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return domainRegex.test(string);
    }
}

// 添加 URL 格式化函数
function formatUrl(string) {
    try {
        new URL(string);
        return string;
    } catch (_) {
        // 如果不是完整的 URL，添加 https://
        return `https://${string}`;
    }
}
