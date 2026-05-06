#!/bin/bash

echo "🚀 Начинаем обновление сайта..."

# 1. Сборка проекта на Маке
echo "📦 Шаг 1: Собираем проект локально..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Сборка успешно завершена!"
    
    # 2. Отправка файлов на сервер
    echo "📤 Шаг 2: Отправляем файлы на сервер..."
    rsync -avz --exclude 'cache' --exclude 'node_modules' "./.next" root@92.63.176.185:/var/www/mercare/Mercare3D/merkare-app/
    rsync -avz "./public" root@92.63.176.185:/var/www/mercare/Mercare3D/merkare-app/
    rsync -avz "./package.json" root@92.63.176.185:/var/www/mercare/Mercare3D/merkare-app/

    # 3. Перезапуск PM2 на сервере
    echo "🔄 Шаг 3: Перезапускаем сайт на сервере..."
    ssh root@92.63.176.185 "cd /var/www/mercare/Mercare3D/merkare-app && pm2 restart mercare-3d"

    echo "🎉 ВСЁ ГОТОВО! Сайт обновлен и работает."
else
    echo "❌ Ошибка при сборке! Проверьте код на ошибки."
    exit 1
fi
