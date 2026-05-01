/**
 * ShiftsRepo — Gyártási műszakok adathozzáférési réteg.
 *
 * Indexek: `orderId`, `date`, `[orderId+date+shift]` (összetett — a műszak
 * upsertet ezen a kulcson nézzük: egy nap–egy műszak–egy rendelés egyedi).
 *
 * Megjegyzés: a `[orderId+date+shift]` NEM unique index, mert a Dexie séma
 * nem tartalmaz `&` prefixet. Az alkalmazás-szintű egyediséget az
 * `upsertForOrderDateShift()` biztosítja: ha létezik már ilyen sor, frissítjük
 * a meglévő `id`-vel; ha nem, újat hozunk létre.
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { ProductionShift } from '@/lib/types'

export const shiftsRepo = {
  tableName: 'productionShifts' as const,

  async list(): Promise<ProductionShift[]> {
    return getDb().productionShifts.toArray()
  },

  async getById(id: string): Promise<ProductionShift | undefined> {
    return getDb().productionShifts.get(id)
  },

  /** Egy rendeléshez tartozó összes műszak — időrendben. */
  async byOrder(orderId: string): Promise<ProductionShift[]> {
    const list = await getDb()
      .productionShifts.where('orderId')
      .equals(orderId)
      .toArray()
    return list.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.shift.localeCompare(b.shift)
    )
  },

  /** Egy nap összes műszaka — riporthoz. */
  async byDate(date: string): Promise<ProductionShift[]> {
    return getDb().productionShifts.where('date').equals(date).toArray()
  },

  /**
   * Egyedi keresés rendelés + nap + műszak alapján — összetett index.
   * A műszakrögzítés ezt használja annak eldöntésére, hogy upsertet vagy
   * insert-et kell végezni.
   */
  async byOrderDateShift(
    orderId: string,
    date: string,
    shift: ProductionShift['shift']
  ): Promise<ProductionShift | undefined> {
    return getDb()
      .productionShifts.where('[orderId+date+shift]')
      .equals([orderId, date, shift])
      .first()
  },

  async save(shift: ProductionShift): Promise<string> {
    return getDb().productionShifts.put(shift)
  },

  async saveMany(shifts: ProductionShift[]): Promise<void> {
    await getDb().productionShifts.bulkPut(shifts)
  },

  async delete(id: string): Promise<void> {
    await getDb().productionShifts.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().productionShifts.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().productionShifts.count()
  },

  live() {
    return liveQuery(() => getDb().productionShifts.toArray())
  },
}
