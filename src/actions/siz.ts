'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type PPEStatus = 'active' | 'returned' | 'expired' | 'lost'
export type PPECategory = 'head' | 'hands' | 'feet' | 'body' | 'eyes' | 'hearing' | 'respiratory' | 'fall'

export interface PPEItem {
  id: string
  name: string
  category: PPECategory
  worker: string
  object: string
  issuedDate: string
  expiryDate: string
  qty: number
  unit: string
  status: PPEStatus
  size?: string
  note?: string
  returnedDate?: string
}

export async function getSizItems(): Promise<PPEItem[]> {
  try {
    const stmt = db.prepare('SELECT * FROM siz_items ORDER BY issuedDate DESC')
    return stmt.all() as PPEItem[]
  } catch (error) {
    console.error('Failed to get siz items:', error)
    return []
  }
}

export async function issueSizItem(data: Omit<PPEItem, 'id' | 'status' | 'returnedDate'>) {
  try {
    const id = Date.now().toString()
    const stmt = db.prepare(`
      INSERT INTO siz_items 
      (id, name, category, worker, object, issuedDate, expiryDate, qty, unit, status, size, note) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      data.name,
      data.category,
      data.worker,
      data.object,
      data.issuedDate,
      data.expiryDate,
      data.qty,
      data.unit,
      'active',
      data.size || null,
      data.note || null
    )
    revalidatePath('/siz')
    return { success: true, id }
  } catch (error) {
    console.error('Failed to issue SIZ:', error)
    return { success: false, error: 'Failed to issue SIZ item' }
  }
}

export async function updateSizStatus(id: string, status: PPEStatus, returnedDate?: string) {
  try {
    const stmt = db.prepare('UPDATE siz_items SET status = ?, returnedDate = ? WHERE id = ?')
    stmt.run(status, returnedDate || null, id)
    revalidatePath('/siz')
    return { success: true }
  } catch (error) {
    console.error('Failed to update SIZ status:', error)
    return { success: false, error: 'Failed to update SIZ status' }
  }
}
