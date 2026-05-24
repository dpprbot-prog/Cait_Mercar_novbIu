'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAction } from './history'
import { getCurrentUser } from './auth'
import { createNotification } from './notifications'

export interface WorkerSalaryData {
  id: string
  last_name: string
  first_name: string
  patronymic: string | null
  name: string
  role: string
  hours: number
  baseRate: number
  advances: number
  bonuses: number
  penalties: number
  status: 'pending' | 'paid'
  outstandingAdvance: number
}

export interface BrigadeSalaryData {
  id: string
  name: string
  potAmount: number
  workers: WorkerSalaryData[]
}

// ── GET SALARY DATA FOR MONTH ──
export async function getSalaryData(month: number, year: number): Promise<BrigadeSalaryData[]> {
  // Format MM.YYYY or YYYY-MM
  const monthStr = month < 9 ? `0${month + 1}` : `${month + 1}`
  const dateSearch = `%.${monthStr}.${year}` // matches DD.MM.YYYY
  // wait, our time_entries date is DD.MM.YYYY

  // 1. Get all brigades
  const brigades = db.prepare('SELECT id, name, pot_amount FROM brigades ORDER BY name').all() as any[]

  // 2. Fetch specific pot overrides if they exist
  const overrides = db.prepare('SELECT brigade_id, amount FROM brigade_pots WHERE month = ? AND year = ?')
                      .all(month, year) as any[]
  const potsMap = new Map(overrides.map(o => [o.brigade_id, o.amount]))

  const allData: BrigadeSalaryData[] = []

  for (const b of brigades) {
    const potAmount = potsMap.has(b.id) ? potsMap.get(b.id) : b.pot_amount

    // 3. Get workers for this brigade
    const workers = db.prepare('SELECT id, name, last_name, first_name, patronymic, role, base_rate FROM workers WHERE brigade_id = ? ORDER BY name')
                      .all(b.id) as any[]
    
    const workerSalaries: WorkerSalaryData[] = []

    for (const w of workers) {
      // Sum hours for month/year
      const timeData = db.prepare(`
        SELECT SUM(hours_total) as total
        FROM time_entries 
        WHERE worker_id = ? AND date LIKE ?
      `).get(w.id, dateSearch) as { total: number | null }
      
      const hours = timeData.total || 0

      // Financials for month/year (Only load advances where source is NULL as salary deductions)
      const finData = db.prepare(`
        SELECT type, SUM(amount) as total
        FROM financial_records
        WHERE worker_id = ? 
        AND date LIKE ?
        AND (type != 'advance' OR source IS NULL)
        GROUP BY type
      `).all(w.id, dateSearch) as { type: string, total: number }[]

      let advances = 0
      let bonuses = 0
      let penalties = 0

      finData.forEach(f => {
        if (f.type === 'advance') advances = f.total
        if (f.type === 'bonus') bonuses = f.total
        if (f.type === 'penalty') penalties = f.total
      })

      // Calculate total outstanding advance before this month
      // 1. Total advances taken (source IS NOT NULL) at any time
      const totalTaken = db.prepare(`
        SELECT SUM(amount) as total 
        FROM financial_records 
        WHERE worker_id = ? AND type = 'advance' AND source IS NOT NULL
      `).get(w.id) as { total: number | null }
      
      // 2. Total advance deductions (source IS NULL) BEFORE the current month
      const totalRepaidBeforeThisMonth = db.prepare(`
        SELECT SUM(amount) as total 
        FROM financial_records 
        WHERE worker_id = ? AND type = 'advance' AND source IS NULL AND date NOT LIKE ?
      `).get(w.id, dateSearch) as { total: number | null }

      const outstandingAdvance = Math.max(0, (totalTaken.total || 0) - (totalRepaidBeforeThisMonth.total || 0))

      // Check payment status from salary_payments table
      const payment = db.prepare('SELECT id FROM salary_payments WHERE worker_id = ? AND month = ? AND year = ?')
                        .get(w.id, month, year) as { id: number } | undefined
      const status = payment ? 'paid' : 'pending'

      workerSalaries.push({
        id: w.id,
        name: w.name,
        last_name: w.last_name,
        first_name: w.first_name,
        patronymic: w.patronymic,
        role: w.role,
        hours,
        baseRate: w.base_rate,
        advances,
        bonuses,
        penalties,
        status,
        outstandingAdvance
      })
    }

    allData.push({
      id: b.id,
      name: b.name,
      potAmount,
      workers: workerSalaries
    })
  }

  return allData
}

