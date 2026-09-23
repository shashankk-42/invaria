const express = require('express');
const app = express();
app.get('/api/search', (req, res) => {
  const term = req.query.term;
  const sql = 'SELECT * FROM products WHERE name = ' + term;
  return db.query(sql);
});
