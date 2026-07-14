const { drive } = require('../config/google');

const ROOT_FOLDER_NAME = "Blockchain";

// Helper list files dengan support shared drive
async function listFiles(q, fields = 'files(id, name, mimeType, parents, shared, ownedByMe, driveId)') {
  const res = await drive.files.list({
    q,
    fields,
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1000,
  });
  return res.data.files;
}

// Cari atau buat root folder
async function getOrCreateRootFolder() {
  const files = await listFiles(
    `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  if (files.length > 0) return files[0].id;

  const folder = await drive.files.create({
    resource: { name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
    supportsAllDrives: true,
  });
  return folder.data.id;
}

// Rekursif baca struktur folder
async function readAll(folderId) {
  const files = await listFiles(`'${folderId}' in parents and trashed = false`);

  return await Promise.all(files.map(async (file) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return { ...file, type: "folder", children: await readAll(file.id) };
    }

    let content = null;
    if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
      try {
        const fileContent = await drive.files.get({ 
          fileId: file.id, 
          alt: 'media',
          supportsAllDrives: true,
        });
        content = fileContent.data;
      } catch (e) { content = "Cannot read"; }
    }
    return { ...file, type: "file", content };
  }));
}

// Info storage
async function getStorageInfo() {
  const res = await drive.about.get({ fields: 'storageQuota' });
  return res.data.storageQuota;
}

module.exports = {
  listFiles,
  getOrCreateRootFolder,
  readAll,
  getStorageInfo,
  ROOT_FOLDER_NAME
};