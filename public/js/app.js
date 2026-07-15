const app = {
  currentFolder: null,
  folderStack: [],
  apiBase: '/drive',
  allFolders: [],
  currentMode: 'root',
  selectedFolderId: null,

  init() {
    this.loadRoot();
  },

  async loadRoot() {
    this.showLoading(true);
    this.currentMode = 'root';
    this.selectedFolderId = null;
    try {
      const res = await fetch(`${this.apiBase}`);
      const data = await res.json();

      if (data.status === 'success') {
        this.currentFolder = data.rootId;
        this.folderStack = [];
        this.renderBreadcrumb();

        if (data.mode === 'detect_all_shared') {
          this.allFolders = data.data;
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

  async loadFolder(folderId, folderName) {
    this.showLoading(true);
    this.currentMode = 'folder';
    this.selectedFolderId = folderId;
    try {
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
        this.folderStack.push({ id: folderId, name: folderName });
        this.renderBreadcrumb();
        this.renderFiles(data.result);
      } else if (data.error) {
        this.showToast(data.error, 'error');
      }
    } catch (err) {
      this.showToast('Gagal memuat folder', 'error');
      console.error(err);
    }
    this.showLoading(false);
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

    this.folderStack.forEach((folder, idx) => {
      html += ` <span class="bc-separator">/</span> `;
      html += `<span class="bc-item" onclick="app.navigateBack(${idx})">${folder.name}</span>`;
    });

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
    if (folder) {
      this.selectedFolderId = folder.id;
      this.loadFolder(folder.id, folder.name);
    } else {
      this.loadRoot();
    }
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
        <div class="file-card" onclick="${isFolder ? `app.loadFolder('${file.id}', '${file.name}')` : `app.previewFile('${file.id}', '${file.name}', '${file.mimeType}')`}">
          <div class="file-icon ${isFolder ? 'folder' : (file.mimeType?.startsWith('text/') ? 'text' : 'file')}">
            <i class="fas ${isFolder ? 'fa-folder' : (file.mimeType?.startsWith('text/') ? 'fa-file-alt' : 'fa-file')}"></i>
          </div>
          <div class="file-name">${file.name}</div>
          ${file.source ? `<div class="file-source">${file.source === 'shared' ? '🔹 Shared' : '👤 Owned'}</div>` : ''}
          <div class="file-actions" onclick="event.stopPropagation()">
            ${isFolder ? `<button class="action-btn view" onclick="app.showPermissionModal('${file.id}', '${file.name}')" title="Share"><i class="fas fa-share-alt"></i></button>` : ''}
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
      grid.innerHTML = `
        <div class="loading">
          <p>Tidak ada folder yang di-share</p>
          <p style="font-size:0.8rem;margin-top:8px;">Share folder dari Google Drive ke service account</p>
        </div>
      `;
      return;
    }

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
      <div class="file-card" onclick="app.loadFolder('${folder.id}', '${folder.name}')">
        <div class="file-icon folder">
          <i class="fas fa-folder"></i>
        </div>
        <div class="file-name">${folder.name}</div>
        <div class="file-source">${folder.source === 'shared' ? '🔹 Shared' : '👤 Owned'}</div>
        <div class="file-meta">${folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString('id-ID') : ''}</div>
        <div class="file-actions" onclick="event.stopPropagation()">
          <button class="action-btn view" onclick="app.showPermissionModal('${folder.id}', '${folder.name}')" title="Share"><i class="fas fa-share-alt"></i></button>
          <button class="action-btn" onclick="app.deleteFile('${folder.id}', '${folder.name}')" title="Hapus"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  },

  async showPermissionModal(fileId, fileName) {
    this.selectedFileId = fileId;
    document.getElementById('permission-file-name').textContent = fileName;

    // Load existing permissions
    try {
      const res = await fetch(`${this.apiBase}/permission/${fileId}`);
      const data = await res.json();
      if (data.status === 'success' && data.permissions) {
        this.renderPermissions(data.permissions);
      }
    } catch (err) {
      console.error('Error loading permissions:', err);
      document.getElementById('permission-list').innerHTML = '<p>Gagal memuat permissions</p>';
    }

    this.showModal('permission-modal');
  },

  renderPermissions(permissions) {
    const list = document.getElementById('permission-list');
    if (!permissions || permissions.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted)">Belum ada sharing</p>';
      return;
    }

    list.innerHTML = permissions.map(p => `
      <div class="permission-item">
        <div class="permission-info">
          <span class="permission-email">${p.emailAddress || p.displayName || 'Unknown'}</span>
          <span class="permission-role">${p.role}</span>
        </div>
        <button class="action-btn" onclick="app.deletePermission('${p.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  },

  async addPermission() {
    const email = document.getElementById('permission-email').value.trim();
    const role = document.getElementById('permission-role').value;

    if (!email) return this.showToast('Email wajib diisi', 'error');
    if (!this.selectedFileId) return this.showToast('Pilih file/folder dulu', 'error');

    try {
      const res = await fetch(`${this.apiBase}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: this.selectedFileId,
          email: email,
          role: role
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        this.showToast('Permission ditambahkan', 'success');
        document.getElementById('permission-email').value = '';
        // Refresh permission list
        this.showPermissionModal(this.selectedFileId, document.getElementById('permission-file-name').textContent);
      } else {
        this.showToast(data.error || 'Gagal menambahkan permission', 'error');
      }
    } catch (err) {
      this.showToast('Gagal menambahkan permission', 'error');
    }
  },

  async deletePermission(permissionId) {
    if (!confirm('Hapus permission ini?')) return;

    try {
      const res = await fetch(`${this.apiBase}/permission`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: this.selectedFileId,
          permissionId: permissionId
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        this.showToast('Permission dihapus', 'success');
        this.showPermissionModal(this.selectedFileId, document.getElementById('permission-file-name').textContent);
      } else {
        this.showToast(data.error || 'Gagal menghapus permission', 'error');
      }
    } catch (err) {
      this.showToast('Gagal menghapus permission', 'error');
    }
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
      const res = await fetch(`${this.apiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "list",
          params: { parentId: this.selectedFolderId },
          id: 1
        })
      });

      const data = await res.json();
      let content = 'Tidak dapat membaca konten';

      if (data.result) {
        const file = data.result.find(f => f.id === fileId);
        if (file && file.content) content = file.content;
      }

      document.getElementById('preview-title').textContent = fileName;
      document.getElementById('preview-content').textContent = content;
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

    const parentId = this.selectedFolderId || (this.allFolders[0] ? this.allFolders[0].id : null);
    if (!parentId) {
      this.showToast('Tidak ada folder tujuan. Aktifkan DETECT_ALL_SHARED atau set SHARED_FOLDER_ID.', 'error');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "create",
          params: { name, content, parentId },
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
    } else if (this.currentMode === 'folder' && this.selectedFolderId) {
      this.loadFolder(this.selectedFolderId, this.folderStack[this.folderStack.length - 1]?.name || 'Folder');
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