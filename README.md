# Drive API File Manager

File Manager dengan Google Drive API + Express + Frontend HTML/CSS/JS

## ⚠️ Penting: Service Account & Storage

Service Account (akun robot Google) **tidak punya storage quota** sendiri. Ada 3 cara:

### Cara 1: Detect All Shared Folders ⭐ (Baru)
Aktifkan `DETECT_ALL_SHARED=true` untuk otomatis mendeteksi SEMUA folder yang di-share ke Service Account dan folder milik Service Account sendiri.

**Setup:**
1. Set `DETECT_ALL_SHARED=true` di Vercel
2. Share folder dari Google Drive pribadi ke email Service Account
3. Folder akan otomatis muncul di UI

### Cara 2: Shared Drive (Google Workspace)
1. Buat **Shared Drive** di Google Drive
2. Share ke email Service Account (Editor)
3. Set `DRIVE_MODE=shared` di Vercel

### Cara 3: Personal Folder (Hardcode ID)
1. Buat folder di Google Drive pribadi
2. Share folder ke email Service Account (Editor)
3. Copy **Folder ID** dari URL
4. Set `SHARED_FOLDER_ID=ID_FOLDER` di Vercel

## Deploy ke Vercel

### 1. Import Project dari GitHub
- Buka [vercel.com](https://vercel.com)
- Klik "Add New Project" → "Import Git Repository"
- Pilih repo `sdkv1/drive-api-filemanager`

### 2. Set Environment Variables

| Variable | Required | Default | Keterangan |
|----------|----------|---------|------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_B64` | ✅ | - | Base64 encoded service account JSON |
| `DETECT_ALL_SHARED` | ❌ | `false` | `true` untuk detect semua folder shared |
| `DRIVE_MODE` | ❌ | `personal` | `personal` atau `shared` |
| `SHARED_FOLDER_ID` | ❌ | - | Folder ID (kalau personal mode) |

Cara generate base64:
```bash
base64 -i service-account.json | tr -d '\n'
```

### 3. Deploy
Klik "Deploy" dan tunggu build selesai.

## Cara Dapatkan Folder ID

1. Buka Google Drive → buka folder
2. URL: `https://drive.google.com/drive/folders/1ABC123xyz`
3. Folder ID = `1ABC123xyz`

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Test server |
| GET | `/api/test` | Test env var |
| GET | `/drive` | List struktur folder & storage |
| POST | `/drive` | JSON-RPC (list, create, delete) |
| GET | `/drive/shared` | List shared items |
| GET | `/drive/all-folders` | Detect SEMUA folder (owned + shared) |

## JSON-RPC Methods

```json
// List files
{
  "jsonrpc": "2.0",
  "method": "list",
  "params": {},
  "id": 1
}

// Create file
{
  "jsonrpc": "2.0",
  "method": "create",
  "params": { "name": "file.txt", "content": "Hello World" },
  "id": 1
}

// Delete file
{
  "jsonrpc": "2.0",
  "method": "delete",
  "params": { "id": "FILE_ID" },
  "id": 1
}
```

## Local Development

```bash
git clone https://github.com/sdkv1/drive-api-filemanager.git
cd drive-api-filemanager
npm install
# Set GOOGLE_SERVICE_ACCOUNT_KEY_B64 di .env
npm start
```
