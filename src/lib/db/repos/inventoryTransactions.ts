/**
 * InventoryTransactionsRepo — Készletmozgás-naplók adathozzáférési réteg.
 *
 * Általában csak olvasott (riportokhoz, audit-hoz). Új sorokat az
 * `inventoryRepo.deductTx()` / `addTx()` ír — mert a készletmódosítást és
 * a tranzakciót egy atomi műveletben kell rögzíteni. Manuális insertet itt
 * is engedélyezünk (pl. import).
 *
 * Indexek a schema.ts szerint: `inventoryItemId`, `type`, `orderId`, `createdAt`.
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { InventoryTransaction } from '@/lib/types'

export const inventoryTransactionsRepo = {
  tableName: 'inventoryTransactions' as const,

  async list(): Promise<InventoryTransaction[]> {
    return getDb().inventoryTransactions.toArray()
  },

  async getById(id: string): Promise<InventoryTransaction | undefined> {
    return getDb().inventoryTransactions.get(id)
  },

  /** Egy adott készlettétel összes mozgása — időrendben kell, ezért createdAt szerint rendezünk. */
  async byInventoryItem(inventoryItemId: string): Promise<InventoryTransaction[]> {
    const list = await getDb()
      .inventoryTransactions.where('inventoryItemId')
      .equals(inventoryItemId)
      .toArray()
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  /** Egy adott rendeléshez tartozó tranzakciók — pl. visszavonás esetén szükséges. */
  async byOrder(orderId: string): Promise<InventoryTransaction[]> {
    return getDb()
      .inventoryTransactions.where('orderId')
      .equals(orderId)
      .toArray()
  },

  /** Egy típus (in/out/adjustment) összes mozgása. */
  async byType(type: InventoryTransaction['type']): Promise<InventoryTransaction[]> {
    return getDb().inventoryTransactions.where('type').equals(type).toArray()
  },

  async save(tx: InventoryTransaction): Promise<string> {
    return getDb().inventoryTransactions.put(tx)
  },

  async saveMany(txs: InventoryTransaction[]): Promise<void> {
    await getDb().inventoryTransactions.bulkPut(txs)
  },

  async delete(id: string): Promise<void> {
    await getDb().inventoryTransactions.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().inventoryTransactions.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().inventoryTransactions.count()
  },

  live() {
    return liveQuery(() => getDb().inventoryTransactions.toArray())
  },
}
