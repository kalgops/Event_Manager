const fs      = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'database.db';

// Remove old database file if it exists
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('→ Removed old database.db');
}

// Create & initialize new database
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }

  const schema = fs.readFileSync('db_schema.sql', 'utf8');
  db.exec(schema, err2 => {
    if (err2) {
      console.error('❌ Error executing schema:', err2);
      process.exit(1);
    }
    console.log('✅ database.db built successfully');
    db.close(err3 => {
      if (err3) {
        console.error('❌ Failed to close DB:', err3);
        process.exit(1);
      }
    });
  });
});
