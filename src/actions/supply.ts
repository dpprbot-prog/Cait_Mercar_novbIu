'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAction } from './history'
import { getCurrentUser } from './auth'

export type MStatus = 'new' | 'assigned' | 'picked' | 'delivered' | 'accepted'
export type Priority = 'planned' | 'urgent' | 'days' | 'week'

export interface MComment {
  id: string
  author: string
  role: string
  text: string
  ts: string
}

export interface MatItem {
  mid: string
  name: string
  orderedQty: number
  assignedQty?: number
  pickedQty?: number
  unit: string
  note?: string
  mStatus: MStatus
  storeName?: string
  driver?: string
  parentMid?: string
  comments: MComment[]
}

export interface Order {
  id: string
  object: string
  priority: Priority
  author: string
  authorRole: string
  createdAt: string
  comment?: string
  link?: string
  photos?: string[]
  items: MatItem[]
}

// ── GET SUPPLY ORDERS ──
export async function getSupplyOrders(): Promise<Order[]> {
  // Get all orders
  const ordersData = db.prepare('SELECT * FROM supply_orders ORDER BY id DESC').all() as any[]
  // Get all items
  const itemsData = db.prepare('SELECT * FROM supply_items').all() as any[]
  // Get all comments
  const commentsData = db.prepare('SELECT * FROM supply_comments ORDER BY id ASC').all() as any[]

  // Group comments by item_mid
  const commentsMap = new Map<string, MComment[]>()
  commentsData.forEach(c => {
    if (!commentsMap.has(c.item_mid)) commentsMap.set(c.item_mid, [])
    commentsMap.get(c.item_mid)!.push({
      id: c.id,
      author: c.author,
      role: c.role,
      text: c.text,
      ts: c.ts
    })
  })

  // Group items by order_id
  const itemsMap = new Map<string, MatItem[]>()
  itemsData.forEach(item => {
    if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, [])
    itemsMap.get(item.order_id)!.push({
      mid: item.mid,
      name: item.name,
      orderedQty: item.ordered_qty,
      assignedQty: item.assigned_qty || undefined,
      pickedQty: item.picked_qty || undefined,
      unit: item.unit,
      note: item.note || undefined,
      mStatus: item.m_status as MStatus,
      storeName: item.store_name || undefined,
      driver: item.driver || undefined,
      parentMid: item.parent_mid || undefined,
      comments: commentsMap.get(item.mid) || []
    })
  })

  // Assemble orders
  const orders: Order[] = ordersData.map(o => ({
    id: o.id,
    object: o.object,
    priority: o.priority as Priority,
    author: o.author,
    authorRole: o.author_role,
    createdAt: o.created_at,
    comment: o.comment || undefined,
    link: o.link || undefined,
    photos: o.photos ? JSON.parse(o.photos) : undefined,
    items: itemsMap.get(o.id) || []
  }))

  return orders
}

