// 背景脚本 - 处理右键菜单和收藏管理

// 初始化时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log('快速收藏夹已安装');
  createContextMenus();
});

// 创建右键菜单
function createContextMenus() {
  // 主菜单
  chrome.contextMenus.create({
    id: 'bookmark-root',
    title: '快速收藏夹',
    contexts: ['page', 'link']
  });

  // 添加收藏
  chrome.contextMenus.create({
    id: 'add-bookmark',
    parentId: 'bookmark-root',
    title: '添加到收藏夹',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'add-link-bookmark',
    parentId: 'bookmark-root',
    title: '添加到收藏夹',
    contexts: ['link']
  });

  // 移除收藏
  chrome.contextMenus.create({
    id: 'remove-bookmark',
    parentId: 'bookmark-root',
    title: '移出收藏夹',
    contexts: ['page', 'link']
  });

  // 搜索收藏
  chrome.contextMenus.create({
    id: 'search-bookmarks',
    parentId: 'bookmark-root',
    title: '搜索收藏夹',
    contexts: ['page']
  });
}

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'add-bookmark':
      await addBookmark(tab.title, tab.url);
      break;
    case 'add-link-bookmark':
      await addBookmark(info.selectionText || info.linkUrl, info.linkUrl);
      break;
    case 'remove-bookmark':
      const urlToRemove = info.linkUrl || tab.url;
      await removeBookmark(urlToRemove);
      break;
    case 'search-bookmarks':
      // 打开扩展弹出窗口进行搜索
      chrome.action.openPopup();
      break;
  }
});

// 添加收藏
async function addBookmark(title, url) {
  try {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    
    // 检查是否已存在
    const existingIndex = bookmarks.findIndex(b => b.url === url);
    if (existingIndex !== -1) {
      showNotification('此链接已在收藏夹中');
      return;
    }

    const newBookmark = {
      id: Date.now(),
      title: title,
      url: url,
      tags: [],
      description: '',
      createdAt: new Date().toISOString(),
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
    };

    bookmarks.unshift(newBookmark);
    await chrome.storage.local.set({ bookmarks });
    
    showNotification('已添加到收藏夹');
  } catch (error) {
    console.error('添加收藏失败:', error);
    showNotification('添加失败，请重试');
  }
}

// 移除收藏
async function removeBookmark(url) {
  try {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    
    const filteredBookmarks = bookmarks.filter(b => b.url !== url);
    
    if (filteredBookmarks.length === bookmarks.length) {
      showNotification('此链接不在收藏夹中');
      return;
    }

    await chrome.storage.local.set({ bookmarks: filteredBookmarks });
    showNotification('已从收藏夹移除');
  } catch (error) {
    console.error('移除收藏失败:', error);
    showNotification('移除失败，请重试');
  }
}

// 显示通知
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '快速收藏夹',
    message: message
  });
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'addBookmark':
      addBookmark(request.data.title, request.data.url);
      break;
    case 'removeBookmark':
      removeBookmark(request.data.url);
      break;
    case 'getBookmarks':
      chrome.storage.local.get(['bookmarks']).then(result => {
        sendResponse(result.bookmarks || []);
      });
      return true; // 保持消息通道开放
  }
});