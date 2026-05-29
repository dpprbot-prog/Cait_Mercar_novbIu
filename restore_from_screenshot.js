const Database = require('better-sqlite3');
const db = new Database('/var/www/mercare/Mercare3D/merkare-app/merkare.db');

// Данные со скриншота за период с 24 по 29 мая 2026 года
const screenshotData = {
  'Белов': {
    '24.05.2026': '6:30',
    '25.05.2026': '10:55',
    '26.05.2026': '9:30',
    '27.05.2026': '8:40',
    '28.05.2026': '10:30',
    '29.05.2026': '10:40'
  },
  'Василий': {
    '24.05.2026': '6:25',
    '25.05.2026': '10:55',
    '26.05.2026': '9:30',
    '29.05.2026': '10:40'
  },
  'Гудицкий': {
    '24.05.2026': '6:30',
    '25.05.2026': '10:55',
    '26.05.2026': '9:30',
    '27.05.2026': '8:40',
    '28.05.2026': '10:30',
    '29.05.2026': '10:40'
  },
  'Константинов': {
    '24.05.2026': '6:25',
    '25.05.2026': '9:40',
    '26.05.2026': '10',
    '27.05.2026': '8:50',
    '28.05.2026': '10:40',
    '29.05.2026': '10'
  },
  'Логинов': {
    '25.05.2026': '10:55',
    '26.05.2026': '9:30',
    '27.05.2026': '8:35',
    '28.05.2026': '10:35',
    '29.05.2026': '10:40'
  },
  'Ряполов': {
    '24.05.2026': '6:25',
    '25.05.2026': '10:55',
    '26.05.2026': '9:15',
    '27.05.2026': '8:35',
    '28.05.2026': '10:20',
    '29.05.2026': '10:40'
  },
  'Шашков': {
    '25.05.2026': '9:30',
    '26.05.2026': '8:40',
    '27.05.2026': '10:30',
    '28.05.2026': '10:40',
    '29.05.2026': '10:40'
  }
};

function parseTimeToDecimalAndInterval(timeStr) {
  let hours = 0;
  let minutes = 0;
  
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
  } else {
    hours = parseInt(timeStr, 10);
  }
  
  const decimalHours = parseFloat((hours + minutes / 60).toFixed(2));
  
  // Рассчитываем интервал с началом в 07:30
  const startMinutes = 7 * 60 + 30; // 450
  const endMinutesTotal = startMinutes + hours * 60 + minutes;
  
  const endHour = Math.floor(endMinutesTotal / 60);
  const endMin = endMinutesTotal % 60;
  
  const startTime = '07:30';
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  
  return { decimalHours, startTime, endTime };
}

console.log('🏁 Начинаем процесс восстановления часов со скриншота...');

// 1. Получаем список сотрудников
const allWorkers = db.prepare("SELECT id, name, last_name, brigade_id FROM workers").all();

for (const [lastNameKeyword, dates] of Object.entries(screenshotData)) {
  // Находим сотрудника по фамилии
  const worker = allWorkers.find(w => w.last_name.includes(lastNameKeyword));
  if (!worker) {
    console.log(`❌ Сотрудник с фамилией "${lastNameKeyword}" не найден в базе.`);
    continue;
  }
  
  console.log(`👤 Восстанавливаем часы для: ${worker.name} (ID: ${worker.id})`);
  
  // Определяем наиболее популярный объект (object_id) сотрудника в мае
  const popularObjectRow = db.prepare(`
    SELECT object_id, COUNT(*) as count 
    FROM time_entries 
    WHERE worker_id = ? AND date LIKE '%.05.2026' AND object_id IS NOT NULL
    GROUP BY object_id 
    ORDER BY count DESC 
    LIMIT 1
  `).get(worker.id);
  
  const defaultObjectId = popularObjectRow ? popularObjectRow.object_id : null;
  console.log(`   👉 Авто-определение объекта работы: ${defaultObjectId || 'нет'}`);

  for (const [date, timeStr] of Object.entries(dates)) {
    const { decimalHours, startTime, endTime } = parseTimeToDecimalAndInterval(timeStr);
    
    // Проверим, нет ли уже такой записи в базе, чтобы избежать дубликатов
    const existing = db.prepare("SELECT id FROM time_entries WHERE worker_id = ? AND date = ?").get(worker.id, date);
    
    if (existing) {
      // Обновляем существующую запись
      db.prepare(`
        UPDATE time_entries 
        SET start_time = ?, end_time = ?, lunch_min = 0, hours_total = ?, object_id = COALESCE(object_id, ?)
        WHERE id = ?
      `).run(startTime, endTime, decimalHours, defaultObjectId, existing.id);
      console.log(`   ✅ Обновлена дата ${date}: ${startTime} - ${endTime} (${decimalHours} ч.)`);
    } else {
      // Вставляем новую запись
      db.prepare(`
        INSERT INTO time_entries (worker_id, brigade_id, object_id, date, start_time, end_time, lunch_min, hours_total, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1)
      `).run(worker.id, worker.brigade_id, defaultObjectId, date, startTime, endTime, decimalHours);
      console.log(`   ➕ Добавлена дата ${date}: ${startTime} - ${endTime} (${decimalHours} ч.)`);
    }
  }
}

console.log('🎉 Все часы со скриншота успешно восстановлены и записаны в merkare.db!');
db.close();
