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
 * Lejátssza a sort sorrendben.
 *  - Siker → a művelet törlődik a sorból.
 *  - Végleges hiba (4xx — a szerver érvénytelennek ítélte) → a művelet
 *    törlődik, de `failed`-ként jelentjük; a mögötte állók FOLYTATÓDNAK.
 *    (Korábban az első hiba `break`-kel az egész sort beragasztotta.)
 *  - Átmeneti hiba (hálózat / 5xx) → megállunk, a maradék a sorban marad
 *    a következő próbálkozásig.
 */
export async function flushQueue(
  apiFetch: (url: string, init: RequestInit) => Promise<unknown>
): Promise<{ played: number; remaining: number; failed: number }> {
  const ops = await getPendingOps()
  let played = 0
  let failed = 0

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
    } catch (err) {
      const status = (err as { status?: number }).status
      const isPermanent = typeof status === 'number' && status >= 400 && status < 500
      if (isPermanent) {
        console.error(`[offlineQueue] végleges hiba (${status}) — kihagyva:`, op.method, op.resource, op.entityId, op.body)
        if (op.id !== undefined) await removeOp(op.id)
        failed++
        continue
      }
      // Hálózati vagy szerver-oldali (5xx) hiba — később újrapróbáljuk
      break
    }
  }

  const remaining = await getPendingCount()
  return { played, remaining, failed }
}
