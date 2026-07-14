# Drive API File Manager

File Manager dengan Google Drive API + Express + Frontend HTML/CSS/JS

## Deploy ke Vercel

### 1. Import Project dari GitHub
- Buka [vercel.com](https://vercel.com)
- Klik "Add New Project" → "Import Git Repository"
- Pilih repo `sdkv1/drive-api-filemanager`

### 2. Set Environment Variable
Di Vercel Dashboard → Project Settings → Environment Variables:
- **Name:** `GOOGLE_SERVICE_ACCOUNT_KEY_B64`
- **Value:** Base64 encoded service account JSON key

Cara generate base64:
```bash
base64 -i service-account.json | tr -d '\n'
```

### 3. Deploy
Klik "Deploy" dan tunggu build selesai.

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/drive` | List struktur folder & storage info |
| POST | `/drive` | JSON-RPC (list, create, delete) |
| GET | `/drive/shared` | List shared folders |

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

## Frontend

Akses root URL `/` untuk membuka File Manager UI.

## Local Development

```bash
git clone https://github.com/sdkv1/drive-api-filemanager.git
cd drive-api-filemanager
npm install
# Set GOOGLE_SERVICE_ACCOUNT_KEY_B64 di .env
npm start
```
