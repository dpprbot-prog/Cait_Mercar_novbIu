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
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Табель')

    // Вспомогательный метод для перевода индекса колонки в буквы Excel (1 -> A, 27 -> AA, 37 -> AK)
    const getColLetter = (colIdx: number): string => {
      let temp = colIdx
      let letter = ''
      while (temp > 0) {
        const modulo = (temp - 1) % 26
        letter = String.fromCharCode(65 + modulo) + letter
        temp = Math.floor((temp - modulo) / 26)
      }
      return letter
    }

    // Вычисляем количество дней в выбранном календарном месяце
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCols = 6 + daysInMonth

    // 1. Настройка страницы (Landscape, margins)
    worksheet.pageSetup.orientation = 'landscape'
    worksheet.pageSetup.fitToWidth = 1
    worksheet.pageSetup.fitToHeight = 0
    worksheet.pageSetup.margins = {
      left: 0.25, right: 0.25,
      top: 0.4, bottom: 0.4,
      header: 0.2, footer: 0.2
    }

    // Установка ширины колонок
    worksheet.getColumn(1).width = 5   // №
    worksheet.getColumn(2).width = 20  // ФИО
    worksheet.getColumn(3).width = 12  // Комнад/Местный
    for (let i = 4; i <= 3 + daysInMonth; i++) {
      worksheet.getColumn(i).width = 4.5 // Дни 1-31/30/...
    }
    
    const colIdxAI = 4 + daysInMonth
    const colIdxAJ = 5 + daysInMonth
    const colIdxAK = 6 + daysInMonth
    const colLetterAI = getColLetter(colIdxAI)
    const colLetterAJ = getColLetter(colIdxAJ)
    const colLetterAK = getColLetter(colIdxAK)
    const colLetterAH = getColLetter(3 + daysInMonth) // Последний день месяца

    worksheet.getColumn(colIdxAI).width = 14  // Итого часов, минут
    worksheet.getColumn(colIdxAJ).width = 16  // Всего дней командировочных
    worksheet.getColumn(colIdxAK).width = 16  // Всего местных

    // 2. Генерация дат pay period (строго с 1-го числа до конца месяца)
    const dates: Date[] = []
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(new Date(year, month, i))
    }

    const dateStrings = dates.map(d => {
      const dd = d.getDate().toString().padStart(2, '0')
      const mm = (d.getMonth() + 1).toString().padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}.${mm}.${yyyy}`
    })

    const placeholders = dateStrings.map(() => '?').join(',')

    // 3. Сбор активных объектов в данном периоде
    let activeObjectsQuery = `
      SELECT DISTINCT object_id
      FROM time_entries te
      JOIN workers w ON te.worker_id = w.id
      WHERE te.date IN (${placeholders}) AND te.is_approved = 1
    `
    const activeObjectsParams: any[] = [...dateStrings]
    if (brigadeId) {
      activeObjectsQuery += ` AND w.brigade_id = ?`
      activeObjectsParams.push(brigadeId)
    }
    const activeObjects = db.prepare(activeObjectsQuery).all(...activeObjectsParams) as { object_id: string }[]
    const objectNames = activeObjects.map(o => o.object_id).filter(Boolean)
    const objectsStr = objectNames.length > 0 ? objectNames.join(', ') : 'Ремонтно-восстановительные работы'

    // 4. Заголовки (Top-Right Header & Title Block с динамическим мержем)
    const lastColLetter = getColLetter(totalCols)
    const blockStartLetter = getColLetter(totalCols - 6)

    // Строка 1:AE1:AK1 (Нач. строительного участка...)
    worksheet.mergeCells(`${blockStartLetter}1:${lastColLetter}1`)
    const managerCell = worksheet.getCell(`${blockStartLetter}1`)
    managerCell.value = 'Нач. строительного участка Ланевич В.В.'
    managerCell.font = { name: 'Times New Roman', size: 10, bold: false }
    managerCell.alignment = { horizontal: 'right', vertical: 'middle' }
    worksheet.getRow(1).height = 18

    // Строка 2:AE2:AK2 (Утверждаю...)
    worksheet.mergeCells(`${blockStartLetter}2:${lastColLetter}2`)
    const approveCell = worksheet.getCell(`${blockStartLetter}2`)
    approveCell.value = 'Утверждаю __________'
    approveCell.font = { name: 'Times New Roman', size: 10, bold: false }
    approveCell.alignment = { horizontal: 'right', vertical: 'middle' }
    worksheet.getRow(2).height = 18

    // Строка 4: Заголовок
    worksheet.mergeCells(`A4:${lastColLetter}4`)
    const titleCell = worksheet.getCell('A4')
    titleCell.value = 'Табель учета рабочего времени.'
    titleCell.font = { name: 'Times New Roman', size: 16, bold: true }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(4).height = 24

    // Строка 5: Подзаголовок (Красный)
    worksheet.mergeCells(`A5:${lastColLetter}5`)
    const subtitleCell = worksheet.getCell('A5')
    subtitleCell.value = `${objectsStr} c ${dateStrings[0]}г.-${dateStrings[dateStrings.length - 1]}г.`
    subtitleCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFF0000' } }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(5).height = 18

    // 5. Построение шапки таблицы (Rows 8-9)
    const getRuDayName = (d: Date) => ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()]
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

    // Объединяем ячейки для столбцов A, B, C, AI, AJ, AK
    worksheet.mergeCells(8, 1, 9, 1) // №
    worksheet.mergeCells(8, 2, 9, 2) // ФИО
    worksheet.mergeCells(8, 3, 9, 3) // Комнад/Местный
    worksheet.mergeCells(8, colIdxAI, 9, colIdxAI) // Итого часов
    worksheet.mergeCells(8, colIdxAJ, 9, colIdxAJ) // Всего дней командировочных
    worksheet.mergeCells(8, colIdxAK, 9, colIdxAK) // Всего местных

    // Устанавливаем значения и стили для объединенных ячеек шапки
    const headerConfigs = [
      { col: 1, text: '№' },
      { col: 2, text: 'ФИО' },
      { col: 3, text: 'Комнад/\nМестный' },
      { col: colIdxAI, text: 'Итого\nчасов,\nминут' },
      { col: colIdxAJ, text: 'Всего дней\nкомандиро-\nвочных' },
      { col: colIdxAK, text: 'Всего дней\nместных' }
    ]

    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } } // Чистый белый
    const headerFont = { name: 'Times New Roman', size: 10, bold: true }
    const headerAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }

    headerConfigs.forEach(cfg => {
      const cell = worksheet.getRow(8).getCell(cfg.col)
      cell.value = cfg.text
      for (let r = 8; r <= 9; r++) {
        const c = worksheet.getRow(r).getCell(cfg.col)
        c.fill = headerFill
        c.font = headerFont
        c.alignment = headerAlignment
      }
    })

    // Дни (Столбцы 4 до 3 + daysInMonth)
    dates.forEach((date, dateIdx) => {
      const colIndex = 4 + dateIdx
      const dayNum = date.getDate()
      const dayName = getRuDayName(date)
      const weekend = isWeekend(date)

      const colFill = weekend
        ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFD9D9' } } // розовый
        : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } } // белый

      const colFont = weekend
        ? { name: 'Times New Roman', size: 9, bold: true, color: { argb: 'FFC00000' } }
        : { name: 'Times New Roman', size: 9, bold: true }

      // Ячейка числа (Row 8)
      const cell8 = worksheet.getRow(8).getCell(colIndex)
      cell8.value = dayNum
      cell8.fill = colFill
      cell8.font = colFont
      cell8.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }

      // Ячейка названия дня (Row 9)
      const cell9 = worksheet.getRow(9).getCell(colIndex)
      cell9.value = dayName
      cell9.fill = colFill
      cell9.font = colFont
      cell9.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
    })

    worksheet.getRow(8).height = 24
    worksheet.getRow(9).height = 24

    // 6. Получение данных сотрудников
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

    // Функция классификации сотрудников на командировочные/местные
    const getWorkerTravelLocal = (lastName: string): 'К' | 'М' => {
      const lname = (lastName || '').trim().toLowerCase()
      if (lname.includes('логинов') || lname.includes('константинов') || lname.includes('егоров')) {
        return 'М'
      }
      return 'К'
    }

    const PRESET_COLORS = [
      'FFD9E1F2', // Soft Blue
      'FFE2EFDA', // Soft Green
      'FFFFF2CC', // Soft Yellow
      'FFE8D9F2', // Soft Purple
      'FFFCE4D6', // Soft Orange
      'FFD9F2E6', // Soft Teal
      'FFFCE4F2', // Soft Rose
      'FFF2F2F2'  // Soft Grey
    ]

    const objectColors = new Map<string, string>()
    let colorIdx = 0

    const dailyTotals = new Array(daysInMonth).fill(0)
    let grandTotalHours = 0
    let grandTotalTravelDays = 0
    let grandTotalLocalDays = 0

    let currentRow = 10 // Начинаем с 10-й строки, так как шапка занимает 8 и 9 строки

    // Заполняем строки сотрудников
    workers.forEach((w, idx) => {
      const row = worksheet.getRow(currentRow)
      row.height = 36 // Высота для 3 строк ФИО

      // №
      const cellA = row.getCell(1)
      cellA.value = idx + 1
      cellA.font = { name: 'Times New Roman', size: 10 }
      cellA.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }

      // ФИО (разбито на 3 строки)
      const nameParts = []
      if (w.last_name) nameParts.push(w.last_name)
      if (w.first_name) nameParts.push(w.first_name)
      if (w.patronymic) nameParts.push(w.patronymic)
      const fioVal = nameParts.join('\n') || w.name

      const cellB = row.getCell(2)
      cellB.value = fioVal
      cellB.font = { name: 'Times New Roman', size: 10 }
      cellB.alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }

      // Комнад/Местный
      const workerType = getWorkerTravelLocal(w.last_name)
      const cellC = row.getCell(3)
      cellC.value = workerType
      cellC.font = { name: 'Times New Roman', size: 10 }
      cellC.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }

      // Запросы часов по датам
      const timeEntries = db.prepare(`
        SELECT hours_total, object_id, date
        FROM time_entries
        WHERE worker_id = ? AND date IN (${placeholders}) AND is_approved = 1
      `).all(w.id, ...dateStrings) as { hours_total: number, object_id: string, date: string }[]

      const entryMap = new Map<string, { hours_total: number, object_id: string }>()
      timeEntries.forEach(e => {
        entryMap.set(e.date, e)
      })

      let workerHours = 0
      let workerDays = 0

      // Заполняем часы по дням
      dates.forEach((date, dateIdx) => {
        const colIndex = 4 + dateIdx
        const dateKey = dateStrings[dateIdx]
        const entry = entryMap.get(dateKey)

        const cell = row.getCell(colIndex)
        cell.font = { name: 'Times New Roman', size: 10 }
        cell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }

        const weekend = isWeekend(date)
        if (weekend) {
          cell.fill = {
            type: 'pattern' as const,
            pattern: 'solid' as const,
            fgColor: { argb: 'FFFFD9D9' }
          }
        }

        if (entry && entry.hours_total > 0) {
          cell.value = entry.hours_total
          workerHours += entry.hours_total
          workerDays++
          dailyTotals[dateIdx] += entry.hours_total

          if (entry.object_id) {
            let objColor = objectColors.get(entry.object_id)
            if (!objColor) {
              objColor = PRESET_COLORS[colorIdx % PRESET_COLORS.length]
              colorIdx++
              objectColors.set(entry.object_id, objColor)
            }
            cell.fill = {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: objColor }
            }
          }
        } else {
          cell.value = ''
        }
      })

      // Итого часов, минут (с использованием формулы Excel)
      const cellAI = row.getCell(colIdxAI)
      cellAI.value = {
        formula: `SUM(D${currentRow}:${colLetterAH}${currentRow})`,
        result: workerHours
      }
      cellAI.font = { name: 'Times New Roman', size: 10, bold: true }
      cellAI.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
      cellAI.numFmt = '0.00' // Формат чисел с десятичной частью
      grandTotalHours += workerHours

      // Всего дней командировочных (К) (с использованием формулы Excel)
      const cellAJ = row.getCell(colIdxAJ)
      cellAJ.value = {
        formula: `IF(C${currentRow}="К", COUNTIF(D${currentRow}:${colLetterAH}${currentRow}, ">0"), "")`,
        result: workerType === 'К' && workerDays > 0 ? workerDays : undefined
      }
      cellAJ.font = { name: 'Times New Roman', size: 10 }
      cellAJ.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
      cellAJ.numFmt = '0'
      if (workerType === 'К') {
        grandTotalTravelDays += workerDays
      }

      // Всего местных (М) (с использованием формулы Excel)
      const cellAK = row.getCell(colIdxAK)
      cellAK.value = {
        formula: `IF(C${currentRow}="М", COUNTIF(D${currentRow}:${colLetterAH}${currentRow}, ">0"), "")`,
        result: workerType === 'М' && workerDays > 0 ? workerDays : undefined
      }
      cellAK.font = { name: 'Times New Roman', size: 10 }
      cellAK.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
      cellAK.numFmt = '0'
      if (workerType === 'М') {
        grandTotalLocalDays += workerDays
      }

      currentRow++
    })

    // 7. Строка "Итого:"
    const footerRow = worksheet.getRow(currentRow)
    footerRow.height = 24

    // Помещаем "того:" в последнюю ячейку дат (например, AH), выравниваем по правому краю
    const footerLabelCell = footerRow.getCell(3 + daysInMonth)
    footerLabelCell.value = 'того:'
    footerLabelCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFF0000' } }
    footerLabelCell.alignment = { horizontal: 'right' as const, vertical: 'middle' as const }
    
    // Заливаем первые три ячейки футера белым фоном
    for (let c = 1; c <= 3; c++) {
      const cell = footerRow.getCell(c)
      cell.font = { name: 'Times New Roman', size: 10, bold: true }
      cell.fill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFFFFFFF' }
      }
    }

    // Заполнение дневных ячеек Итого (без вывода значений, по просьбе пользователя)
    dates.forEach((date, dateIdx) => {
      const colIndex = 4 + dateIdx
      const cell = footerRow.getCell(colIndex)
      const weekend = isWeekend(date)

      if (colIndex !== 3 + daysInMonth) {
        cell.value = ''
      }
      
      if (colIndex === 3 + daysInMonth) {
        cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFF0000' } }
      } else {
        cell.font = { name: 'Times New Roman', size: 10, bold: true }
      }
      
      if (colIndex !== 3 + daysInMonth) {
        cell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
      }
      cell.fill = weekend
        ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFD9D9' } }
        : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } }
    })

    // Итоговая сумма часов (с использованием формулы Excel)
    const footerHoursCell = footerRow.getCell(colIdxAI)
    footerHoursCell.value = {
      formula: `SUM(${colLetterAI}10:${colLetterAI}${currentRow - 1})`,
      result: grandTotalHours
    }
    footerHoursCell.font = { name: 'Times New Roman', size: 10, bold: true }
    footerHoursCell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
    footerHoursCell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } }
    footerHoursCell.numFmt = '0.00'

    // Всего командировочных дней (с использованием формулы Excel)
    const footerTravelDaysCell = footerRow.getCell(colIdxAJ)
    footerTravelDaysCell.value = {
      formula: `SUM(${colLetterAJ}10:${colLetterAJ}${currentRow - 1})`,
      result: grandTotalTravelDays
    }
    footerTravelDaysCell.font = { name: 'Times New Roman', size: 10, bold: true }
    footerTravelDaysCell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
    footerTravelDaysCell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } }
    footerTravelDaysCell.numFmt = '0'

    // Всего местных дней (с использованием формулы Excel)
    const footerLocalDaysCell = footerRow.getCell(colIdxAK)
    footerLocalDaysCell.value = {
      formula: `SUM(${colLetterAK}10:${colLetterAK}${currentRow - 1})`,
      result: grandTotalLocalDays
    }
    footerLocalDaysCell.font = { name: 'Times New Roman', size: 10, bold: true }
    footerLocalDaysCell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }
    footerLocalDaysCell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } }
    footerLocalDaysCell.numFmt = '0'

    // 8. ПРИМЕНЕНИЕ РАМОК К СЕТКЕ ТАБЛИЦЫ (Medium для границ, Thin для внутреннего содержимого)
    const getBorderForCell = (r: number, c: number, startRow: number, endRow: number, totalCols: number) => {
      const border: any = {
        top: { style: 'thin' as const, color: { argb: 'FF000000' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
        left: { style: 'thin' as const, color: { argb: 'FF000000' } },
        right: { style: 'thin' as const, color: { argb: 'FF000000' } }
      }

      // Внешние рамки всей таблицы (medium)
      if (r === startRow) border.top = { style: 'medium' as const, color: { argb: 'FF000000' } }
      if (r === endRow) border.bottom = { style: 'medium' as const, color: { argb: 'FF000000' } }
      if (c === 1) border.left = { style: 'medium' as const, color: { argb: 'FF000000' } }
      if (c === totalCols) border.right = { style: 'medium' as const, color: { argb: 'FF000000' } }

      // Разделитель после 3-го столбца (Комнад/Местный)
      if (c === 3) border.right = { style: 'medium' as const, color: { argb: 'FF000000' } }
      if (c === 4) border.left = { style: 'medium' as const, color: { argb: 'FF000000' } }

      // Разделитель перед итоговыми столбцами
      if (c === 3 + daysInMonth) border.right = { style: 'medium' as const, color: { argb: 'FF000000' } }
      if (c === 4 + daysInMonth) border.left = { style: 'medium' as const, color: { argb: 'FF000000' } }

      // Разделитель под шапкой таблицы (строка 9)
      if (r === 9) border.bottom = { style: 'medium' as const, color: { argb: 'FF000000' } }
      if (r === 10) border.top = { style: 'medium' as const, color: { argb: 'FF000000' } }

      return border
    }

    const endRow = currentRow
    for (let r = 8; r <= endRow; r++) {
      for (let c = 1; c <= totalCols; c++) {
        const cell = worksheet.getRow(r).getCell(c)
        cell.border = getBorderForCell(r, c, 8, endRow, totalCols)
      }
    }

    // 9. Легенда (К/М) и Цвета Объектов в подвале
    currentRow += 2

    const legendKRow = worksheet.getRow(currentRow)
    const legendKCell = legendKRow.getCell(2)
    legendKCell.value = 'К - командировочные'
    legendKCell.font = { name: 'Times New Roman', size: 9, italic: true }

    const legendMRow = worksheet.getRow(currentRow + 1)
    const legendMCell = legendMRow.getCell(2)
    legendMCell.value = 'М - местные'
    legendMCell.font = { name: 'Times New Roman', size: 9, italic: true }

    if (objectColors.size > 0) {
      let legendRowIdx = currentRow + 3
      const titleRow = worksheet.getRow(legendRowIdx)
      titleRow.getCell(2).value = 'Условные обозначения объектов:'
      titleRow.getCell(2).font = { name: 'Times New Roman', size: 10, bold: true }
      legendRowIdx++

      objectColors.forEach((color, objName) => {
        const objRow = worksheet.getRow(legendRowIdx)
        
        const cCell = objRow.getCell(2)
        cCell.value = '   '
        cCell.fill = {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: color }
        }
        cCell.border = {
          top: { style: 'thin' as const, color: { argb: 'FF000000' } },
          bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
          left: { style: 'thin' as const, color: { argb: 'FF000000' } },
          right: { style: 'thin' as const, color: { argb: 'FF000000' } }
        }
        cCell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const }

        const nCell = objRow.getCell(3)
        nCell.value = objName
        nCell.font = { name: 'Times New Roman', size: 9 }
        nCell.alignment = { horizontal: 'left' as const, vertical: 'middle' as const }

        legendRowIdx++
      })
    }

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

export async function exportWorkJournalExcel(data: {
  objectName: string,
  startDate: string, // DD.MM.YYYY
  endDate: string    // DD.MM.YYYY
}) {
  try {
    const entries = db.prepare(`
      SELECT t.date, t.start_time, t.end_time, t.hours_total, t.work_description,
             w.last_name, w.first_name, w.patronymic
      FROM time_entries t
      JOIN workers w ON t.worker_id = w.id
      WHERE t.object_id = ? AND t.is_approved = 1
    `).all(data.objectName) as any[]

    const toDateObj = (dStr: string) => {
      const parts = dStr.split('.')
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    }

    const start = toDateObj(data.startDate)
    const end = toDateObj(data.endDate)

    const filtered = entries
      .filter(e => {
        const eDate = toDateObj(e.date)
        return eDate >= start && eDate <= end
      })
      .sort((a, b) => {
        return toDateObj(a.date).getTime() - toDateObj(b.date).getTime()
      })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Журнал работ')

    worksheet.pageSetup.orientation = 'landscape'
    worksheet.pageSetup.fitToWidth = 1
    worksheet.pageSetup.fitToHeight = 0
    worksheet.pageSetup.margins = {
      left: 0.5, right: 0.5,
      top: 0.5, bottom: 0.5,
      header: 0.3, footer: 0.3
    }

    worksheet.mergeCells('A1:H1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `ЖУРНАЛ УЧЕТА РАБОЧЕГО ВРЕМЕНИ И ВЫПОЛНЕННЫХ РАБОТ`
    titleCell.font = { name: 'Arial', size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(1).height = 30

    worksheet.mergeCells('A2:H2')
    const subCell = worksheet.getCell('A2')
    subCell.value = `Объект: ${data.objectName}   |   Период: с ${data.startDate} по ${data.endDate}`
    subCell.font = { name: 'Arial', size: 11, italic: true }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(2).height = 20

    worksheet.addRow([])

    const headers = [
      '№ п/п',
      'Дата',
      'Период занятости сотрудника',
      'ФИО сотрудника',
      'Выполняемые работы',
      'Итого часов',
      'Подпись',
      'Примечание'
    ]

    const headerRow = worksheet.addRow(headers)
    headerRow.height = 30
    headerRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' }
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    })

    const indicesRow = worksheet.addRow([1, 2, 3, 4, 5, 6, 7, 8])
    indicesRow.height = 15
    indicesRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 8, italic: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    })

    filtered.forEach((e, idx) => {
      let elapsedHours = e.hours_total || 0
      if (e.start_time && e.end_time) {
        const [hStart, mStart] = e.start_time.split(':').map(Number)
        const [hEnd, mEnd] = e.end_time.split(':').map(Number)
        const diffMin = (hEnd * 60 + mEnd) - (hStart * 60 + mStart)
        if (diffMin > 0) {
          elapsedHours = diffMin / 60
        }
      }
      const roundedHours = Math.round(elapsedHours * 100) / 100
      const periodStr = e.start_time && e.end_time ? `${e.start_time} - ${e.end_time}` : ''

      const lastName = e.last_name || ''
      const firstNameLetter = e.first_name ? `${e.first_name[0]}.` : ''
      const patronymicLetter = e.patronymic ? ` ${e.patronymic[0]}.` : ''
      const fio = `${lastName} ${firstNameLetter}${patronymicLetter}`.trim()

      const rowData = [
        idx + 1,
        e.date,
        periodStr,
        fio,
        e.work_description || '',
        roundedHours,
        '',
        ''
      ]

      const row = worksheet.addRow(rowData)
      row.height = 25
      row.eachCell((cell, colIdx) => {
        cell.font = { name: 'Arial', size: 10 }
        if (colIdx === 4 || colIdx === 5) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        }
      })
    })

    worksheet.getColumn(1).width = 7
    worksheet.getColumn(2).width = 12
    worksheet.getColumn(3).width = 22
    worksheet.getColumn(4).width = 24
    worksheet.getColumn(5).width = 30
    worksheet.getColumn(6).width = 12
    worksheet.getColumn(7).width = 14
    worksheet.getColumn(8).width = 18

    const buffer = await workbook.xlsx.writeBuffer()
    const dateRangeStr = `${data.startDate}_to_${data.endDate}`.replace(/\./g, '-')
    return {
      success: true,
      base64: Buffer.from(buffer).toString('base64'),
      fileName: `Journal_${data.objectName}_${dateRangeStr}.xlsx`
    }
  } catch (err: any) {
    console.error('Work Journal export error:', err)
    return { success: false, error: err.message }
  }
}
