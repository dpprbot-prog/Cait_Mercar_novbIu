'use server'
import db from '@/lib/db'
import { revalidatePath } from 'next/cache'

export interface AuditLog {
  id: number
  user_name: string
  action_type: string // 'create', 'update', 'delete', 'transfer', 'repair', 'writeoff'
  entity_type: string // 'tool', 'siz', 'worker', 'object'
  entity_id: string
  details: string
  created_at: string
}

export async function logAction(data: {
  user_name: string,
  action_type: string,
  entity_type: string,
  entity_id: string,
  details: string
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_name, action_type, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(data.user_name, data.action_type, data.entity_type, data.entity_id, data.details)
    revalidatePath('/')
    revalidatePath('/history')
    revalidatePath('/siz')
    revalidatePath('/tools')
    return { success: true }
  } catch (error) {
    console.error('Failed to log action:', error)
    return { success: false }
  }
}

export async function getAuditLogs(options: {
  entity_type?: string,
  user_name?: string,
  action_type?: string,
  startDate?: string,
  endDate?: string,
  search?: string,
  limit?: number,
  offset?: number
} = {}) {
  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1 '
    const params: any[] = []
    
    if (options.entity_type && options.entity_type !== 'all') {
      query += 'AND entity_type = ? '
      params.push(options.entity_type)
    }
    if (options.user_name) {
      query += 'AND user_name = ? '
      params.push(options.user_name)
    }
    if (options.action_type && options.action_type !== 'all') {
      query += 'AND action_type = ? '
      params.push(options.action_type)
    }
    if (options.startDate) {
      query += 'AND date(created_at) >= date(?) '
      params.push(options.startDate)
    }
    if (options.endDate) {
      query += 'AND date(created_at) <= date(?) '
      params.push(options.endDate)
    }
    if (options.search) {
      query += 'AND (details LIKE ? OR user_name LIKE ? OR entity_id LIKE ?) '
      const q = `%${options.search}%`
      params.push(q, q, q)
    }
    
    query += 'ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(options.limit || 50, options.offset || 0)
    
    const logs = db.prepare(query).all(...params) as AuditLog[]
    
    // Also get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1 '
    const countParams: any[] = []
    // ... repeat filters for count if needed, but for now just the basic query is fine or we can simplify
    
    return logs
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
}
