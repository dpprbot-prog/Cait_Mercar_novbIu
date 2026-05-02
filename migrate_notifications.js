const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'merkare.db');
const db = new Database(dbPath);

try {
  console.log('Adding notifications and settings tables...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'siz', 'supply', 'admin_approval', 'system'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      worker_id TEXT PRIMARY KEY,
      notify_siz INTEGER DEFAULT 1,
      notify_supply INTEGER DEFAULT 1,
      notify_admin_tasks INTEGER DEFAULT 1, -- For admins only
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );
  `);

  // Initialize settings for existing workers
  const workers = db.prepare("SELECT id FROM workers").all();
  const insertSettings = db.prepare("INSERT OR IGNORE INTO notification_settings (worker_id) VALUES (?)");
  for (const w of workers) {
    insertSettings.run(w.id);
  }

  console.log('Migration successful!');
} catch (err) {
  console.error('Migration error:', err);
} finally {
  db.close();
}
