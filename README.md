# Drive API File Manager

File Manager dengan Google Drive API + Express + Frontend HTML/CSS/JS

## Setup

1. Clone repo
2. `npm install`
3. Set environment variable `GOOGLE_SERVICE_ACCOUNT_KEY_B64` (base64 encoded service account JSON)
4. `npm start`

## Deploy Vercel

```bash
vercel --prod
```

Jangan lupa set environment variable di Vercel Dashboard.

## API Endpoints

- `GET /drive` - List struktur folder & storage info
- `POST /drive` - JSON-RPC (list, create, delete)
- `GET /drive/shared` - List shared folders

## Frontend

Akses root `/` untuk membuka File Manager UI.
