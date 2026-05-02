'use server'

import db from '@/lib/db'
import { generateExcelBase64 } from '@/lib/excel'

export async function exportEmployeesExcel() {
  const workers = db.prepare(`
    SELECT 
      last_name as 'Фамилия',
      first_name as 'Имя',
      patronymic as 'Отчество',
      role as 'Должность',
      login as 'Логин',
      (SELECT name FROM brigades WHERE id = brigade_id) as 'Бригада/Объект',
      height as 'Рост',
      clothing_size as 'Разм. Одежды',
      shoe_size as 'Разм. Обуви',
      CASE WHEN is_blocked = 1 THEN 'Заблокирован' ELSE 'Активен' END as 'Статус'
    FROM workers
    ORDER BY last_name
  `).all()

  return {
    success: true,
    base64: generateExcelBase64(workers, 'Сотрудники'),
    fileName: `Employees_${new Date().toISOString().split('T')[0]}.xlsx`
  }
}

export async function exportToolsExcel() {
  const tools = db.prepare(`
    SELECT 
      name as 'Наименование',
      category as 'Категория',
      inventoryNum as 'Инв. Номер',
      CASE 
        WHEN status = 'available' THEN 'На складе'
        WHEN status = 'issued' THEN 'Выдан'
        WHEN status = 'repair' THEN 'В ремонте'
        WHEN status = 'lost' THEN 'Утерян'
        WHEN status = 'written_off' THEN 'Списан'
        WHEN status = 'pending_transfer' THEN 'Ожидает принятия'
        WHEN status = 'pending_writeoff' THEN 'Заявка на списание'
        ELSE status
      END as 'Статус',
      condition as 'Состояние',
      qty || ' ' || unit as 'Количество',
      issuedTo as 'Кому выдан',
      issuedObject as 'Объект',
      issuedDate as 'Дата выдачи',
      repair_location as 'Место ремонта',
      writeoff_reason as 'Причина списания'
    FROM tools
    ORDER BY category, name
  `).all()

  return {
    success: true,
    base64: generateExcelBase64(tools, 'Инструмент'),
    fileName: `Tools_${new Date().toISOString().split('T')[0]}.xlsx`
  }
}

export async function exportDirectoriesExcel() {
  const objects = db.prepare("SELECT name as 'Название объекта' FROM objects ORDER BY name").all()
  const brigades = db.prepare("SELECT name as 'Название бригады', pot_amount as 'Общак (руб)' FROM brigades ORDER BY name").all()
  const stores = db.prepare("SELECT name as 'Название', address as 'Адрес', phone as 'Телефон' FROM stores ORDER BY name").all()

  return {
    success: true,
    base64: generateExcelBase64({
      'Объекты': objects,
      'Бригады': brigades,
      'Магазины': stores
    }),
    fileName: `Directories_${new Date().toISOString().split('T')[0]}.xlsx`
  }
}
