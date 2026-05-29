const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function scanDb(fullPath) {
  try {
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) return;

    // Подключаемся в режиме только для чтения, чтобы ничего не повредить
    const db = new Database(fullPath, { readonly: true });
    
    // Получаем список таблиц
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    
    console.log('========================================');
    console.log('НАЙДЕН ФАЙЛ БД:', fullPath);
    console.log('Размер:', (stat.size / 1024).toFixed(2) + ' KB');
    console.log('Время изменения:', stat.mtime);
    console.log('Таблицы:', tables.join(', '));
    
    if (tables.includes('workers')) {
      const workersCount = db.prepare("SELECT COUNT(*) as count FROM workers").get().count;
      console.log('Количество сотрудников:', workersCount);
    }
    
    if (tables.includes('time_entries')) {
      const entriesCount = db.prepare("SELECT COUNT(*) as count FROM time_entries").get().count;
      console.log('Количество записей времени (time_entries):', entriesCount);
      
      if (entriesCount > 0) {
        const dateRange = db.prepare("SELECT MIN(date) as minDate, MAX(date) as maxDate FROM time_entries").get();
        console.log('Диапазон дат в табеле:', `${dateRange.minDate} -- ${dateRange.maxDate}`);
        
        // Выведем последние 5 записей, чтобы увидеть реальные даты
        const latestEntries = db.prepare("SELECT date, hours_total, worker_id FROM time_entries ORDER BY date DESC LIMIT 5").all();
        console.log('Последние 5 записей:', latestEntries);
      }
    }
    console.log('========================================\n');
    db.close();
  } catch (e) {
    // Не SQLite или файл заблокирован, просто пишем базовую инфу
    try {
      const stat = fs.statSync(fullPath);
      console.log('========================================');
      console.log('НАЙДЕН ПОДОЗРИТЕЛЬНЫЙ ФАЙЛ (ошибка чтения как DB):', fullPath);
      console.log('Размер:', (stat.size / 1024).toFixed(2) + ' KB');
      console.log('Время изменения:', stat.mtime);
      console.log('Ошибка:', e.message);
      console.log('========================================\n');
    } catch (err) {}
  }
}

function findDbs(dir) {
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
        // Пропускаем системные папки, node_modules, кэш и гиты
        if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next' && file !== '.git') {
          findDbs(fullPath);
        }
      } else {
        const lowerName = file.toLowerCase();
        if (
          lowerName.endsWith('.db') || 
          lowerName.endsWith('.sqlite') || 
          lowerName.endsWith('.sqlite3') || 
          lowerName.endsWith('.bak') || 
          lowerName.includes('merkare') || 
          lowerName.includes('database') || 
          lowerName.includes('backup')
        ) {
          scanDb(fullPath);
        }
      }
    });
  } catch (e) {}
}

console.log('🔍 Запускаем глубокий поиск баз данных на сервере...');
findDbs(process.cwd());
findDbs('/var/www');
findDbs('/root');
findDbs('/home');
console.log('✅ Поиск завершен.');
