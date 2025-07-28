class OptionsManager {
  constructor() {
    this.init();
  }

  async init() {
    this.loadSettings();
    this.loadStats();
    this.setupEventListeners();
  }

  loadSettings() {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      document.getElementById('autoBackup').checked = settings.autoBackup !== false;
    });
  }

  async loadStats() {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    
    // 更新统计信息
    document.getElementById('totalLinks').textContent = bookmarks.length;
    
    const allTags = [...new Set(bookmarks.flatMap(link => link.tags))];
    document.getElementById('totalTags').textContent = allTags.length;
    
    if (bookmarks.length > 0) {
      const lastAdded = new Date(bookmarks[0].createdAt);
      document.getElementById('lastAdded').textContent = 
        lastAdded.toLocaleDateString('zh-CN');
    }
    
    // 加载标签管理
    this.renderTagsList(bookmarks);
  }

  renderTagsList(bookmarks) {
    const tagCounts = {};
    bookmarks.forEach(link => {
      link.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const tagsList = document.getElementById('tagsList');
    tagsList.innerHTML = '';
    
    Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        const tagItem = document.createElement('div');
        tagItem.className = 'tag-item';
        tagItem.innerHTML = `
          <span class="tag-name">${tag}</span>
          <span class="tag-count">${count}</span>
          <button class="tag-delete" onclick="optionsManager.deleteTag('${tag}')">×</button>
        `;
        tagsList.appendChild(tagItem);
      });
  }

  setupEventListeners() {
    // 自动备份设置
    document.getElementById('autoBackup').addEventListener('change', (e) => {
      this.saveSetting('autoBackup', e.target.checked);
    });

    // 导出数据
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    // 导入数据
    document.getElementById('importData').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // 清除所有数据
    document.getElementById('clearAllData').addEventListener('click', () => {
      this.clearAllData();
    });
  }

  saveSetting(key, value) {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      settings[key] = value;
      chrome.storage.local.set({ settings });
    });
  }

  async exportData() {
    const result = await chrome.storage.local.get(['bookmarks', 'settings']);
    const data = {
      bookmarks: result.bookmarks || [],
      settings: result.settings || {},
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], 
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  async importData(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.bookmarks) {
        if (confirm(`导入将替换现有数据，共${data.bookmarks.length}个链接。确定继续吗？`)) {
          await chrome.storage.local.set({
            bookmarks: data.bookmarks,
            settings: data.settings || {}
          });
          
          alert('数据导入成功');
          location.reload();
        }
      }
    } catch (error) {
      alert('导入失败：文件格式错误');
    }
  }

  async clearAllData() {
    if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
      await chrome.storage.local.clear();
      alert('所有数据已清除');
      location.reload();
    }
  }

  async deleteTag(tagName) {
    if (confirm(`确定要删除标签 "${tagName}" 吗？`)) {
      const result = await chrome.storage.local.get(['bookmarks']);
      const bookmarks = result.bookmarks || [];
      
      // 从所有链接中移除该标签
      const updatedBookmarks = bookmarks.map(link => ({
        ...link,
        tags: link.tags.filter(tag => tag !== tagName)
      }));
      
      await chrome.storage.local.set({ bookmarks: updatedBookmarks });
      this.loadStats();
    }
  }
}

// 初始化
const optionsManager = new OptionsManager();