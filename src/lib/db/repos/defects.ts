/**
 * DefectsRepo — Selejt rögzítések adathozzáférési réteg.
 *
 * Indexek: `orderId`, `date`.
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { ProductionDefect } from '@/lib/types'

export const defectsRepo = {
  tableName: 'productionDefects' as const,

  async list(): Promise<ProductionDefect[]> {
    return getDb().productionDefects.toArray()
  },

  async getById(id: string): Promise<ProductionDefect | undefined> {
    return getDb().productionDefects.get(id)
  },

  /** Egy rendelés összes selejtbejegyzése — riporthoz időrendben. */
  async byOrder(orderId: string): Promise<ProductionDefect[]> {
    const list = await getDb()
      .productionDefects.where('orderId')
      .equals(orderId)
      .toArray()
    return list.sort((a, b) => a.date.localeCompare(b.date))
  },

  /** Egy adott napon rögzített selejtek (összes rendelésen). */
  async byDate(date: string): Promise<ProductionDefect[]> {
    return getDb().productionDefects.where('date').equals(date).toArray()
  },

  async save(defect: ProductionDefect): Promise<string> {
    return getDb().productionDefects.put(defect)
  },

  async saveMany(defects: ProductionDefect[]): Promise<void> {
    await getDb().productionDefects.bulkPut(defects)
  },

  async delete(id: string): Promise<void> {
    await getDb().productionDefects.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().productionDefects.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().productionDefects.count()
  },

  live() {
    return liveQuery(() => getDb().productionDefects.toArray())
  },
}
