const express = require('express');
const router = express.Router();
const { drive } = require('../config/google');
const { getOrCreateRootFolder, readAll, getStorageInfo, listFiles } = require('../utils/helpers');

// ─── JSON-RPC POST ───
router.post('/', async (req, res) => {
  // Check if drive is initialized
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
        const files = await listFiles(`'${rootId}' in parents and trashed = false`);
        result = files.map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file'
        }));
        break;

      case "create":
        const file = await drive.files.create({
          resource: { name: params.name, parents: [rootId] },
          media: { body: params.content || '' },
          fields: 'id, name',
          supportsAllDrives: true,
        });
        result = { id: file.data.id, name: file.data.name };
        break;

      case "delete":
        await drive.files.delete({ 
          fileId: params.id,
          supportsAllDrives: true,
        });
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
  // Check if drive is initialized
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
    const rootId = await getOrCreateRootFolder();
    const storage = await getStorageInfo();
    const data = await readAll(rootId);

    res.json({
      status: "success",
      rootFolder: "Blockchain",
      rootId: rootId,
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
      sharedFolders: shared.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

module.exports = router;