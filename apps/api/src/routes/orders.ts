/**
 * Orders REST endpointok.
 *
 * Megj.: státuszváltást a sima PUT/PATCH le tudja kezelni, a CRUD-factory
 * audit-logba menti a `status` mező változását. Phase 2-ben készítünk
 * dedikált POST /:id/status endpointot, amely a `status`-action típust írja
 * (a frontend audit-szűrője ezt használja a kék badge-hez).
 */
import type { FastifyInstance } from 'fastify'
import { eq, like } from 'drizzle-orm'
import { orderCreateSchema, orderUpdateSchema } from '@produktivpro/shared'
import { orders } from '../db/schema.js'
import { getDb } from '../db/connection.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

/**
 * Következő szabad saját rendelésszám ugyanahhoz a prefixhez (pl. 'M261').
 * A better-sqlite3 szinkron és egyetlen kapcsolaton fut, így a SELECT + INSERT
 * a kérésen belül nem fésülődhet össze másik kéréssel — a kiosztás atomi.
 */
function nextFreeOwnOrderNumber(requested: string): string {
  const db = getDb()
  const prefix = requested.slice(0, 4) // 'M' + év két számjegye + '1'
  const rows = db
    .select({ n: orders.ownOrderNumber })
    .from(orders)
    .where(like(orders.ownOrderNumber, `${prefix}%`))
    .all()
  let max = 0
  for (const r of rows) {
    const m = String(r.n).match(/^M\d{2}1(\d+)$/)
    if (m) max = Math.max(max, Number.parseInt(m[1]!, 10) || 0)
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'orders',
    table: orders,
    insertSchema: orderCreateSchema,
    updateSchema: orderUpdateSchema,
    auditEntity: 'order',
    auditLabel: 'Rendelés',
    nameField: 'orderNumber',
    permissions: {
      read:   ['admin', 'operator'],  // operátor is látja a gyártáshoz szükséges rendeléseket
      create: ['admin'],
      update: ['admin', 'operator'],  // operátor státuszt válthat (gyártás indítás/szünetelés/leállítás)
      delete: ['admin'],
    },
    // Sorszám-ütközés feloldás: a kliens a helyi listából generál saját
    // rendelésszámot, így két egyidejű felhasználó ugyanazt kaphatja. Ha a
    // beküldött szám már MÁSIK rendelésé, a szerver a következő szabadra
    // cseréli — a kliens a POST-válaszból visszakapja a végleges számot.
    transformInput: (input, ctx) => {
      const num = input.ownOrderNumber
      if (typeof num === 'string' && /^M\d{2}1\d+$/.test(num)) {
        const db = getDb()
        const clash = db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.ownOrderNumber, num))
          .get()
        const selfId = ctx?.id ?? (typeof input.id === 'string' ? input.id : undefined)
        if (clash && clash.id !== selfId) {
          return { ...input, ownOrderNumber: nextFreeOwnOrderNumber(num) }
        }
      }
      return input
    },
  })
}
