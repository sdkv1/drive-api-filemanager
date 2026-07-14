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

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = app;