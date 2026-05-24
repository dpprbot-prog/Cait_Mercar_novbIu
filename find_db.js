const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function findDbWithWorkers(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        return;
      }
      
      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next' && file !== '.git') {
          findDbWithWorkers(fullPath);
        }
      } else if (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.sqlite3') || file.includes('merkare') || file.includes('database')) {
        try {
          if (stat.size === 0) return;
          
          const db = new Database(fullPath, { readonly: true });
          const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workers'").get();
          if (tableCheck) {
            const totalCount = db.prepare("SELECT COUNT(*) as count FROM workers").get().count;
            const ryapolovCheck = db.prepare("SELECT COUNT(*) as count FROM workers WHERE last_name LIKE '%Ryapolov%' OR name LIKE '%Ryapolov%' OR login LIKE '%Ryapolov%' OR last_name LIKE '%Ряполов%' OR name LIKE '%Ряполов%'").get().count;
            const egorovCheck = db.prepare("SELECT COUNT(*) as count FROM workers WHERE last_name LIKE '%egorov%' OR name LIKE '%egorov%' OR login LIKE '%egorov%' OR last_name LIKE '%Егоров%' OR name LIKE '%Егоров%'").get().count;
            
            console.log('========================================');
            console.log('БАЗА С ТАБЛИЦЕЙ workers:', fullPath);
            console.log('Размер:', (stat.size / 1024).toFixed(2) + ' KB');
            console.log('Всего сотрудников:', totalCount);
            console.log('Найдено Ryapolov/Ряполов:', ryapolovCheck);
            console.log('Найдено egorov/Егоров:', egorovCheck);
            
            const workers = db.prepare("SELECT id, name, last_name, login, role FROM workers LIMIT 15").all();
            console.log('Первые 15 сотрудников:', workers);
            console.log('========================================\n');
          }
          db.close();
        } catch (e) {
          // not an sqlite database or locked
        }
      }
    });
  } catch (e) {}
}

console.log('Начинаем поиск баз данных...');
findDbWithWorkers('/var/www');
findDbWithWorkers('/root');
findDbWithWorkers('/home');
console.log('Поиск завершен.');

