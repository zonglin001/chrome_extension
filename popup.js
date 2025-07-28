class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.filteredBookmarks = [];
    this.currentSearch = '';
    this.init();
  }

  async init() {
    await this.loadBookmarks();
    this.setupEventListeners();
    this.renderBookmarks();
    this.updateStats();
  }

  async loadBookmarks() {
    try {
      const result = await chrome.storage.local.get(['bookmarks']);
      this.bookmarks = result.bookmarks || [];
      this.filteredBookmarks = [...this.bookmarks];
    } catch (error) {
      console.error('加载收藏失败:', error);
      this.bookmarks = [];
      this.filteredBookmarks = [];
    }
  }

  async saveBookmarks() {
    try {
      await chrome.storage.local.set({ bookmarks: this.bookmarks });
    } catch (error) {
      console.error('保存收藏失败:', error);
    }
  }

  setupEventListeners() {
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
      this.searchBookmarks(this.currentSearch);
      clearSearch.style.display = this.currentSearch ? 'block' : 'none';
    });

    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      this.currentSearch = '';
      this.searchBookmarks('');
      clearSearch.style.display = 'none';
    });

    // 添加当前页面
    document.getElementById('addCurrentBtn').addEventListener('click', () => {
      this.addCurrentPage();
    });

    // 导出功能
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportBookmarks();
    });

    // 导入功能
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importBookmarks(e.target.files[0]);
    });

    // 浏览器收藏夹导入功能
    document.getElementById('importBrowserBtn').addEventListener('click', () => {
      this.showBrowserImportModal();
    });

    document.getElementById('closeBrowserImport').addEventListener('click', () => {
      this.hideBrowserImportModal();
    });

    document.getElementById('importAllBtn').addEventListener('click', () => {
      this.importAllBrowserBookmarks();
    });

    document.getElementById('importByFolderBtn').addEventListener('click', () => {
      this.showFolderSelection();
    });

    // 点击模态框外部关闭
    document.getElementById('browserImportModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('browserImportModal')) {
        this.hideBrowserImportModal();
      }
    });
  }

  async addCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await this.addBookmark(tab.title, tab.url);
      }
    } catch (error) {
      console.error('添加当前页面失败:', error);
      this.showToast('添加失败，请重试');
    }
  }

  async addBookmark(title, url) {
    try {
      // 检查是否已存在
      const existingIndex = this.bookmarks.findIndex(b => b.url === url);
      if (existingIndex !== -1) {
        this.showToast('此链接已在收藏夹中');
        return;
      }

      const newBookmark = {
        id: Date.now(),
        title: title,
        url: url,
        createdAt: new Date().toISOString(),
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
      };

      this.bookmarks.unshift(newBookmark);
      await this.saveBookmarks();
      this.renderBookmarks();
      this.updateStats();
      this.showToast('已添加到收藏夹');
    } catch (error) {
      console.error('添加收藏失败:', error);
      this.showToast('添加失败，请重试');
    }
  }

  async removeBookmark(id) {
    if (confirm('确定要删除这个收藏吗？')) {
      try {
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.filteredBookmarks = this.filteredBookmarks.filter(b => b.id !== id);
        await this.saveBookmarks();
        this.renderBookmarks();
        this.updateStats();
        this.showToast('已删除收藏');
      } catch (error) {
        console.error('删除收藏失败:', error);
        this.showToast('删除失败，请重试');
      }
    }
  }

  async visitBookmark(url) {
    try {
      await chrome.tabs.create({ url: url });
      window.close(); // 关闭弹出窗口
    } catch (error) {
      console.error('打开链接失败:', error);
      this.showToast('打开链接失败');
    }
  }

  searchBookmarks(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
      this.filteredBookmarks = [...this.bookmarks];
    } else {
      this.filteredBookmarks = this.bookmarks.filter(bookmark => {
        return bookmark.title.toLowerCase().includes(searchTerm) ||
               bookmark.url.toLowerCase().includes(searchTerm);
      });
    }
    
    this.renderBookmarks();
  }

  renderBookmarks() {
    const container = document.getElementById('linksList');
    const count = document.getElementById('bookmarkCount');
    
    if (this.filteredBookmarks.length === 0) {
      container.innerHTML = this.bookmarks.length === 0 ? 
        '<div class="empty-state">暂无收藏，右键页面添加收藏</div>' :
        '<div class="empty-state">没有找到匹配的收藏</div>';
      return;
    }

    container.innerHTML = '';
    
    this.filteredBookmarks.forEach(bookmark => {
      const title = this.highlightText(bookmark.title, this.currentSearch);
      const url = this.highlightText(bookmark.url, this.currentSearch);
      
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item';
      linkItem.innerHTML = `
        <div class="link-title">${title}</div>
        <div class="link-url">${url}</div>
        <div class="link-actions">
          <button class="action-btn visit-btn" data-url="${this.escapeHtml(bookmark.url)}">
            访问
          </button>
          <button class="action-btn delete-btn" data-id="${bookmark.id}">
            删除
          </button>
        </div>
      `;
      
      // 使用事件委托而不是内联onclick
      linkItem.querySelector('.link-title').addEventListener('click', () => {
        this.visitBookmark(bookmark.url);
      });
      
      linkItem.querySelector('.visit-btn').addEventListener('click', () => {
        this.visitBookmark(bookmark.url);
      });
      
      linkItem.querySelector('.delete-btn').addEventListener('click', () => {
        this.removeBookmark(bookmark.id);
      });
      
      container.appendChild(linkItem);
    });
  }

  highlightText(text, searchTerm) {
    if (!searchTerm) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${this.escapeRegExp(searchTerm)})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
  }

  updateStats() {
    const count = document.getElementById('bookmarkCount');
    const total = this.bookmarks.length;
    const filtered = this.filteredBookmarks.length;
    
    if (this.currentSearch) {
      count.textContent = `找到 ${filtered} / ${total} 个收藏`;
    } else {
      count.textContent = `共 ${total} 个收藏`;
    }
  }

  exportBookmarks() {
    const data = JSON.stringify(this.bookmarks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showToast('已导出收藏');
  }

  async importBookmarks(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedBookmarks = JSON.parse(text);
      
      if (Array.isArray(importedBookmarks)) {
        const validBookmarks = importedBookmarks.filter(b => b.title && b.url);
        this.bookmarks = [...validBookmarks, ...this.bookmarks];
        await this.saveBookmarks();
        this.renderBookmarks();
        this.updateStats();
        this.showToast(`已导入 ${validBookmarks.length} 个收藏`);
      }
    } catch (error) {
      console.error('导入失败:', error);
      this.showToast('导入失败，请检查文件格式');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #333;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 1001;
      font-size: 12px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  // 浏览器收藏夹导入相关方法
  showBrowserImportModal() {
    document.getElementById('browserImportModal').style.display = 'block';
    this.loadBrowserBookmarks();
  }

  hideBrowserImportModal() {
    document.getElementById('browserImportModal').style.display = 'none';
    document.getElementById('folderTree').innerHTML = '';
    document.getElementById('importStatus').textContent = '';
  }

  async loadBrowserBookmarks() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.renderFolderTree(bookmarkTree);
    } catch (error) {
      console.error('加载浏览器收藏夹失败:', error);
      this.showToast('无法访问浏览器收藏夹，请检查权限');
    }
  }

  renderFolderTree(bookmarkTree, level = 0) {
    const folderContainer = document.getElementById('folderTree');
    folderContainer.innerHTML = '';
    
    let totalBookmarks = 0;
    let folderCount = 0;
    
    const traverse = (nodes, level) => {
      nodes.forEach(node => {
        if (node.children) {
          // 这是一个文件夹
          folderCount++;
          const folderDiv = document.createElement('div');
          folderDiv.style.cssText = `
            margin-left: ${level * 20}px;
            padding: 8px;
            border: 1px solid #eee;
            border-radius: 4px;
            margin-bottom: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
          `;
          
          const folderInfo = document.createElement('div');
          folderInfo.innerHTML = `
            <span>📁 ${node.title || '根目录'}</span>
            <span style="color: #666; font-size: 12px;">(${this.countBookmarksInFolder(node)} 个链接)</span>
          `;
          
          const importBtn = document.createElement('button');
          importBtn.className = 'btn primary';
          importBtn.style.cssText = 'padding: 4px 8px; font-size: 11px;';
          importBtn.textContent = '导入此目录';
          importBtn.addEventListener('click', () => {
            this.importFolderBookmarks(node);
          });
          
          folderDiv.appendChild(folderInfo);
          folderDiv.appendChild(importBtn);
          folderContainer.appendChild(folderDiv);
          
          traverse(node.children, level + 1);
        } else if (!node.url) {
          // 根节点或其他特殊节点
          if (node.children) {
            traverse(node.children, level);
          }
        }
      });
    };
    
    traverse(bookmarkTree, 0);
    
    // 显示统计信息
    totalBookmarks = this.countTotalBookmarks(bookmarkTree);
    document.getElementById('importStatus').textContent = 
      `共找到 ${folderCount} 个目录，${totalBookmarks} 个书签`;
  }

  countBookmarksInFolder(node) {
    let count = 0;
    if (node.children) {
      node.children.forEach(child => {
        if (child.url) {
          count++;
        } else if (child.children) {
          count += this.countBookmarksInFolder(child);
        }
      });
    }
    return count;
  }

  countTotalBookmarks(nodes) {
    let count = 0;
    nodes.forEach(node => {
      if (node.url) {
        count++;
      } else if (node.children) {
        count += this.countTotalBookmarks(node.children);
      }
    });
    return count;
  }

  async importAllBrowserBookmarks() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const bookmarks = this.extractBookmarksFromTree(bookmarkTree);
      
      if (bookmarks.length === 0) {
        this.showToast('浏览器收藏夹为空');
        return;
      }
      
      const newBookmarks = bookmarks.filter(bookmark => 
        !this.bookmarks.some(existing => existing.url === bookmark.url)
      );
      
      this.bookmarks = [...this.bookmarks, ...newBookmarks];
      await this.saveBookmarks();
      this.renderBookmarks();
      this.updateStats();
      this.hideBrowserImportModal();
      this.showToast(`已导入 ${newBookmarks.length} 个浏览器收藏`);
    } catch (error) {
      console.error('导入浏览器收藏夹失败:', error);
      this.showToast('导入失败，请重试');
    }
  }

  async importFolderBookmarks(folderNode) {
    try {
      const bookmarks = this.extractBookmarksFromTree([folderNode]);
      
      if (bookmarks.length === 0) {
        this.showToast('该目录下没有书签');
        return;
      }
      
      const newBookmarks = bookmarks.filter(bookmark => 
        !this.bookmarks.some(existing => existing.url === bookmark.url)
      );
      
      this.bookmarks = [...this.bookmarks, ...newBookmarks];
      await this.saveBookmarks();
      this.renderBookmarks();
      this.updateStats();
      this.hideBrowserImportModal();
      this.showToast(`已导入 ${newBookmarks.length} 个收藏`);
    } catch (error) {
      console.error('导入目录失败:', error);
      this.showToast('导入失败，请重试');
    }
  }

  extractBookmarksFromTree(nodes, folderName = null) {
    const bookmarks = [];
    
    nodes.forEach(node => {
      if (node.url) {
        // 这是一个书签
        bookmarks.push({
          id: Date.now() + Math.random(),
          title: node.title || node.url,
          url: node.url,
          createdAt: node.dateAdded ? new Date(node.dateAdded).toISOString() : new Date().toISOString(),
          favicon: `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}`,
          folder: folderName
        });
      } else if (node.children) {
        // 这是一个文件夹，递归处理
        const folderTitle = node.title || '未命名目录';
        bookmarks.push(...this.extractBookmarksFromTree(node.children, folderTitle));
      }
    });
    
    return bookmarks;
  }
}

// 初始化
const bookmarkManager = new BookmarkManager();