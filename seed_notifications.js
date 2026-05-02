const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'merkare.db');
const db = new Database(dbPath);

try {
  console.log('Seeding sample notifications...');
  
  // Find admin or any worker
  const admin = db.prepare("SELECT id FROM workers WHERE role = 'Админ' LIMIT 1").get();
  if (admin) {
    db.prepare("INSERT INTO notifications (worker_id, type, title, message) VALUES (?, ?, ?, ?)")
      .run(admin.id, 'system', 'Добро пожаловать!', 'Система уведомлений активирована. Здесь будут появляться важные сообщения.');
    
    db.prepare("INSERT INTO notifications (worker_id, type, title, message) VALUES (?, ?, ?, ?)")
      .run(admin.id, 'admin_approval', 'Новая заявка', 'Сотрудник Иванов П. ожидает одобрения регистрации.');
  }

  console.log('Seed successful!');
} catch (err) {
  console.error('Seed error:', err);
} finally {
  db.close();
}
