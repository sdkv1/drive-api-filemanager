const { drive, DRIVE_MODE, SHARED_FOLDER_ID } = require('../config/google');

const ROOT_FOLDER_NAME = "Blockchain";

// Helper list files dengan support shared drive
async function listFiles(q, fields = 'files(id, name, mimeType, parents, shared, ownedByMe, driveId)') {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

  const params = {
    q,
    fields,
    pageSize: 1000,
  };

  // Kalau shared drive, tambah parameter shared drive
  if (DRIVE_MODE === 'shared') {
    params.corpora = 'allDrives';
    params.includeItemsFromAllDrives = true;
    params.supportsAllDrives = true;
  }

  const res = await drive.files.list(params);
  return res.data.files;
}

// Cari atau buat root folder
async function getOrCreateRootFolder() {
  if (!drive) throw new Error("Google Drive API tidak terinisialisasi");

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

  // Buat folder baru
  const folderData = {
    resource: { 
      name: ROOT_FOLDER_NAME, 
      mimeType: 'application/vnd.google-apps.folder' 
    },
    fields: 'id',
  };

  if (DRIVE_MODE === 'shared') {
    folderData.supportsAllDrives = true;
  }

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
        };
        if (DRIVE_MODE === 'shared') {
          params.supportsAllDrives = true;
        }
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
    // Service account tidak punya storage quota
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
  getOrCreateRootFolder,
  readAll,
  getStorageInfo,
  ROOT_FOLDER_NAME
};