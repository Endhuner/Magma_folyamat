/**
 * DeliveryNotesRepo — Szállítólevelek / CMR adathozzáférési réteg.
 *
 * Indexek: `type`, `sequenceNumber`, `customer`, `exportDate`,
 * `*orderIds` (multi-entry — az `orderIds` tömb minden eleme indexelt,
 * így O(log n) keresés "ezt a rendelést mely szállítólevelek tartalmazzák").
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { DeliveryNote } from '@/lib/types'

export const deliveryNotesRepo = {
  tableName: 'deliveryNotes' as const,

  async list(): Promise<DeliveryNote[]> {
    return getDb().deliveryNotes.toArray()
  },

  async getById(id: string): Promise<DeliveryNote | undefined> {
    return getDb().deliveryNotes.get(id)
  },

  /** Adott típus (delivery / cmr) összes bizonylata. */
  async byType(type: DeliveryNote['type']): Promise<DeliveryNote[]> {
    return getDb().deliveryNotes.where('type').equals(type).toArray()
  },

  /** Sorszám alapján — egyedi keresés. */
  async bySequenceNumber(seq: string): Promise<DeliveryNote | undefined> {
    return getDb().deliveryNotes.where('sequenceNumber').equals(seq).first()
  },

  /** Egy vevő összes szállítólevele. */
  async byCustomer(customer: string): Promise<DeliveryNote[]> {
    return getDb().deliveryNotes.where('customer').equals(customer).toArray()
  },

  /**
   * Egy rendelést tartalmazó szállítólevelek — multi-entry index alapján.
   * Ez a `*orderIds` index ereje: a Dexie a tömb minden elemét külön
   * sorként indexeli, ezért O(log n)-ben adja vissza a hivatkozó leveleket.
   */
  async byOrderId(orderId: string): Promise<DeliveryNote[]> {
    return getDb().deliveryNotes.where('orderIds').equals(orderId).toArray()
  },

  async save(note: DeliveryNote): Promise<string> {
    return getDb().deliveryNotes.put(note)
  },

  async saveMany(notes: DeliveryNote[]): Promise<void> {
    await getDb().deliveryNotes.bulkPut(notes)
  },

  async delete(id: string): Promise<void> {
    await getDb().deliveryNotes.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().deliveryNotes.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().deliveryNotes.count()
  },

  live() {
    return liveQuery(() => getDb().deliveryNotes.toArray())
  },
}
