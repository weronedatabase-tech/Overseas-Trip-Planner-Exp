const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// For SPA fallback (if needed, though this looks like multipage HTML)
// Not adding SPA fallback because it's a multi-page app with explicit .html files.

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
