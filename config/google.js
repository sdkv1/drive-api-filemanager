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
  // Create dummy drive object untuk prevent crash
  drive = null;
}

module.exports = { drive, auth };