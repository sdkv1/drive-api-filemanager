const { google } = require('googleapis');

function getCredentials() {
  const b64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64Key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 tidak ditemukan!");
  return JSON.parse(Buffer.from(b64Key, 'base64').toString('utf-8'));
}

const auth = new google.auth.GoogleAuth({
  credentials: getCredentials(),
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

module.exports = { drive, auth };