// ── UPDATE POT ──
export async function updateBrigadePot(brigadeId: string, month: number, year: number, amount: number) {
  const existing = db.prepare('SELECT id FROM brigade_pots WHERE brigade_id = ? AND month = ? AND year = ?')
                     .get(brigadeId, month, year) as any

  if (existing) {
    db.prepare('UPDATE brigade_pots SET amount = ? WHERE id = ?').run(amount, existing.id)
  } else {
    db.prepare('INSERT INTO brigade_pots (brigade_id, month, year, amount) VALUES (?, ?, ?, ?)')
      .run(brigadeId, month, year, amount)
  }

  const admin = await getCurrentUser()
  const b = db.prepare('SELECT name FROM brigades WHERE id = ?').get(brigadeId) as any
  await logAction({
    user_name: admin?.name || 'Система',
    action_type: 'update',
    entity_type: 'salary',
    entity_id: brigadeId,
    details: `Обновление фонда (общака) бригады "${b?.name}" на ${amount}`
  })
  revalidatePath('/salary')
}

// ── UPDATE WORKER (Rate, Hours manual overwrite, etc) ──
// Generally we shouldn't overwrite parsed hours, but if needed we can adjust baseRate
export async function updateWorkerRate(workerId: string, newRate: number) {
  db.prepare('UPDATE workers SET base_rate = ? WHERE id = ?').run(newRate, workerId)
  
  const admin = await getCurrentUser()
  const w = db.prepare('SELECT name FROM workers WHERE id = ?').get(workerId) as any
  await logAction({
    user_name: admin?.name || 'Система',
    action_type: 'update',
    entity_type: 'salary',
    entity_id: workerId,
    details: `Изменение ставки сотрудника "${w?.name}": ${newRate}`
  })
  revalidatePath('/salary')
}

// ── ADD FINANCE TRANSACTIONS ──
export async function addFinanceRecord(workerId: string, type: 'advance' | 'bonus' | 'penalty', amount: number, month: number, year: number) {
  // Use a date like "15.MM.YYYY" so the LIKE matcher finds it for this month
  const monthStr = month < 9 ? `0${month + 1}` : `${month + 1}`
  const dateStr = `15.${monthStr}.${year}`

  db.prepare(`
    INSERT INTO financial_records (worker_id, type, amount, date)
    VALUES (?, ?, ?, ?)
  `).run(workerId, type, amount, dateStr)
  
  const admin = await getCurrentUser()
  const w = db.prepare('SELECT name FROM workers WHERE id = ?').get(workerId) as any
  const typeLabel = { advance: 'Аванс', bonus: 'Премия', penalty: 'Штраф' }
  await logAction({
    user_name: admin?.name || 'Система',
    action_type: 'update',
    entity_type: 'finance',
    entity_id: workerId,
    details: `${typeLabel[type]}: ${amount} для ${w?.name}`
  })
  
  revalidatePath('/salary')
}

// ── RESET FINANCE TRANSACTIONS ──
export async function resetFinanceRecord(workerId: string, type: 'advance' | 'bonus' | 'penalty', month: number, year: number) {
  const monthStr = month < 9 ? `0${month + 1}` : `${month + 1}`
  const dateSearch = `%.${monthStr}.${year}`

  db.prepare(`
    DELETE FROM financial_records 
    WHERE worker_id = ? AND type = ? AND date LIKE ?
  `).run(workerId, type, dateSearch)
  
  revalidatePath('/salary')
}