// ── CREATE ORDER ──
export async function createSupplyOrder(
  order: Omit<Order, 'items'>, 
  items: Omit<MatItem, 'comments'>[]
) {
  const insertOrder = db.prepare('INSERT INTO supply_orders (id, object, priority, author, author_role, comment, link, photos, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertItem = db.prepare('INSERT INTO supply_items (mid, order_id, name, ordered_qty, assigned_qty, picked_qty, unit, note, m_status, store_name, driver, parent_mid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  
  const photosStr = order.photos && order.photos.length > 0 ? JSON.stringify(order.photos) : null
  db.transaction(() => {
    insertOrder.run(order.id, order.object, order.priority, order.author, order.authorRole, order.comment || null, order.link || null, photosStr, order.createdAt)
    items.forEach(it => {
      insertItem.run(it.mid, order.id, it.name, it.orderedQty, it.assignedQty || null, it.pickedQty || null, it.unit, it.note || null, it.mStatus, it.storeName || null, it.driver || null, it.parentMid || null)
    })
  })()
  
  const admin = await getCurrentUser()
  await logAction({
    user_name: admin?.name || order.author || 'Система',
    action_type: 'create',
    entity_type: 'supply',
    entity_id: order.id,
    details: `Создана заявка на снабжение #${order.id} (${order.object})`
  })
  
  revalidatePath('/supply')
}

// ── UPDATE ITEM META (Status, Store, Driver, Qty) ──
export async function updateSupplyItem(mid: string, patch: Partial<MatItem>) {
  const sets: string[] = []
  const values: any[] = []

  if (patch.mStatus !== undefined) { sets.push('m_status = ?'); values.push(patch.mStatus) }
  if (patch.storeName !== undefined) { sets.push('store_name = ?'); values.push(patch.storeName || null) }
  if (patch.driver !== undefined) { sets.push('driver = ?'); values.push(patch.driver || null) }
  if (patch.assignedQty !== undefined) { sets.push('assigned_qty = ?'); values.push(patch.assignedQty) }
  if (patch.pickedQty !== undefined) { sets.push('picked_qty = ?'); values.push(patch.pickedQty) }

  if (sets.length === 0) return

  values.push(mid)
  db.prepare(`UPDATE supply_items SET ${sets.join(', ')} WHERE mid = ?`).run(...values)
  
  const admin = await getCurrentUser()
  const it = db.prepare('SELECT name, m_status FROM supply_items WHERE mid = ?').get(mid) as any
  const statusLabels: any = { assigned: 'Назначено', picked: 'Закуплено', delivered: 'Доставлено', accepted: 'Принято' }
  
  if (patch.mStatus) {
    await logAction({
      user_name: admin?.name || 'Система',
      action_type: 'update',
      entity_type: 'supply',
      entity_id: mid,
      details: `Статус "${it?.name}": ${statusLabels[patch.mStatus] || patch.mStatus}`
    })
  }
  revalidatePath('/supply')
}

// ── ADD COMMENT ──
export async function addSupplyComment(mid: string, id: string, author: string, role: string, text: string, ts: string) {
  db.prepare('INSERT INTO supply_comments (id, item_mid, author, role, text, ts) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, mid, author, role, text, ts)
  revalidatePath('/supply')
}

// ── SPLIT ITEM (Create duplicate for remaining qty) ──
export async function splitSupplyItem(mid: string, assignedQty: number, storeName: string, driver: string, remainingItem: Omit<MatItem, 'comments'>) {
  const insertItem = db.prepare('INSERT INTO supply_items (mid, order_id, name, ordered_qty, assigned_qty, picked_qty, unit, note, m_status, store_name, driver, parent_mid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  
  // Get original item order_id
  const original = db.prepare('SELECT order_id FROM supply_items WHERE mid = ?').get(mid) as { order_id: string }
  if (!original) return

  db.transaction(() => {
    // 1. Update original
    db.prepare('UPDATE supply_items SET assigned_qty = ?, store_name = ?, driver = ?, m_status = ? WHERE mid = ?')
      .run(assignedQty, storeName, driver, 'assigned', mid)
    
    // 2. Insert remainder
    insertItem.run(remainingItem.mid, original.order_id, remainingItem.name, remainingItem.orderedQty, null, null, remainingItem.unit, remainingItem.note || null, 'new', null, null, remainingItem.parentMid)
  })()
  
  revalidatePath('/supply')
}

// ── PARTIAL PICKUP ITEM (Create duplicate for remaining assigned qty) ──
export async function partialPickupSupplyItem(mid: string, pickedQty: number, remainingItem: Omit<MatItem, 'comments'>) {
  const insertItem = db.prepare('INSERT INTO supply_items (mid, order_id, name, ordered_qty, assigned_qty, picked_qty, unit, note, m_status, store_name, driver, parent_mid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  
  const original = db.prepare('SELECT order_id FROM supply_items WHERE mid = ?').get(mid) as { order_id: string }
  if (!original) return

  db.transaction(() => {
    // 1. Update original
    db.prepare('UPDATE supply_items SET picked_qty = ?, m_status = ? WHERE mid = ?')
      .run(pickedQty, 'picked', mid)
    
    // 2. Insert remainder (goes back to supply queue)
    insertItem.run(remainingItem.mid, original.order_id, remainingItem.name, remainingItem.orderedQty, null, null, remainingItem.unit, remainingItem.note || null, 'new', null, null, remainingItem.parentMid)
  })()
  
  revalidatePath('/supply')
}

// ── BULK ASSIGN ──
export async function bulkAssignSupplyItems(mids: string[], storeName?: string, driver?: string) {
  if (!mids.length) return
  const placeholders = mids.map(() => '?').join(',')
  
  // Update store if provided, driver if provided
  let setQuery = "m_status = 'assigned'"
  const params: any[] = []
  
  if (storeName) {
    setQuery += ", store_name = ?"
    params.push(storeName)
  }
  if (driver) {
    setQuery += ", driver = ?"
    params.push(driver)
  }
  
  // If assigned_qty is null, it should become ordered_qty. SQLite makes this a bit tricky conditionally in bulk,
  // but we can do COALESCE(assigned_qty, ordered_qty)
  setQuery += ", assigned_qty = COALESCE(assigned_qty, ordered_qty)"
  
  db.prepare(`UPDATE supply_items SET ${setQuery} WHERE mid IN (${placeholders})`)
    .run(...params, ...mids)
    
  revalidatePath('/supply')
}
