// 内容脚本 - 处理页面内的键盘快捷键

// 监听键盘事件
let lastKeyPressTime = 0;
const KEY_COMBO_TIMEOUT = 1000; // 1秒内按键组合

document.addEventListener('keydown', async (e) => {
  const currentTime = Date.now();
  
  // Ctrl+Shift+S 快捷键添加当前页面
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    await addCurrentPage();
  }
  
  // 双击Shift键显示搜索面板
  if (e.key === 'Shift') {
    if (currentTime - lastKeyPressTime < KEY_COMBO_TIMEOUT) {
      e.preventDefault();
      showSearchPanel();
    }
    lastKeyPressTime = currentTime;
  }
});

// 添加当前页面到收藏
async function addCurrentPage() {
  try {
    chrome.runtime.sendMessage({
      action: 'addBookmark',
      data: {
        title: document.title,
        url: window.location.href
      }
    });
  } catch (error) {
    console.error('添加收藏失败:', error);
  }
}

// 显示快速搜索面板
function showSearchPanel() {
  // 检查是否已存在面板
  if (document.getElementById('bookmark-search-panel')) {
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'bookmark-search-panel';
  panel.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      width: 400px;
      max-height: 500px;
      font-family: Arial, sans-serif;
    ">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">快速搜索收藏</h3>
      <input type="text" id="bookmark-search-input" placeholder="输入关键词搜索..." style="
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
      ">
      <div id="bookmark-search-results" style="max-height: 300px; overflow-y: auto;"></div>
      <div style="text-align: right; margin-top: 10px;">
        <button onclick="closeSearchPanel()" style="
          padding: 6px 12px;
          border: none;
          background: #6c757d;
          color: white;
          border-radius: 4px;
          cursor: pointer;
        ">关闭</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  
  const searchInput = document.getElementById('bookmark-search-input');
  const resultsContainer = document.getElementById('bookmark-search-results');
  
  searchInput.focus();
  
  // 搜索功能
  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      resultsContainer.innerHTML = '';
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
      const bookmarks = response || [];
      
      const filtered = bookmarks.filter(b => 
        b.title.toLowerCase().includes(query) || 
        b.url.toLowerCase().includes(query)
      );
      
      if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">没有找到匹配的收藏</div>';
        return;
      }
      
      resultsContainer.innerHTML = filtered.map(b => `
        <div style="
          padding: 8px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          display: flex;
          align-items: center;
        " onclick="visitBookmark('${b.url}')">
          <div style="
            width: 16px;
            height: 16px;
            background-image: url('${b.favicon || 'https://www.google.com/s2/favicons?domain=' + new URL(b.url).hostname}');
            background-size: contain;
            margin-right: 8px;
          "></div>
          <div>
            <div style="font-size: 14px; font-weight: bold;">${b.title}</div>
            <div style="font-size: 12px; color: #666;">${b.url}</div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('搜索失败:', error);
      resultsContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">搜索失败</div>';
    }
  });
  
  // 添加到全局作用域
  window.closeSearchPanel = () => {
    panel.remove();
  };
  
  window.visitBookmark = (url) => {
    chrome.runtime.sendMessage({ action: 'visitBookmark', url: url });
    panel.remove();
  };
  
  // ESC键关闭面板
  const escListener = (e) => {
    if (e.key === 'Escape') {
      panel.remove();
      document.removeEventListener('keydown', escListener);
    }
  };
  document.addEventListener('keydown', escListener);
}