export async function getMonthlyTimesheet(month: number, year: number, brigadeId?: string) {
  const monthStr = month < 9 ? `0${month + 1}` : `${month + 1}`
  const dateSearch = `%.${monthStr}.${year}`
  
  // 1. Получаем список сотрудников
  let workersQuery = 'SELECT id, name, last_name, first_name, patronymic, role FROM workers'
  const params: any[] = []
  if (brigadeId && brigadeId !== '') {
    workersQuery += ' WHERE brigade_id = ?'
    params.push(brigadeId)
  }
  workersQuery += ' ORDER BY last_name, first_name'
  const workers = db.prepare(workersQuery).all(...params) as any[]
  
  // 2. Получаем все записи за месяц
  const entries = db.prepare(`
    SELECT t.id, t.worker_id, t.date, t.hours_total, t.start_time, t.end_time, t.lunch_min, t.object_id, o.name as object_name
    FROM time_entries t
    LEFT JOIN objects o ON t.object_id = o.id
    WHERE t.date LIKE ?
  `).all(dateSearch) as any[]
  
  // 3. Формируем структуру
  const dataMap: Record<string, { 
    worker: any, 
    days: Record<number, { hours: number, object: string, entries?: any[] }> 
  }> = {}
  
  workers.forEach(w => {
    dataMap[w.id.toString()] = {
      worker: w,
      days: {}
    }
  })
  
  entries.forEach(e => {
    const wId = e.worker_id.toString()
    if (dataMap[wId]) {
      const day = parseInt(e.date.split('.')[0], 10)
      if (dataMap[wId].days[day]) {
        dataMap[wId].days[day].hours += e.hours_total
        dataMap[wId].days[day].object += `, ${e.object_name}`
        // Сохраняем список всех записей за день для редактирования
        if (!dataMap[wId].days[day].entries) dataMap[wId].days[day].entries = []
        dataMap[wId].days[day].entries.push(e)
      } else {
        dataMap[wId].days[day] = {
          hours: e.hours_total,
          object: e.object_name,
          entries: [e]
        }
      }
    }
  })
  
  return Object.values(dataMap)
}

export async function updateTimeEntry(id: number, data: {
  objectId: string,
  startTime: string,
  endTime: string,
  lunchMin: number,
  hoursTotal: number
}) {
  db.prepare(`
    UPDATE time_entries 
    SET object_id = ?, start_time = ?, end_time = ?, lunch_min = ?, hours_total = ?
    WHERE id = ?
  `).run(data.objectId, data.startTime, data.endTime, data.lunchMin, data.hoursTotal, id)
  
  revalidatePath('/salary')
  return { success: true }
}

export async function deleteTimeEntry(id: number) {
  db.prepare('DELETE FROM time_entries WHERE id = ?').run(id)
  revalidatePath('/salary')
  return { success: true }
}

export async function getObjects() {
  return db.prepare('SELECT id, name FROM objects ORDER BY name').all() as { id: string, name: string }[]
}

