/**
 * Napi anyagfogyás-könyvelés (az A3 „hibrid" modell szerver-oldala).
 *
 * Naponta egyszer minden alapanyag-tételre kiszámolja a lövésszámokból a
 * LEZÁRT napok fogyását (a 'material-booked-through' beállításban tárolt
 * dátum után, a mai napot NEM beleértve), és egyetlen összesítő out-mozgást
 * könyvel róla. A kliens élő becslése ugyanennek a képletnek a másik fele:
 * a még nem könyvelt napok fogyását vonja le a könyvelt készletből.
 *
 * A képlet és a termék-párosítás a @produktivpro/shared materialCalc-ból jön
 * — a kliens és a szerver garantáltan ugyanazt számolja.
 *
 * ponytail: egy példányra tervezve (mint az ütemezett mentés); több API-node
 * esetén elosztott lock kellene.
 */
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { FastifyBaseLogger } from 'fastify'
import { computeConsumptionKg } from '@produktivpro/shared'
import { getDb } from '../db/connection.js'
import {
  appSettings,
  inventoryItems,
  inventoryTransactions,
  orders,
  products,
  productionShifts,
} from '../db/schema.js'
import { broadcast } from './sseBroadcaster.js'
import { recordAudit } from './auditService.js'

const SETTING_KEY = 'material-booked-through'
const DAY_MS = 24 * 60 * 60 * 1000

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayIso(): string {
  const d = new Date(Date.now() - DAY_MS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readBookedThrough(): Record<string, string> {
  const db = getDb()
  const row = db.select().from(appSettings).where(eq(appSettings.key, SETTING_KEY)).get()
  if (!row) return {}
  try {
    const v = JSON.parse(row.value)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function writeBookedThrough(map: Record<string, string>): void {
  const db = getDb()
  const now = new Date().toISOString()
  const serialized = JSON.stringify(map)
  db.insert(appSettings)
    .values({ key: SETTING_KEY, value: serialized, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: serialized, updatedAt: now } })
    .run()
}

/** Egyszeri könyvelés-futás. Hibát nem dob — naplóz. */
export function runMaterialConsolidationOnce(log: FastifyBaseLogger): void {
  try {
    const db = getDb()
    const materials = db.select().from(inventoryItems).where(eq(inventoryItems.itemType, 'alapanyag')).all()
    if (materials.length === 0) return

    const bookedThrough = readBookedThrough()
    const today = todayIso()
    const yesterday = yesterdayIso()

    // A számításhoz szükséges adatok egyszer betöltve
    const allShifts = db.select().from(productionShifts).all()
    const allOrders = db.select().from(orders).all()
    const allProducts = db.select().from(products).all()

    let bookedCount = 0
    for (const item of materials) {
      const after = bookedThrough[item.id]
      if (!after) {
        // Új anyag: első futáskor csak felvesszük a viszonyítási pontot —
        // a múltbeli műszakokat nem terheljük rá visszamenőleg.
        bookedThrough[item.id] = yesterday
        continue
      }
      if (after >= yesterday) continue // ma már könyvelt / nincs lezárt nap

      const kg = computeConsumptionKg(item.productName, allShifts, allOrders, allProducts, {
        afterDate: after,
        beforeDate: today, // a mai (folyamatban lévő) nap még nem záródik le
      })

      if (kg > 0.05) {
        const now = new Date().toISOString()
        const newQty = Math.max(0, Math.round((item.quantity - kg) * 10) / 10)
        db.transaction(() => {
          db.insert(inventoryTransactions).values({
            id: uuidv4(),
            inventoryItemId: item.id,
            type: 'out',
            quantity: kg,
            orderId: null,
            notes: `[anyagfogyás] Gépi fogyás könyvelése (${after} → ${yesterday}): −${kg} kg`,
            createdAt: now,
          } as never).run()
          db.update(inventoryItems)
            .set({ quantity: newQty, lastUpdated: now })
            .where(eq(inventoryItems.id, item.id))
            .run()
        })
        try {
          recordAudit({
            entityType: 'inventory',
            entityLabel: 'Készlet',
            entityId: item.id,
            entityName: item.productName,
            action: 'out',
            userName: 'Rendszer (napi anyagkönyvelés)',
          })
        } catch { /* az audit-hiba nem állítja meg a könyvelést */ }
        broadcast({ type: 'inventory', action: 'out', id: item.id })
        broadcast({ type: 'inventoryTransaction', action: 'create', id: item.id })
        log.info(`[anyag] ${item.productName}: −${kg} kg könyvelve (${after} → ${yesterday}), új készlet: ${newQty} kg`)
        bookedCount++
      }
      bookedThrough[item.id] = yesterday
    }

    writeBookedThrough(bookedThrough)
    if (bookedCount > 0) log.info(`[anyag] napi könyvelés kész: ${bookedCount} anyag frissítve`)
  } catch (err) {
    log.error(err, '[anyag] napi könyvelés sikertelen')
  }
}

let timer: ReturnType<typeof setInterval> | null = null

/** Beindítja a napi anyagkönyvelést (boot után 90 mp, majd 24 óránként). */
export function startMaterialConsolidation(log: FastifyBaseLogger): void {
  if (process.env.DISABLE_MATERIAL_CONSOLIDATION === 'true') {
    log.info('[anyag] napi könyvelés kikapcsolva (DISABLE_MATERIAL_CONSOLIDATION)')
    return
  }
  if (timer) return
  setTimeout(() => runMaterialConsolidationOnce(log), 90_000)
  timer = setInterval(() => runMaterialConsolidationOnce(log), DAY_MS)
  log.info('[anyag] napi anyagfogyás-könyvelés aktív')
}
