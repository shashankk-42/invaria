const express = require('express');
const app = express();
app.get('/api/search', (req, res) => {
  return db.query('SELECT * FROM products WHERE name = ?', [req.query.term]);
});
