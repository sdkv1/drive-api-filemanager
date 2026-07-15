const app = {
  currentFolder: null,
  folderStack: [],
  apiBase: '/drive',
  allFolders: [],
  currentMode: 'root', // 'root' | 'all-shared' | 'folder'

  init() {
    this.loadRoot();
  },

  async loadRoot() {
    this.showLoading(true);
    this.currentMode = 'root';
    try {
      const res = await fetch(`${this.apiBase}`);
      const data = await res.json();

      if (data.status === 'success') {
        this.currentFolder = data.rootId;
        this.folderStack = [];
        this.renderBreadcrumb();

        // Kalau mode detect_all_shared, tampilkan semua folder
        if (data.mode === 'detect_all_shared') {
          this.renderAllSharedFolders(data.data);
        } else {
          this.renderFiles(data.data);
        }

        this.updateStorage(data.storage);
      }
    } catch (err) {
      this.showToast('Gagal memuat data', 'error');
      console.error(err);
    }
    this.showLoading(false);
  },

  async loadFolder(folderId) {
    this.showLoading(true);
    this.currentMode = 'folder';
    try {
      const res = await fetch(`${this.apiBase}`);
      const data = await res.json();

      if (data.status === 'success') {
        this.currentFolder = folderId;
        this.renderBreadcrumb();

        // Cari folder di data
        const folder = this.findFolderInTree(data.data, folderId);
        if (folder && folder.children) {
          this.renderFiles(folder.children);
        } else {
          // Kalau tidak ketemu, fetch ulang
          await this.fetchFolderContents(folderId);
        }

        this.updateStorage(data.storage);
      }
    } catch (err) {
      this.showToast('Gagal memuat folder', 'error');
      console.error(err);
    }
    this.showLoading(false);
  },

  async fetchFolderContents(folderId) {
    try {
      // Gunakan JSON-RPC untuk list folder contents
      const res = await fetch(`${this.apiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "list",
          params: { parentId: folderId },
          id: 1
        })
      });

      const data = await res.json();
      if (data.result) {
        this.renderFiles(data.result);
      }
    } catch (err) {
      console.error('Error fetching folder:', err);
    }
  },

  async loadAllShared() {
    this.showLoading(true);
    this.currentMode = 'all-shared';
    try {
      const res = await fetch(`${this.apiBase}/all-folders`);
      const data = await res.json();

      if (data.status === 'success') {
        this.allFolders = data.folders;
        this.renderAllSharedFolders(data.folders);
        this.renderBreadcrumbAllShared();
      }
    } catch (err) {
      this.showToast('Gagal memuat folder shared', 'error');
      console.error(err);
    }
    this.showLoading(false);
  },

  renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span class="bc-root" onclick="app.loadRoot()">Blockchain</span>`;

    if (this.currentMode === 'all-shared') {
      html += ` <span class="bc-separator">/</span> <span class="bc-item">Semua Folder</span>`;
    } else {
      this.folderStack.forEach((folder, idx) => {
        html += ` <span class="bc-separator">/</span> `;
        html += `<span class="bc-item" onclick="app.navigateBack(${idx})">${folder.name}</span>`;
      });
    }

    bc.innerHTML = html;
  },

  renderBreadcrumbAllShared() {
    const bc = document.getElementById('breadcrumb');
    bc.innerHTML = `
      <span class="bc-root" onclick="app.loadRoot()">Blockchain</span>
      <span class="bc-separator">/</span>
      <span class="bc-item">Semua Folder Shared</span>
    `;
  },

  navigateBack(index) {
    this.folderStack = this.folderStack.slice(0, index + 1);
    const folder = this.folderStack[index];
    if (folder) this.loadFolder(folder.id);
    else this.loadRoot();
  },

  renderFiles(files) {
    const grid = document.getElementById('file-grid');
    if (!files || files.length === 0) {
      grid.innerHTML = '<div class="loading">Folder kosong</div>';
      return;
    }

    grid.innerHTML = files.map(file => {
      const isFolder = file.type === 'folder' || file.mimeType === 'application/vnd.google-apps.folder';
      return `
        <div class="file-card" onclick="${isFolder ? `app.navigateToFolder('${file.id}', '${file.name}')` : `app.previewFile('${file.id}', '${file.name}', '${file.mimeType}')`}">
          <div class="file-icon ${isFolder ? 'folder' : (file.mimeType?.startsWith('text/') ? 'text' : 'file')}">
            <i class="fas ${isFolder ? 'fa-folder' : (file.mimeType?.startsWith('text/') ? 'fa-file-alt' : 'fa-file')}"></i>
          </div>
          <div class="file-name">${file.name}</div>
          ${file.source ? `<div class="file-source">${file.source === 'shared' ? '🔹 Shared' : '👤 Owned'}</div>` : ''}
          <div class="file-actions" onclick="event.stopPropagation()">
            ${!isFolder ? `<button class="action-btn view" onclick="app.previewFile('${file.id}', '${file.name}', '${file.mimeType}')" title="Lihat"><i class="fas fa-eye"></i></button>` : ''}
            <button class="action-btn" onclick="app.deleteFile('${file.id}', '${file.name}')" title="Hapus"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderAllSharedFolders(folders) {
    const grid = document.getElementById('file-grid');
    if (!folders || folders.length === 0) {
      grid.innerHTML = '<div class="loading">Tidak ada folder yang di-share</div>';
      return;
    }

    // Group by source
    const sharedFolders = folders.filter(f => f.source === 'shared' || f.shared);
    const ownedFolders = folders.filter(f => f.source === 'owned' || f.ownedByMe);

    let html = '';

    if (sharedFolders.length > 0) {
      html += `<div class="folder-group"><h3 class="group-title">🔹 Folder Shared (${sharedFolders.length})</h3><div class="file-grid">`;
      html += sharedFolders.map(folder => this.renderFolderCard(folder)).join('');
      html += `</div></div>`;
    }

    if (ownedFolders.length > 0) {
      html += `<div class="folder-group"><h3 class="group-title">👤 Folder Milik Sendiri (${ownedFolders.length})</h3><div class="file-grid">`;
      html += ownedFolders.map(folder => this.renderFolderCard(folder)).join('');
      html += `</div></div>`;
    }

    grid.innerHTML = html;
  },

  renderFolderCard(folder) {
    return `
      <div class="file-card" onclick="app.navigateToFolder('${folder.id}', '${folder.name}')">
        <div class="file-icon folder">
          <i class="fas fa-folder"></i>
        </div>
        <div class="file-name">${folder.name}</div>
        <div class="file-source">${folder.source === 'shared' ? '🔹 Shared' : '👤 Owned'}</div>
        <div class="file-meta">${folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString('id-ID') : ''}</div>
        <div class="file-actions" onclick="event.stopPropagation()">
          <button class="action-btn" onclick="app.deleteFile('${folder.id}', '${folder.name}')" title="Hapus"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  },

  findFolderInTree(files, folderId) {
    for (const file of files || []) {
      if (file.id === folderId) return file;
      if (file.children) {
        const found = this.findFolderInTree(file.children, folderId);
        if (found) return found;
      }
    }
    return null;
  },

  async navigateToFolder(folderId, folderName) {
    this.folderStack.push({ id: folderId, name: folderName });
    await this.loadFolder(folderId);
  },

  updateStorage(storage) {
    document.getElementById('storage-used').textContent = storage.used_gb + ' GB';
    document.getElementById('storage-total').textContent = storage.total_gb;

    const used = parseFloat(storage.used_gb);
    const total = storage.total_gb === 'Unlimited' ? used * 2 : parseFloat(storage.total_gb);
    const percent = (used / total) * 100;

    document.getElementById('storage-progress').style.width = percent + '%';
  },

  async showStorage() {
    try {
      const res = await fetch(`${this.apiBase}`);
      const data = await res.json();
      const storage = data.storage;

      document.getElementById('storage-details').innerHTML = `
        <div class="storage-detail-item">
          <p><strong>Total:</strong> ${storage.total_gb} GB</p>
          <p><strong>Used:</strong> ${storage.used_gb} GB</p>
          <p><strong>Root Folder:</strong> ${data.rootFolder || 'N/A'}</p>
          <p><strong>Mode:</strong> ${data.mode || data.drive_mode || 'N/A'}</p>
          <p><strong>Detect All Shared:</strong> ${data.detect_all_shared ? 'Aktif' : 'Tidak Aktif'}</p>
        </div>
      `;
      this.showModal('storage-modal');
    } catch (err) {
      this.showToast('Gagal memuat storage info', 'error');
    }
  },

  async previewFile(fileId, fileName, mimeType) {
    if (!mimeType?.startsWith('text/') && mimeType !== 'application/json') {
      this.showToast('Preview hanya untuk file teks', 'warning');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}`);
      const data = await res.json();
      const file = this.findFileInTree(data.data, fileId);

      document.getElementById('preview-title').textContent = fileName;
      document.getElementById('preview-content').textContent = file?.content || 'Tidak dapat membaca konten';
      this.showModal('preview-modal');
    } catch (err) {
      this.showToast('Gagal memuat preview', 'error');
    }
  },

  async deleteFile(fileId, fileName) {
    if (!confirm(`Hapus "${fileName}"?`)) return;

    try {
      const res = await fetch(`${this.apiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "delete",
          params: { id: fileId },
          id: 1
        })
      });

      const data = await res.json();
      if (data.result?.success) {
        this.showToast('File dihapus', 'success');
        this.refresh();
      } else {
        this.showToast(data.error || 'Gagal menghapus', 'error');
      }
    } catch (err) {
      this.showToast('Gagal menghapus file', 'error');
    }
  },

  async createFolder() {
    const name = document.getElementById('folder-name').value.trim();
    if (!name) return this.showToast('Nama folder wajib diisi', 'error');

    this.showToast('Create folder belum diimplementasikan di backend', 'warning');
    this.closeModal('folder-modal');
  },

  async createFile() {
    const name = document.getElementById('file-name').value.trim();
    const content = document.getElementById('file-content').value;

    if (!name) return this.showToast('Nama file wajib diisi', 'error');

    try {
      const res = await fetch(`${this.apiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "create",
          params: { name, content },
          id: 1
        })
      });

      const data = await res.json();
      if (data.result) {
        this.showToast('File dibuat', 'success');
        this.closeModal('file-modal');
        this.refresh();
      } else {
        this.showToast(data.error || 'Gagal membuat file', 'error');
      }
    } catch (err) {
      this.showToast('Gagal membuat file', 'error');
    }
  },

  showCreateModal() { this.showModal('create-modal'); },
  showNewFolderModal() { this.closeModal('create-modal'); this.showModal('folder-modal'); },
  showNewFileModal() { this.closeModal('create-modal'); this.showModal('file-modal'); },

  showModal(id) { document.getElementById(id).classList.add('active'); },
  closeModal(id) { document.getElementById(id).classList.remove('active'); },

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
    document.getElementById('file-grid').style.display = show ? 'none' : 'grid';
  },

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  },

  refresh() {
    if (this.currentMode === 'all-shared') {
      this.loadAllShared();
    } else {
      this.loadRoot();
    }
  },

  navigate(page) {
    if (page === 'shared') {
      this.loadAllShared();
    } else {
      this.loadRoot();
    }
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');
  }
};

// Init
document.addEventListener('DOMContentLoaded', () => app.init());