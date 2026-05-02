'use server'

import db from '@/lib/db'
import { generateExcelBase64 } from '@/lib/excel'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

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
    fileName: `Tools_${new Date().toISOString().split('T')[0].replace(/\./g, '-')}.xlsx`
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

import ExcelJS from 'exceljs'

export async function exportSalaryToTemplate(month: number, year: number, brigadeId?: string) {
  const monthStr = month < 9 ? `0${month + 1}` : `${month + 1}`
  const dateSuffix = `.${monthStr}.${year}`
  const monthName = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month]

  try {
    const templatePath = path.join(process.cwd(), 'chasbI_pabochix.xlsx')
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Шаблон не найден по пути: ${templatePath}`)
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(templatePath)
    const worksheet = workbook.getWorksheet(1)
    if (!worksheet) throw new Error('Worksheet not found')

    // Очищаем «общие формулы» шаблона, переводя их в значения, чтобы избежать ошибки exceljs
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.type === 6) { // 6 = ValueType.Formula
          // @ts-ignore
          const result = cell.result
          cell.value = null // Сначала сбрасываем
          cell.value = result // Оставляем только результат (или null)
        }
      })
    })

    const dateSuffix = `.${(month + 1).toString().padStart(2, '0')}.${year}`
    worksheet.getRow(1).getCell(7).value = `${monthName} ${year}`

    // 1.5 Собираем палитру цветов из ячеек D8-D15 (Статистика - цвет)
    const objectMap = new Map<string, { color: any, rowIndex: number, name: string, totalHours: number, totalDays: number }>()
    const activeObjects = db.prepare(`
      SELECT DISTINCT o.id, o.name
      FROM time_entries te
      JOIN objects o ON te.object_id = o.id
      JOIN workers w ON te.worker_id = w.id
      WHERE te.date LIKE ? ${brigadeId ? 'AND w.brigade_id = ?' : ''}
      LIMIT 8
    `).all(`%${dateSuffix}`, ...(brigadeId ? [brigadeId] : [])) as any[]

    activeObjects.forEach((obj, idx) => {
      const rowIndex = 8 + idx
      const colorCell = worksheet.getRow(rowIndex).getCell(4) // Колонка D
      objectMap.set(obj.id, {
        color: JSON.parse(JSON.stringify(colorCell.fill || {})), // Глубокое копирование стиля
        rowIndex,
        name: obj.name,
        totalHours: 0,
        totalDays: new Set().size // Просто инициализация
      })
    })
    
    // Для подсчета уникальных дней по объектам
    const objectDaysSet = new Map<string, Set<string>>()

    // 2. Получаем данные сотрудников
    let workersQuery = `
      SELECT id, last_name, first_name, patronymic, role, base_rate, name
      FROM workers 
      WHERE is_approved = 1 AND is_blocked = 0
    `
    const params: any[] = []
    if (brigadeId) {
      workersQuery += ` AND brigade_id = ?`
      params.push(brigadeId)
    }
    workersQuery += ` ORDER BY last_name`
    const workers = db.prepare(workersQuery).all(...params) as any[]
    
    const brigadeName = brigadeId 
      ? (db.prepare('SELECT name FROM brigades WHERE id = ?').get(brigadeId) as any)?.name 
      : 'All'

    // 3. Заполняем данные сотрудников
    let currentRow = 6 
    let totalAdvances = 0
    let totalPenalties = 0
    let totalBonuses = 0
    let totalBasePay = 0
    let totalToPay = 0

    for (const w of workers) {
      if (currentRow > 40) break 

      const fullName = `${w.last_name || ''} ${w.first_name || ''} ${w.patronymic || ''}`.trim() || w.name
      const row = worksheet.getRow(currentRow)

      row.getCell(16).value = fullName
      row.getCell(17).value = w.role || ''
      row.getCell(13).value = w.base_rate || 0

      let workerHours = 0
      let workerDays = 0

      for (let day = 1; day <= 31; day++) {
        const dStr = day < 10 ? `0${day}` : `${day}`
        const dateKey = `${dStr}${dateSuffix}`
        const entry = db.prepare('SELECT hours_total, object_id FROM time_entries WHERE worker_id = ? AND date = ?').get(w.id, dateKey) as { hours_total: number, object_id: string } | undefined
        
        const cell = row.getCell(17 + day)
        if (entry && entry.hours_total > 0) {
          cell.value = entry.hours_total
          workerHours += entry.hours_total
          workerDays++

          // Применяем цвет объекта
          const objData = objectMap.get(entry.object_id)
          if (objData) {
            cell.fill = objData.color
            objData.totalHours += entry.hours_total
            
            if (!objectDaysSet.has(entry.object_id)) objectDaysSet.set(entry.object_id, new Set())
            objectDaysSet.get(entry.object_id)?.add(dateKey)
          }
        } else {
          cell.value = null
        }
      }

      const cellN = row.getCell(14); cellN.value = workerDays
      const cellO = row.getCell(15); cellO.value = workerHours
      const basePay = workerHours * (w.base_rate || 0)
      const cellL = row.getCell(12)
      // @ts-ignore
      if (cellL.model) { cellL.model.formula = undefined; cellL.model.sharedFormula = undefined; }
      cellL.value = basePay
      totalBasePay += basePay

      const finances = db.prepare(`SELECT type, amount FROM financial_records WHERE worker_id = ? AND date LIKE ?`).all(w.id, `%${dateSuffix}`) as any[]
      const adv = finances.filter(f => f.type === 'advance').reduce((sum, f) => sum + f.amount, 0)
      const penalty = finances.filter(f => f.type === 'penalty').reduce((sum, f) => sum + f.amount, 0)
      const bonus = finances.filter(f => f.type === 'bonus').reduce((sum, f) => sum + f.amount, 0)

      totalAdvances += adv; totalPenalties += penalty; totalBonuses += bonus
      row.getCell(9).value = adv || null
      row.getCell(10).value = penalty || null
      row.getCell(11).value = bonus || null
      
      const cellG = row.getCell(7)
      // @ts-ignore
      if (cellG.model) { cellG.model.formula = undefined; cellG.model.sharedFormula = undefined; }
      cellG.value = 0

      const toPay = basePay + bonus - penalty - adv
      const cellH = row.getCell(8)
      // @ts-ignore
      if (cellH.model) { cellH.model.formula = undefined; cellH.model.sharedFormula = undefined; }
      cellH.value = toPay
      totalToPay += toPay

      row.commit()
      currentRow++
    }

    // 4. Заполняем Сводку (E1-E4)
    const potRecord = brigadeId 
      ? db.prepare('SELECT amount FROM brigade_pots WHERE brigade_id = ? AND month = ? AND year = ?').get(brigadeId, month, year) as any
      : null
    const potAmount = potRecord ? potRecord.amount : 0

    worksheet.getRow(1).getCell(5).value = potAmount
    worksheet.getRow(2).getCell(5).value = totalAdvances + totalPenalties
    worksheet.getRow(3).getCell(5).value = totalBonuses
    worksheet.getRow(4).getCell(5).value = potAmount - (totalBasePay + totalBonuses) 

    // 5. Статистика по объектам (B8-E15) - очищаем старое и пишем новое
    for (let r = 8; r <= 15; r++) {
       const rObj = worksheet.getRow(r)
       rObj.getCell(2).value = null
       rObj.getCell(3).value = null
       rObj.getCell(5).value = null
    }

    objectMap.forEach((data, objId) => {
      const r = worksheet.getRow(data.rowIndex)
      r.getCell(2).value = data.totalHours
      r.getCell(3).value = objectDaysSet.get(objId)?.size || 0
      r.getCell(5).value = data.name
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return {
      success: true,
      base64: Buffer.from(buffer).toString('base64'),
      fileName: `Salary_${brigadeName}_${month + 1}_${year}.xlsx`
    }
  } catch (err: any) {
    console.error('Template export error:', err)
    return { success: false, error: err.message }
  }
}
