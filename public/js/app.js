const app = {
  currentFolder: null,
  folderStack: [],
  apiBase: '/drive',

  init() {
    this.loadFolder('root');
  },

  async loadFolder(folderId) {
    this.showLoading(true);
    try {
      const res = await fetch(`${this.apiBase}`);
      const data = await res.json();

      if (data.status === 'success') {
        this.currentFolder = data.rootId;
        this.folderStack = folderId === 'root' ? [] : this.folderStack;
        this.renderBreadcrumb();
        this.renderFiles(data.data);
        this.updateStorage(data.storage);
      }
    } catch (err) {
      this.showToast('Gagal memuat data', 'error');
      console.error(err);
    }
    this.showLoading(false);
  },

  async navigateToFolder(folderId, folderName) {
    this.folderStack.push({ id: folderId, name: folderName });
    await this.loadFolder(folderId);
  },

  renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span class="bc-root" onclick="app.loadFolder('root')">Blockchain</span>`;

    this.folderStack.forEach((folder, idx) => {
      html += ` <span class="bc-separator">/</span> `;
      html += `<span class="bc-item" onclick="app.navigateBack(${idx})">${folder.name}</span>`;
    });

    bc.innerHTML = html;
  },

  navigateBack(index) {
    this.folderStack = this.folderStack.slice(0, index + 1);
    const folder = this.folderStack[index];
    if (folder) this.loadFolder(folder.id);
    else this.loadFolder('root');
  },

  renderFiles(files) {
    const grid = document.getElementById('file-grid');
    if (!files || files.length === 0) {
      grid.innerHTML = '<div class="loading">Folder kosong</div>';
      return;
    }

    grid.innerHTML = files.map(file => {
      const isFolder = file.type === 'folder';
      return `
        <div class="file-card" onclick="${isFolder ? `app.navigateToFolder('${file.id}', '${file.name}')` : `app.previewFile('${file.id}', '${file.name}', '${file.mimeType}')`}">
          <div class="file-icon ${isFolder ? 'folder' : (file.mimeType?.startsWith('text/') ? 'text' : 'file')}">
            <i class="fas ${isFolder ? 'fa-folder' : (file.mimeType?.startsWith('text/') ? 'fa-file-alt' : 'fa-file')}"></i>
          </div>
          <div class="file-name">${file.name}</div>
          <div class="file-actions" onclick="event.stopPropagation()">
            ${!isFolder ? `<button class="action-btn view" onclick="app.previewFile('${file.id}', '${file.name}', '${file.mimeType}')" title="Lihat"><i class="fas fa-eye"></i></button>` : ''}
            <button class="action-btn" onclick="app.deleteFile('${file.id}', '${file.name}')" title="Hapus"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
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
          <p><strong>Root Folder:</strong> ${data.rootFolder}</p>
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

  findFileInTree(files, fileId) {
    for (const file of files) {
      if (file.id === fileId) return file;
      if (file.children) {
        const found = this.findFileInTree(file.children, fileId);
        if (found) return found;
      }
    }
    return null;
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
    this.loadFolder(this.currentFolder || 'root');
  },

  navigate(page) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');
  }
};

// Init
document.addEventListener('DOMContentLoaded', () => app.init());