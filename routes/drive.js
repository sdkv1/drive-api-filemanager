const express = require('express');
const router = express.Router();
const { drive, DRIVE_MODE, SHARED_FOLDER_ID, DETECT_ALL_SHARED } = require('../config/google');
const { getOrCreateRootFolder, detectAllSharedFolders, readAll, getStorageInfo, listFiles } = require('../utils/helpers');

// ─── JSON-RPC POST ───
router.post('/', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ 
      jsonrpc: "2.0", 
      id: req.body.id, 
      error: "Google Drive API tidak terinisialisasi. Cek GOOGLE_SERVICE_ACCOUNT_KEY_B64." 
    });
  }

  const { jsonrpc, method, params, id } = req.body;
  if (jsonrpc !== "2.0") {
    return res.status(400).json({ jsonrpc: "2.0", id, error: "Invalid JSON-RPC" });
  }

  try {
    const rootId = await getOrCreateRootFolder();
    let result;

    switch (method) {
      case "list":
        if (DETECT_ALL_SHARED) {
          const allFolders = await detectAllSharedFolders();
          result = allFolders.map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            type: 'folder',
            source: f.source,
            createdTime: f.createdTime,
            modifiedTime: f.modifiedTime
          }));
        } else {
          const targetId = params.parentId || rootId;
          if (!targetId) throw new Error("Tidak ada folder tujuan.");
          const files = await listFiles(`'${targetId}' in parents and trashed = false`);
          result = files.map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file'
          }));
        }
        break;

      case "create":
        const parentId = params.parentId || rootId || SHARED_FOLDER_ID;
        if (!parentId) {
          throw new Error("Tidak ada folder parent. Set DETECT_ALL_SHARED=true atau SHARED_FOLDER_ID.");
        }
        const createData = {
          resource: { name: params.name, parents: [parentId] },
          media: { body: params.content || '' },
          fields: 'id, name',
          supportsAllDrives: true,
        };
        const file = await drive.files.create(createData);
        result = { id: file.data.id, name: file.data.name };
        break;

      case "delete":
        const deleteData = { 
          fileId: params.id,
          supportsAllDrives: true,
        };
        await drive.files.delete(deleteData);
        result = { success: true };
        break;

      default:
        throw new Error("Method not found");
    }
    res.json({ jsonrpc: "2.0", id, result });
  } catch (err) {
    console.error("[ERROR] JSON-RPC:", err.message);
    res.json({ jsonrpc: "2.0", id, error: err.message });
  }
});

