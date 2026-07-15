const { drive, DRIVE_MODE, SHARED_FOLDER_ID, DETECT_ALL_SHARED } = require('../config/google');

const ROOT_FOLDER_NAME = "Blockchain";

// Helper list files dengan support shared drive
async function listFiles(q, fields = 'files(id, name, mimeType, parents, shared, ownedByMe, driveId, createdTime, modifiedTime)') {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

  const params = {
    q,
    fields,
    pageSize: 1000,
  };

  // Selalu aktifkan allDrives untuk bisa baca shared folders
  params.corpora = 'allDrives';
  params.includeItemsFromAllDrives = true;
  params.supportsAllDrives = true;

  const res = await drive.files.list(params);
  return res.data.files || [];
}

// Detect SEMUA folder yang di-share ke service account
async function detectAllSharedFolders() {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

  console.log("[INFO] Mendeteksi semua folder...");

  let allFolders = [];
  const seenIds = new Set();

  try {
    // 1. Folder yang di-share ke service account (sharedWithMe)
    const sharedFolders = await listFiles(
      `sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      'files(id, name, mimeType, parents, shared, ownedByMe, driveId, createdTime, modifiedTime)'
    );
    console.log(`[INFO] Shared folders: ${sharedFolders.length}`);

    for (const folder of sharedFolders) {
      if (!seenIds.has(folder.id)) {
        seenIds.add(folder.id);
        allFolders.push({
          ...folder,
          type: 'folder',
          source: 'shared',
          children: []
        });
      }
    }
  } catch (e) {
    console.log("[WARN] Gagal fetch shared folders:", e.message);
  }

  try {
    // 2. Folder yang dibuat oleh service account sendiri
    const ownFolders = await listFiles(
      `mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      'files(id, name, mimeType, parents, shared, ownedByMe, driveId, createdTime, modifiedTime)'
    );
    console.log(`[INFO] Own folders: ${ownFolders.length}`);

    for (const folder of ownFolders) {
      if (!seenIds.has(folder.id)) {
        seenIds.add(folder.id);
        allFolders.push({
          ...folder,
          type: 'folder',
          source: folder.ownedByMe ? 'owned' : 'shared',
          children: []
        });
      }
    }
  } catch (e) {
    console.log("[WARN] Gagal fetch own folders:", e.message);
  }

  console.log(`[INFO] Total unique folders: ${allFolders.length}`);
  return allFolders;
}

// Cari atau buat root folder
async function getOrCreateRootFolder() {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

  // Kalau DETECT_ALL_SHARED = true, return null (nanti handle di routes)
  if (DETECT_ALL_SHARED) {
    console.log("[INFO] Mode DETECT_ALL_SHARED aktif, skip root folder");
    return null;
  }

  // Kalau ada SHARED_FOLDER_ID, pakai itu langsung
  if (SHARED_FOLDER_ID) {
    console.log("[INFO] Menggunakan SHARED_FOLDER_ID:", SHARED_FOLDER_ID);
    return SHARED_FOLDER_ID;
  }

  // Cari folder yang sudah ada
  const files = await listFiles(
    `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  if (files.length > 0) return files[0].id;

  // Buat folder baru (tapi service account tidak punya storage quota)
  // Jadi ini akan error kalau tidak ada shared drive
  console.log("[WARN] Membuat folder baru, mungkin error karena service account tanpa storage");
  const folderData = {
    resource: { 
      name: ROOT_FOLDER_NAME, 
      mimeType: 'application/vnd.google-apps.folder' 
    },
    fields: 'id',
    supportsAllDrives: true,
  };

  const folder = await drive.files.create(folderData);
  return folder.data.id;
}

// Rekursif baca struktur folder
async function readAll(folderId) {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

  const files = await listFiles(`'${folderId}' in parents and trashed = false`);

  return await Promise.all(files.map(async (file) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return { ...file, type: "folder", children: await readAll(file.id) };
    }

    let content = null;
    if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
      try {
        const params = { 
          fileId: file.id, 
          alt: 'media',
          supportsAllDrives: true,
        };
        const fileContent = await drive.files.get(params);
        content = fileContent.data;
      } catch (e) { 
        content = "Cannot read"; 
      }
    }
    return { ...file, type: "file", content };
  }));
}

// Info storage
async function getStorageInfo() {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

  try {
    const res = await drive.about.get({ fields: 'storageQuota' });
    return res.data.storageQuota;
  } catch (e) {
    console.log("[INFO] Service account tidak punya storage quota, return default");
    return { 
      limit: null, 
      usage: 0,
      usageInDrive: 0,
      usageInDriveTrash: 0
    };
  }
}

module.exports = {
  listFiles,
  detectAllSharedFolders,
  getOrCreateRootFolder,
  readAll,
  getStorageInfo,
  ROOT_FOLDER_NAME
};