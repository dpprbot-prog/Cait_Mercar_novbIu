const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'merkare.db');
const db = new Database(dbPath);

try {
  // Исправляем логин для администратора
  const result = db.prepare("UPDATE workers SET login = 'admin' WHERE id = 'admin'").run();
  console.log('Admin login updated:', result.changes);
  
  // Проверяем других пользователей с пустым логином (если есть)
  const workers = db.prepare("SELECT id, name, login FROM workers").all();
  console.log('Current workers state:', workers);
} catch (err) {
  console.error('Migration error:', err);
} finally {
  db.close();
}
