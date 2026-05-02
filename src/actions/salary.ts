'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'

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

      // Financials for month/year
      const finData = db.prepare(`
        SELECT type, SUM(amount) as total
        FROM financial_records
        WHERE worker_id = ? 
        -- filtering by date could be tricky depending on how we save finance dates, 
        -- assuming finance dates are YYYY-MM-DD or DD.MM.YYYY, we'll use LIKE
        AND date LIKE ?
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

      // Assuming status is always 'pending' for now until Payment table is implemented
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
        status: 'pending'
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
  revalidatePath('/salary')
}

// ── UPDATE WORKER (Rate, Hours manual overwrite, etc) ──
// Generally we shouldn't overwrite parsed hours, but if needed we can adjust baseRate
export async function updateWorkerRate(workerId: string, newRate: number) {
  db.prepare('UPDATE workers SET base_rate = ? WHERE id = ?').run(newRate, workerId)
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
