import Database from 'better-sqlite3'
import path from 'path'

// Подключаемся к файлу БД (создастся в корне проекта, если не существует).
const db = new Database(path.join(process.cwd(), 'merkare.db'))

// Инициализация таблиц базы данных
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brigades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pot_amount INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      login TEXT UNIQUE,
      password_hash TEXT,
      last_name TEXT,
      first_name TEXT,
      patronymic TEXT,
      name TEXT NOT NULL,
      role TEXT,
      initials TEXT,
      user_color TEXT,
      base_rate INTEGER DEFAULT 0,
      brigade_id TEXT,
      height INTEGER,
      clothing_size TEXT,
      shoe_size TEXT,
      is_blocked INTEGER DEFAULT 0,
      is_approved INTEGER DEFAULT 0,
      FOREIGN KEY (brigade_id) REFERENCES brigades(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS objects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      brigade_id TEXT NOT NULL,
      object_id TEXT,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      lunch_min INTEGER DEFAULT 0,
      hours_total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'advance', 'penalty', 'bonus'
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brigade_pots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brigade_id TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount INTEGER DEFAULT 0,
      UNIQUE(brigade_id, month, year)
    );

    CREATE TABLE IF NOT EXISTS supply_orders (
      id TEXT PRIMARY KEY,
      object TEXT NOT NULL,
      priority TEXT NOT NULL,
      author TEXT NOT NULL,
      author_role TEXT,
      comment TEXT,
      link TEXT,
      photos TEXT, -- JSON array of URLs
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supply_items (
      mid TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ordered_qty REAL NOT NULL,
      assigned_qty REAL,
      picked_qty REAL,
      unit TEXT NOT NULL,
      note TEXT,
      m_status TEXT NOT NULL DEFAULT 'new', -- new, assigned, picked, delivered, accepted
      store_name TEXT,
      driver TEXT,
      parent_mid TEXT,
      FOREIGN KEY (order_id) REFERENCES supply_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_mid) REFERENCES supply_items(mid) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS supply_comments (
      id TEXT PRIMARY KEY,
      item_mid TEXT NOT NULL,
      author TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      ts TEXT NOT NULL,
      FOREIGN KEY (item_mid) REFERENCES supply_items(mid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS siz_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      worker TEXT NOT NULL,
      object TEXT NOT NULL,
      issuedDate TEXT NOT NULL,
      expiryDate TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit TEXT NOT NULL,
      status TEXT NOT NULL,
      size TEXT,
      note TEXT,
      returnedDate TEXT
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      inventoryNum TEXT NOT NULL,
      condition TEXT NOT NULL,
      status TEXT NOT NULL,
      assigneeType TEXT,
      issuedTo TEXT,
      issuedObject TEXT,
      issuedDate TEXT,
      returnDue TEXT,
      qty INTEGER NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'шт',
      note TEXT,
      transfer_from TEXT,
      transfer_to TEXT,
      transfer_toType TEXT,
      transfer_date TEXT,
      transfer_object TEXT,
      repair_location TEXT,
      repair_sentDate TEXT,
      writeoff_reason TEXT,
      writeoff_photo TEXT,
      writeoff_requestedBy TEXT,
      writeoff_date TEXT
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      type TEXT NOT NULL,
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
      notify_admin_tasks INTEGER DEFAULT 1,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Миграция: добавляем колонку is_blocked, если её нет
  try {
    db.prepare('ALTER TABLE workers ADD COLUMN is_blocked INTEGER DEFAULT 0').run()
  } catch (e) {}

  try {
    db.prepare('ALTER TABLE workers ADD COLUMN is_approved INTEGER DEFAULT 1').run()
  } catch (e) {}

  // Сидирование данных (Первичное заполнение для теста)
  const count = db.prepare('SELECT COUNT(*) as count FROM brigades').get() as { count: number }
  if (count.count === 0) {
    seedData()
  }
}

function seedData() {
  console.log('Seeding initial Merkare Database...')

  const insertBrigade = db.prepare('INSERT INTO brigades (id, name, pot_amount) VALUES (?, ?, ?)')
  insertBrigade.run('b1', 'Бригада Акрон (Бетон)', 1200000)
  insertBrigade.run('b2', 'Бригада Гарик (Отделка)', 850000)
  insertBrigade.run('b3', 'Бригада ИТР / Мастера', 0)

  // Объекты
  const insertObject = db.prepare('INSERT INTO objects (id, name) VALUES (?, ?)')
  insertObject.run('obj1', 'Рукль')
  insertObject.run('obj2', 'Цех-2')
  insertObject.run('obj3', 'Цех-5')
  insertObject.run('obj4', 'Административный')
  insertObject.run('obj5', 'Склад А')

  const insertWorker = db.prepare('INSERT INTO workers (id, login, password_hash, last_name, first_name, patronymic, name, role, initials, user_color, brigade_id, base_rate, height, clothing_size, shoe_size, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const hash = (pw:string) => pw // в реальности тут bcrypt, но для мока достаточно. Новая регистрация будет использовать нормальный алгоритм (например sha256).

  // Админ и Склад (Системные)
  insertWorker.run('admin', 'admin', 'admin', 'Администратор', '', '', 'Админ', 'Админ', 'АД', '#ef4444', null, 0, null, null, null)
  insertWorker.run('sklad', 'sklad', 'sklad', 'Склад', '', '', 'Склад', 'Склад', 'СК', '#3b82f6', null, 0, null, null, null)

  // b1 workers
  insertWorker.run('w1', 'shevchenko', '1234', 'Шевченко', 'Александр', '', 'Шевченко А.', 'Бригадир', 'ША', '#f97316', 'b1', 1000, 180, 'L', 43)
  insertWorker.run('w2', 'ivanov', '1234', 'Иванов', 'Петр', '', 'Иванов П.', 'Бетонщик', 'ИП', '#3b82f6', 'b1', 600, 175, 'M', 42)
  insertWorker.run('w3', 'sidorov', '1234', 'Сидоров', 'Николай', '', 'Сидоров Н.', 'Подсобник', 'СН', '#eab308', 'b1', 400, 185, 'XL', 44)
  
  // b2 workers
  insertWorker.run('w4', 'garik', '1234', 'Гарик', 'Маковецкий', '', 'Гарик М.', 'Бригадир', 'ГМ', '#a855f7', 'b2', 900, 170, 'M', 41)
  insertWorker.run('w5', 'vazgen', '1234', 'Вазген', 'А.', '', 'Вазген А.', 'Отделочник', 'ВА', '#ec4899', 'b2', 700, 172, 'L', 42)
  insertWorker.run('w6', 'ashot', '1234', 'Ашот', 'Д.', '', 'Ашот Д.', 'Подсобник', 'АД', '#14b8a6', 'b2', 450, 178, 'L', 43)
  
  // b3 workers (ИТР)
  insertWorker.run('w7', 'lanevich', '1234', 'Ланевич', 'В.', '', 'Ланевич В.', 'Мастер', 'ЛВ', '#c9372c', 'b3', 1000, 182, 'XL', 44)
  insertWorker.run('w8', 'kozlov', '1234', 'Козлов', 'В.', '', 'Козлов В.', 'Мастер', 'КВ', '#22c55e', 'b3', 1000, 176, 'L', 43)

  // ── SUPPLY SEEDING ──
  const insertOrder = db.prepare('INSERT INTO supply_orders (id, object, priority, author, author_role, comment, link, photos, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertItem = db.prepare('INSERT INTO supply_items (mid, order_id, name, ordered_qty, assigned_qty, picked_qty, unit, note, m_status, store_name, driver, parent_mid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertComment = db.prepare('INSERT INTO supply_comments (id, item_mid, author, role, text, ts) VALUES (?, ?, ?, ?, ?, ?)')

  // Order 1
  insertOrder.run('001', 'Рукль', 'urgent', 'Ланевич В.', 'Мастер', 'Заливка сегодня!', null, null, '18.04 08:30')
  insertItem.run('101', '001', 'Арматура 12мм', 500, 500, null, 'кг', 'Только рифлёная', 'assigned', 'Леруа Мерлен Юг', 'Шевченко А.', null)
  insertComment.run('c1', '101', 'Ланевич В.', 'Мастер', 'Срочно нужна рифлёная, не гладкая', '18.04 08:30')
  insertItem.run('102', '001', 'Вязальная проволока', 10, null, null, 'кг', null, 'new', null, null, null)

  // Order 2
  insertOrder.run('002', 'Цех-2', 'days', 'Козлов В.', 'Бригадир', null, 'https://leroymerlin.ru/catalog/kabel-vvg/', '["https://placehold.co/120x90/1a1a2e/aaaaff?text=IMG1"]', '18.04 09:15')
  insertItem.run('201', '002', 'Кабель ВВГ 3×2.5', 200, 200, 150, 'м', 'Нейлон, не металл', 'picked', 'Электромонтаж', 'Шевченко А.', null)
  insertComment.run('c2', '201', 'Снабжение', 'Снабженец', 'В наличии только 150м, заказал остальное', '18.04 10:00')

  // ── SIZ SEEDING ──
  const insertSiz = db.prepare('INSERT INTO siz_items (id, name, category, worker, object, issuedDate, expiryDate, qty, unit, status, size, note, returnedDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  insertSiz.run('1', 'Каска строительная', 'head', 'Ланевич В.', 'Рукль', '01.01.2026', '01.07.2026', 1, 'шт', 'active', 'M', null, null)
  insertSiz.run('2', 'Перчатки х/б', 'hands', 'Морозов К.', 'Рукль', '15.03.2026', '15.04.2026', 3, 'пар', 'expired', null, 'Истёк срок замены', null)

  // ── TOOLS SEEDING ──
  const insertTool = db.prepare('INSERT INTO tools (id, name, category, inventoryNum, condition, status, assigneeType, issuedTo, issuedObject, issuedDate, returnDue, qty, unit, note, transfer_from, transfer_to, transfer_toType, transfer_date, transfer_object, repair_location, repair_sentDate, writeoff_reason, writeoff_photo, writeoff_requestedBy, writeoff_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  insertTool.run('t1', 'Перфоратор Bosch GBH', 'power', 'ИН-001', 'good', 'issued', 'worker', 'Козлов В.', 'Цех-2', '10.04.2026', null, 1, 'шт', null, null, null, null, null, null, null, null, null, null, null, null)
  insertTool.run('t2', 'Уровень лазерный', 'measuring', 'ИН-004', 'good', 'pending_transfer', null, null, null, null, null, 1, 'шт', null, 'Склад', 'Ланевич В.', 'worker', '18.04.2026', 'Рукль', null, null, null, null, null, null)

  // Магазины
  const insertStore = db.prepare('INSERT INTO stores (id, name, address, phone) VALUES (?, ?, ?, ?)')
  insertStore.run('s1', 'Леруа Мерлен', 'ул. Дорожная, 12', '+7 (495) 123-45-67')
  insertStore.run('s2', 'Петрович', 'пр. Мира, 45', '+7 (495) 987-65-43')
  insertStore.run('s3', 'Электромонтаж', 'ул. Светлая, 8', '+7 (495) 555-01-02')
}

initDb()

export default db
