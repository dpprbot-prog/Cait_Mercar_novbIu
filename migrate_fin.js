const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'merkare.db');
const db = new Database(dbPath);

try {
  console.log('Migrating financial_records to support CASCADE DELETE...');
  
  // SQLite не позволяет просто ALTER TABLE для изменения FOREIGN KEY, 
  // поэтому нужно пересоздать таблицу.
  
  db.exec(`
    CREATE TABLE financial_records_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );
  `);

  // Копируем данные
  db.exec("INSERT INTO financial_records_new SELECT * FROM financial_records");

  // Удаляем старую и переименовываем новую
  db.exec("DROP TABLE financial_records");
  db.exec("ALTER TABLE financial_records_new RENAME TO financial_records");

  console.log('Migration successful!');
} catch (err) {
  console.error('Migration error:', err);
} finally {
  db.close();
}