// ─── GET: Baca struktur folder ───
router.get('/', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ 
      status: "error",
      message: "Google Drive API tidak terinisialisasi. Cek GOOGLE_SERVICE_ACCOUNT_KEY_B64.",
      env_check: {
        has_key: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64,
        key_length: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64.length : 0
      }
    });
  }

  try {
    if (DETECT_ALL_SHARED) {
      const allFolders = await detectAllSharedFolders();
      const storage = await getStorageInfo();

      res.json({
        status: "success",
        mode: "detect_all_shared",
        drive_mode: DRIVE_MODE,
        detect_all_shared: DETECT_ALL_SHARED,
        total_folders: allFolders.length,
        storage: {
          total_gb: storage.limit ? (storage.limit / 1024 / 1024 / 1024).toFixed(2) : 'Unlimited',
          used_gb: (storage.usage / 1024 / 1024 / 1024).toFixed(2)
        },
        data: allFolders
      });
      return;
    }

    const rootId = await getOrCreateRootFolder();
    const storage = await getStorageInfo();
    const data = await readAll(rootId);

    res.json({
      status: "success",
      rootFolder: "Blockchain",
      rootId: rootId,
      drive_mode: DRIVE_MODE,
      shared_folder_id: SHARED_FOLDER_ID,
      detect_all_shared: DETECT_ALL_SHARED,
      storage: {
        total_gb: storage.limit ? (storage.limit / 1024 / 1024 / 1024).toFixed(2) : 'Unlimited',
        used_gb: (storage.usage / 1024 / 1024 / 1024).toFixed(2)
      },
      data: data
    });
  } catch (err) {
    console.error("[ERROR] GET /drive:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ─── GET: List folder shared (debug) ───
router.get('/shared', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ 
      status: "error", 
      message: "Google Drive API tidak terinisialisasi." 
    });
  }

  try {
    console.log("[INFO] Fetching shared items...");

    let sharedFolders = [];
    let sharedFiles = [];
    let allFolders = [];

    try {
      const shared = await listFiles(`sharedWithMe = true and trashed = false`);
      console.log(`[INFO] Found ${shared.length} shared items`);

      sharedFolders = shared.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      sharedFiles = shared.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    } catch (e) {
      console.log("[WARN] Error fetching sharedWithMe:", e.message);
    }

    try {
      allFolders = await listFiles(`mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
      console.log(`[INFO] Found ${allFolders.length} total folders`);
    } catch (e) {
      console.log("[WARN] Error fetching all folders:", e.message);
    }

    res.json({
      status: "success",
      total_shared_items: sharedFolders.length + sharedFiles.length,
      shared_folders_count: sharedFolders.length,
      shared_files_count: sharedFiles.length,
      total_all_folders: allFolders.length,
      sharedFolders: sharedFolders.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        parents: f.parents,
        shared: f.shared,
        ownedByMe: f.ownedByMe,
        driveId: f.driveId
      })),
      sharedFiles: sharedFiles.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType
      })),
      allFolders: allFolders.map(f => ({
        id: f.id,
        name: f.name,
        ownedByMe: f.ownedByMe,
        shared: f.shared
      }))
    });
  } catch (err) {
    console.error("[ERROR] GET /drive/shared:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ─── GET: Detect all folders (owned + shared) ───
router.get('/all-folders', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ 
      status: "error", 
      message: "Google Drive API tidak terinisialisasi." 
    });
  }

  try {
    const allFolders = await detectAllSharedFolders();
    res.json({
      status: "success",
      total: allFolders.length,
      folders: allFolders.map(f => ({
        id: f.id,
        name: f.name,
        source: f.source,
        shared: f.shared,
        ownedByMe: f.ownedByMe,
        driveId: f.driveId,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime
      }))
    });
  } catch (err) {
    console.error("[ERROR] GET /drive/all-folders:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ─── POST: Share folder ke user (permission) ───
router.post('/permission', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ status: "error", message: "Google Drive API tidak terinisialisasi." });
  }

  try {
    const { fileId, email, role = 'reader' } = req.body;

    if (!fileId || !email) {
      return res.status(400).json({ status: "error", message: "fileId dan email wajib diisi" });
    }

    const permission = await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        type: 'user',
        role: role, // 'reader', 'commenter', 'writer', 'owner'
        emailAddress: email,
      },
      sendNotificationEmail: true,
      supportsAllDrives: true,
      fields: 'id, role, type, emailAddress'
    });

    res.json({
      status: "success",
      message: `Permission ${role} diberikan ke ${email}`,
      permission: permission.data
    });
  } catch (err) {
    console.error("[ERROR] POST /drive/permission:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ─── GET: List permissions suatu file/folder ───
router.get('/permission/:fileId', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ status: "error", message: "Google Drive API tidak terinisialisasi." });
  }

  try {
    const { fileId } = req.params;

    const permissions = await drive.permissions.list({
      fileId: fileId,
      supportsAllDrives: true,
      fields: 'permissions(id, role, type, emailAddress, displayName)'
    });

    res.json({
      status: "success",
      fileId: fileId,
      permissions: permissions.data.permissions
    });
  } catch (err) {
    console.error("[ERROR] GET /drive/permission:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ─── DELETE: Hapus permission ───
router.delete('/permission', async (req, res) => {
  if (!drive) {
    return res.status(500).json({ status: "error", message: "Google Drive API tidak terinisialisasi." });
  }

  try {
    const { fileId, permissionId } = req.body;

    if (!fileId || !permissionId) {
      return res.status(400).json({ status: "error", message: "fileId dan permissionId wajib diisi" });
    }

    await drive.permissions.delete({
      fileId: fileId,
      permissionId: permissionId,
      supportsAllDrives: true,
    });

    res.json({
      status: "success",
      message: "Permission dihapus"
    });
  } catch (err) {
    console.error("[ERROR] DELETE /drive/permission:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

module.exports = router;