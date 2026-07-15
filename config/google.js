const { google } = require('googleapis');

function getCredentials() {
  const b64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64Key) {
    console.error("[ERROR] GOOGLE_SERVICE_ACCOUNT_KEY_B64 tidak ditemukan!");
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 tidak ditemukan!");
  }
  try {
    const decoded = Buffer.from(b64Key, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error("[ERROR] Gagal decode base64:", e.message);
    throw new Error("Gagal decode base64 key: " + e.message);
  }
}

let auth, drive;

try {
  auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  drive = google.drive({ version: 'v3', auth });
  console.log("[INFO] Google Drive API initialized successfully");
} catch (e) {
  console.error("[ERROR] Gagal init Google Drive:", e.message);
  drive = null;
}

// Mode: 'shared' = shared drive, 'personal' = folder di akun pribadi
const DRIVE_MODE = process.env.DRIVE_MODE || 'personal';
// Kalau personal, pakai folder ID yang di-share ke service account
const SHARED_FOLDER_ID = process.env.SHARED_FOLDER_ID || null;
// Auto detect semua folder yang di-share ke service account
const DETECT_ALL_SHARED = process.env.DETECT_ALL_SHARED === 'true';

module.exports = { drive, auth, DRIVE_MODE, SHARED_FOLDER_ID, DETECT_ALL_SHARED };