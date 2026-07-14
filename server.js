const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/drive', routes);

// Serve index.html untuk root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test koneksi tanpa Google Auth
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server berjalan!',
    env_check: {
      has_key: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64,
      key_length: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64.length : 0
    }
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

// Export for Vercel serverless
module.exports = app;