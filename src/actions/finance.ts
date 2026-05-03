'use server'
import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAction } from './history'
import { getCurrentUser } from './auth'

export interface Advance {
  id: number
  worker_id: string
  worker_name: string
  amount: number
  date: string
  source: 'personal' | 'firm' | 'director'
  author_id: string
  author_name: string
  description: string
  created_at: string
}

export async function getAdvances() {
  const data = db.prepare(`
    SELECT 
      fr.*, 
      w.name as worker_name,
      aw.name as author_name
    FROM financial_records fr
    JOIN workers w ON fr.worker_id = w.id
    LEFT JOIN workers aw ON fr.author_id = aw.id
    WHERE fr.type = 'advance'
    ORDER BY fr.date DESC, fr.id DESC
  `).all() as any[]
  
  return data as Advance[]
}

export async function createAdvance(data: {
  worker_id: string,
  amount: number,
  date: string,
  source: string,
  description: string
}) {
  const user = await getCurrentUser()
  
  const result = db.prepare(`
    INSERT INTO financial_records (worker_id, type, amount, date, source, author_id, description)
    VALUES (?, 'advance', ?, ?, ?, ?, ?)
  `).run(data.worker_id, data.amount, data.date, data.source, user?.id || null, data.description)
  
  const worker = db.prepare('SELECT name FROM workers WHERE id = ?').get(data.worker_id) as any
  
  await logAction({
    user_name: user?.name || 'Система',
    action_type: 'create',
    entity_type: 'salary',
    entity_id: String(result.lastInsertRowid),
    details: `Выдан аванс: ${worker?.name} — ${data.amount} руб. (Источник: ${data.source})`
  })
  
  revalidatePath('/salary')
  revalidatePath('/history')
  return result.lastInsertRowid
}

export async function deleteAdvance(id: number) {
  const adv = db.prepare(`
    SELECT fr.*, w.name as worker_name 
    FROM financial_records fr 
    JOIN workers w ON fr.worker_id = w.id 
    WHERE fr.id = ?
  `).get(id) as any
  
  if (!adv) return
  
  db.prepare('DELETE FROM financial_records WHERE id = ?').run(id)
  
  const user = await getCurrentUser()
  await logAction({
    user_name: user?.name || 'Система',
    action_type: 'delete',
    entity_type: 'salary',
    entity_id: String(id),
    details: `Удален аванс: ${adv.worker_name} — ${adv.amount} руб.`
  })
  
  revalidatePath('/salary')
  revalidatePath('/history')
}
