/**
 * OrdersRepo — Rendelések adathozzáférési réteg.
 *
 * Tipikus használat:
 *   const orders = await ordersRepo.list()
 *   const live = ordersRepo.live()  // Dexie liveQuery — UI-ban subscribe-olható
 *
 * Az UI-ban közvetlenül NE használd a `getDb().orders.where(...)` formát —
 * csak ezen az osztályon keresztül, hogy a kérdezési logika egy helyen legyen
 * és könnyen tesztelhető maradjon.
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { Order } from '@/lib/types'

export const ordersRepo = {
  tableName: 'orders' as const,

  async list(): Promise<Order[]> {
    return getDb().orders.toArray()
  },

  async getById(id: string): Promise<Order | undefined> {
    return getDb().orders.get(id)
  },

  /** Egy adott vevő rendelései — `customer` indexen mentes lépcsőzéssel. */
  async byCustomer(customer: string): Promise<Order[]> {
    return getDb().orders.where('customer').equals(customer).toArray()
  },

  /** Egy státusz összes rendelése. */
  async byStatus(status: Order['status']): Promise<Order[]> {
    return getDb().orders.where('status').equals(status).toArray()
  },

  /** Saját rendelési szám alapján — egyedi keresőindex. */
  async byOwnOrderNumber(ownOrderNumber: string): Promise<Order | undefined> {
    return getDb().orders.where('ownOrderNumber').equals(ownOrderNumber).first()
  },

  /** Egy rekord beírása vagy frissítése (id-alapú upsert). */
  async save(order: Order): Promise<string> {
    return getDb().orders.put(order)
  },

  /** Több rekord egyszerre — pl. import és bulk műveletek. */
  async saveMany(orders: Order[]): Promise<void> {
    await getDb().orders.bulkPut(orders)
  },

  async delete(id: string): Promise<void> {
    await getDb().orders.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().orders.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().orders.count()
  },

  /**
   * Live query — observer-szerű subscribe a teljes rendelés-listára.
   * A UI hookja ezt használja, hogy bármilyen forrásból (más tab,
   * tranzakciós módosítás) érkező változásra automatikusan reagáljon.
   */
  live() {
    return liveQuery(() => getDb().orders.toArray())
  },
}