export async function createTimeEntry(data: {
  workerId: string,
  brigadeId: string,
  objectId: string,
  date: string,
  startTime: string,
  endTime: string,
  lunchMin: number,
  hoursTotal: number
}) {
  db.prepare(`
    INSERT INTO time_entries (worker_id, brigade_id, object_id, date, start_time, end_time, lunch_min, hours_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.workerId, data.brigadeId, data.objectId, data.date, data.startTime, data.endTime, data.lunchMin, data.hoursTotal)
  
  revalidatePath('/salary')
  return { success: true }
}

export async function payWorkerInDb(workerId: string, month: number, year: number, amount: number) {
  db.prepare(`
    INSERT OR REPLACE INTO salary_payments (worker_id, month, year, amount)
    VALUES (?, ?, ?, ?)
  `).run(workerId, month, year, amount)

  const admin = await getCurrentUser()
  const w = db.prepare('SELECT name FROM workers WHERE id = ?').get(workerId) as any
  await logAction({
    user_name: admin?.name || 'Система',
    action_type: 'update',
    entity_type: 'salary',
    entity_id: workerId,
    details: `Выплачена зарплата сотруднику "${w?.name}" за ${month + 1}.${year} в размере ${amount} руб.`
  })
  revalidatePath('/salary')
  return { success: true }
}

export async function unpayWorkerInDb(workerId: string, month: number, year: number) {
  db.prepare(`
    DELETE FROM salary_payments 
    WHERE worker_id = ? AND month = ? AND year = ?
  `).run(workerId, month, year)

  const admin = await getCurrentUser()
  const w = db.prepare('SELECT name FROM workers WHERE id = ?').get(workerId) as any
  await logAction({
    user_name: admin?.name || 'Система',
    action_type: 'update',
    entity_type: 'salary',
    entity_id: workerId,
    details: `Отменена выплата зарплаты сотруднику "${w?.name}" за ${month + 1}.${year}`
  })
  revalidatePath('/salary')
  return { success: true }
}

export async function sendSalaryNotifications(brigadeId: string, month: number, year: number, workersData: any[]) {
  const monthStr = month < 9 ? `0${month + 1}` : `${month + 1}`
  const dateSearch = `%.${monthStr}.${year}`
  const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

  for (const w of workersData) {
    // 1. Get entries for this worker and month to calculate breakdown of hours by objects
    const entries = db.prepare(`
      SELECT t.hours_total, o.name as object_name
      FROM time_entries t
      LEFT JOIN objects o ON t.object_id = o.id
      WHERE t.worker_id = ? AND t.date LIKE ?
    `).all(w.id, dateSearch) as { hours_total: number, object_name: string | null }[]

    const objHours: Record<string, number> = {}
    entries.forEach(e => {
      const name = e.object_name || 'Не указан'
      objHours[name] = (objHours[name] || 0) + e.hours_total
    })

    const objectsBreakdown = Object.entries(objHours)
      .map(([name, h]) => `${name}: ${h.toFixed(1)} ч`)
      .join(', ')

    // 2. Format a beautiful calculation breakdown
    const basePay = Math.round((w.hours * w.baseRate) * 100) / 100
    const finalPay = basePay + w.bonuses - w.penalties - w.advances

    let message = `Отработано часов: ${w.hours.toFixed(1)} ч.`
    if (objectsBreakdown) {
      message += `\nПо объектам — ${objectsBreakdown}.`
    }
    message += `\nСтавка: ${w.baseRate} ₽/ч.`
    message += `\nНачислено по окладу: ${basePay.toLocaleString('ru-RU')} ₽.`
    
    if (w.bonuses > 0) {
      message += `\nПремия: +${w.bonuses.toLocaleString('ru-RU')} ₽.`
    }
    if (w.advances > 0) {
      message += `\nУдержано авансов: -${w.advances.toLocaleString('ru-RU')} ₽.`
    }
    if (w.penalties > 0) {
      message += `\nШтрафы: -${w.penalties.toLocaleString('ru-RU')} ₽.`
    }
    
    message += `\n\nИТОГ К ВЫДАЧЕ НА РУКИ: ${Math.max(0, finalPay).toLocaleString('ru-RU')} ₽.`

    const title = `Расчетный лист за ${MONTHS_RU[month]} ${year}`

    // 3. Send notification
    await createNotification(w.id, 'salary_sheet', title, message)
  }

  const admin = await getCurrentUser()
  const bName = db.prepare('SELECT name FROM brigades WHERE id = ?').get(brigadeId) as any
  await logAction({
    user_name: admin?.name || 'Система',
    action_type: 'update',
    entity_type: 'salary',
    entity_id: brigadeId,
    details: `Отправлены расчетные листы сотрудникам бригады "${bName?.name}" за ${MONTHS_RU[month]} ${year}`
  })

  return { success: true }
}
