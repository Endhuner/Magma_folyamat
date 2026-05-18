/**
 * Dexie-alapú offline műveleti sor.
 *
 * Ha az API nem elérhető, az add/update/remove műveletek ide kerülnek.
 * Amikor a kapcsolat visszaáll, a sor automatikusan lejátszódik sorban,
 * majd az érintett resource-ok újratöltődnek.
 *
 * Műveletek típusa:
 *   - POST  (add)
 *   - PATCH (update)
 *   - DELETE (remove)
 */
import Dexie, { type Table } from 'dexie'

export type QueuedOpMethod = 'POST' | 'PATCH' | 'DELETE'

export interface QueuedOp {
  id?: number
  resource: string
  entityId: string
  method: QueuedOpMethod
  /** A küldendő request body (POST/PATCH esetén) */
  body?: string
  createdAt: number
}

class OfflineQueueDB extends Dexie {
  ops!: Table<QueuedOp, number>

  constructor() {
    super('produktivpro-offline-queue')
    this.version(1).stores({
      ops: '++id, resource, entityId, method, createdAt',
    })
  }
}

const db = new OfflineQueueDB()

export async function enqueue(op: Omit<QueuedOp, 'id' | 'createdAt'>): Promise<void> {
  await db.ops.add({ ...op, createdAt: Date.now() })
}

export async function getPendingCount(): Promise<number> {
  return db.ops.count()
}

export async function getPendingOps(): Promise<QueuedOp[]> {
  return db.ops.orderBy('createdAt').toArray()
}

export async function removeOp(id: number): Promise<void> {
  await db.ops.delete(id)
}

export async function clearAll(): Promise<void> {
  await db.ops.clear()
}

/**
 * Lejátssza a sort sorrendben. Sikeres műveletet törli.
 * Hibás műveletnél megáll és visszaadja a maradék számát.
 * @returns hány műveletet sikerült lejátszani
 */
export async function flushQueue(
  apiFetch: (url: string, init: RequestInit) => Promise<unknown>
): Promise<{ played: number; remaining: number }> {
  const ops = await getPendingOps()
  let played = 0

  for (const op of ops) {
    const url = `/api/v1/${op.resource}${op.method !== 'POST' ? `/${encodeURIComponent(op.entityId)}` : ''}`
    try {
      await apiFetch(url, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: op.body,
      })
      if (op.id !== undefined) await removeOp(op.id)
      played++
    } catch {
      break
    }
  }

  const remaining = await getPendingCount()
  return { played, remaining }
}
