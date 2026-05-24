const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function findDbWithWorkers(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
          findDbWithWorkers(fullPath);
        }
      } else if (file.endsWith('.db') || file.endsWith('.sqlite')) {
        try {
          const db = new Database(fullPath);
          const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workers'").get();
          if (tableCheck) {
            const count = db.prepare("SELECT COUNT(*) as count FROM workers WHERE last_name LIKE '%Баранов%' OR name LIKE '%Баранов%'").get();
            if (count.count > 0) {
              console.log('=== НАЙДЕНА РЕАЛЬНАЯ БАЗА ===');
              console.log('Путь к файлу:', fullPath);
              console.log('Размер:', (stat.size / 1024 / 1024).toFixed(2) + ' MB');
              const workers = db.prepare("SELECT name, role FROM workers LIMIT 10").all();
              console.log('Пример сотрудников внутри:', workers);
            }
          }
        } catch (e) {}
      }
    });
  } catch (e) {}
}
findDbWithWorkers('/var/www/mercare');
