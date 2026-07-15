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
        // Kalau DETECT_ALL_SHARED, list semua folder yang di-share
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
          const files = await listFiles(`'${rootId}' in parents and trashed = false`);
          result = files.map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file'
          }));
        }
        break;

      case "create":
        const createData = {
          resource: { name: params.name, parents: [rootId || params.parentId] },
          media: { body: params.content || '' },
          fields: 'id, name',
        };
        if (DRIVE_MODE === 'shared') {
          createData.supportsAllDrives = true;
        }
        const file = await drive.files.create(createData);
        result = { id: file.data.id, name: file.data.name };
        break;

      case "delete":
        const deleteData = { 
          fileId: params.id,
        };
        if (DRIVE_MODE === 'shared') {
          deleteData.supportsAllDrives = true;
        }
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
    // Kalau DETECT_ALL_SHARED, tampilkan semua folder yang di-share
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
    const shared = await listFiles(`sharedWithMe = true and trashed = false`);
    res.json({
      status: "success",
      total: shared.length,
      sharedFolders: shared.filter(f => f.mimeType === 'application/vnd.google-apps.folder').map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        parents: f.parents,
        shared: f.shared,
        ownedByMe: f.ownedByMe,
        driveId: f.driveId
      })),
      sharedFiles: shared.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType
      }))
    });
  } catch (err) {
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
    res.status(500).json({ status: "error", error: err.message });
  }
});

module.exports = router;