const fs = require('fs');
const path = require('path');

// Пути к базе данных и папке бэкапов
const dbPath = '/var/www/mercare/Mercare3D/merkare-app/merkare.db';
const backupDir = '/var/www/mercare/backups';

function runBackup() {
  try {
    if (!fs.existsSync(dbPath)) {
      console.log('Файл базы данных не найден по пути:', dbPath);
      return;
    }

    // Создаем папку бэкапов, если её нет
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Генерируем имя файла с текущей датой и временем
    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const backupPath = path.join(backupDir, `merkare_backup_${dateStr}.db`);

    // Копируем файл
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Бэкап успешно создан: ${backupPath}`);

    // Удаляем старые бэкапы (оставляем только последние 30 штук)
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('merkare_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // новые сверху

    if (files.length > 30) {
      const filesToDelete = files.slice(30);
      filesToDelete.forEach(f => {
        fs.unlinkSync(f.path);
        console.log(`🧹 Удален старый бэкап: ${f.name}`);
      });
    }
  } catch (e) {
    console.error('Ошибка создания бэкапа:', e.message);
  }
}

runBackup();
