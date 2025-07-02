const fs      = require('fs');
const sqlite3 = require('sqlite3').verbose();

if (fs.existsSync('database.db')) fs.unlinkSync('database.db');

const db = new sqlite3.Database('database.db', err => {
  if (err) return console.error(err);
  const schema = fs.readFileSync('db_schema.sql', 'utf8');
  db.exec(schema, err2 => {
    if (err2) return console.error(err2);
    console.log('✅ database.db built successfully');
    db.close(err3 => {
      if (err3) console.error('Failed to close DB:', err3);
    });
  });
});
