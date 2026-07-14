const express = require('express');
const router = express.Router();
const { drive } = require('../config/google');
const { getOrCreateRootFolder, readAll, getStorageInfo, listFiles } = require('../utils/helpers');

// ─── JSON-RPC POST ───
router.post('/', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ─── GET: List folder shared (debug) ───
router.get('/shared', async (req, res) => {
  try {
    const shared = await listFiles(`sharedWithMe = true and trashed = false`);
    res.json({
      status: "success",
      sharedFolders: shared.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;