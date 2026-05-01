/**
 * InventoryRepo — Készlet adathozzáférési réteg.
 *
 * KRITIKUS: az `deductTx()` atomi tranzakcióval von le készletet és írja ki
 * a hozzá tartozó `inventoryTransactions` sort. Ez oldja meg azt a hibát,
 * amit korábban a localStorage-szal csak race-condition-ön keresztül lehetett
 * (két tab egy időben szállít ki ugyanarról a készletről).
 *
 * Indexek a schema.ts szerint: `productId`, `customer`, `drawingNumber`,
 * `[customer+drawingNumber]`.
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { InventoryItem, InventoryTransaction } from '@/lib/types'

export interface DeductInput {
  /** A készlet-tétel azonosítója. */
  inventoryItemId: string
  /** Levonandó mennyiség (pozitív). */
  quantity: number
  /** A kapcsolt rendelés azonosítója (a tranzakcióhoz mentjük). */
  orderId?: string
  /** Tranzakció megjegyzés. */
  notes?: string
  /** Felhasználó (audit-log/tranzakció melléklet). */
  userId?: string
}

export interface DeductResult {
  /** A frissített készlet-tétel a levonás után. */
  item: InventoryItem
  /** A létrejött tranzakció (típus: 'out'). */
  transaction: InventoryTransaction
}

export const inventoryRepo = {
  tableName: 'inventory' as const,

  async list(): Promise<InventoryItem[]> {
    return getDb().inventory.toArray()
  },

  async getById(id: string): Promise<InventoryItem | undefined> {
    return getDb().inventory.get(id)
  },

  /** Egy termékhez tartozó készlettétel(ek) — pl. ha több raktárhely van. */
  async byProductId(productId: string): Promise<InventoryItem[]> {
    return getDb().inventory.where('productId').equals(productId).toArray()
  },

  async byCustomer(customer: string): Promise<InventoryItem[]> {
    return getDb().inventory.where('customer').equals(customer).toArray()
  },

  /** Vevő + rajzszám kombináció — a rendelés→készlet párosítás leggyakoribb útja. */
  async byCustomerAndDrawing(
    customer: string,
    drawingNumber: string
  ): Promise<InventoryItem[]> {
    return getDb()
      .inventory.where('[customer+drawingNumber]')
      .equals([customer, drawingNumber])
      .toArray()
  },

  async save(item: InventoryItem): Promise<string> {
    return getDb().inventory.put(item)
  },

  async saveMany(items: InventoryItem[]): Promise<void> {
    await getDb().inventory.bulkPut(items)
  },

  async delete(id: string): Promise<void> {
    await getDb().inventory.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().inventory.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().inventory.count()
  },

  /**
   * Atomi készletlevonás. Egy `readwrite` tranzakcióban olvassa ki, ellenőrzi
   * a fedezetet, frissíti a készletet és új `inventoryTransactions` rekordot ír.
   *
   * Ha párhuzamosan két tab/művelet hívja, a Dexie/IDB ütemezi és
   * sorba állítja őket — soha nem alakul ki olyan helyzet, hogy mindkét
   * "látja" még a régi mennyiséget és túllévonás keletkezik.
   *
   * Hiba: ha a tétel nem létezik vagy nincs elég készlet, az egész
   * tranzakció abortál (semmi sem mentődik el).
   */
  async deductTx(input: DeductInput): Promise<DeductResult> {
    if (!input.quantity || input.quantity <= 0) {
      throw new Error('A levonandó mennyiségnek pozitívnak kell lennie.')
    }

    const db = getDb()
    let result: DeductResult | null = null

    await db.transaction('rw', [db.inventory, db.inventoryTransactions], async () => {
      const current = await db.inventory.get(input.inventoryItemId)
      if (!current) {
        throw new Error(`Készlettétel nem található: ${input.inventoryItemId}`)
      }
      if (current.quantity < input.quantity) {
        throw new Error(
          `Nincs elegendő készlet (${current.quantity} db) a kért ${input.quantity} db levonásához.`
        )
      }

      const now = new Date().toISOString()
      const updated: InventoryItem = {
        ...current,
        quantity: current.quantity - input.quantity,
        lastUpdated: now,
      }
      await db.inventory.put(updated)

      const tx: InventoryTransaction = {
        id: crypto.randomUUID(),
        inventoryItemId: current.id,
        type: 'out',
        quantity: input.quantity,
        orderId: input.orderId,
        notes: input.notes ?? '',
        userId: input.userId,
        createdAt: now,
      }
      await db.inventoryTransactions.put(tx)

      result = { item: updated, transaction: tx }
    })

    if (!result) {
      // A Dexie tranzakció vagy sikeres, vagy hibát dob — ide elvileg nem érünk.
      throw new Error('A készletlevonás nem hajtódott végre.')
    }
    return result
  },

  /**
   * Atomi készletbevét (műszakrögzítésből vagy manuális hozzáadásból).
   * Hasonló logika, mint a deductTx, de növeli a mennyiséget.
   */
  async addTx(input: {
    inventoryItemId: string
    quantity: number
    orderId?: string
    shiftId?: string
    notes?: string
    userId?: string
    type?: 'in' | 'adjustment'
  }): Promise<DeductResult> {
    if (!input.quantity || input.quantity <= 0) {
      throw new Error('A bevett mennyiségnek pozitívnak kell lennie.')
    }

    const db = getDb()
    let result: DeductResult | null = null

    await db.transaction('rw', [db.inventory, db.inventoryTransactions], async () => {
      const current = await db.inventory.get(input.inventoryItemId)
      if (!current) {
        throw new Error(`Készlettétel nem található: ${input.inventoryItemId}`)
      }

      const now = new Date().toISOString()
      const updated: InventoryItem = {
        ...current,
        quantity: current.quantity + input.quantity,
        lastUpdated: now,
      }
      await db.inventory.put(updated)

      const tx: InventoryTransaction = {
        id: crypto.randomUUID(),
        inventoryItemId: current.id,
        type: input.type ?? 'in',
        quantity: input.quantity,
        orderId: input.orderId,
        shiftId: input.shiftId,
        notes: input.notes ?? '',
        userId: input.userId,
        createdAt: now,
      }
      await db.inventoryTransactions.put(tx)

      result = { item: updated, transaction: tx }
    })

    if (!result) {
      throw new Error('A készletbevét nem hajtódott végre.')
    }
    return result
  },

  live() {
    return liveQuery(() => getDb().inventory.toArray())
  },
}
