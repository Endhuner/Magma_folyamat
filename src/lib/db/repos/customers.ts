import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { Customer } from '@/lib/types'

/**
 * CustomersRepo — Vevők adathozzáférési réteg.
 *
 * Egyetlen index: `name` (a vevőkereső miatt). Ha bővül a használat,
 * adj indexeket a schema.ts-ben és növeld a DB_VERSION-t.
 */
export const customersRepo = {
  tableName: 'customers' as const,

  async list(): Promise<Customer[]> {
    return getDb().customers.toArray()
  },

  async getById(id: string): Promise<Customer | undefined> {
    return getDb().customers.get(id)
  },

  async byName(name: string): Promise<Customer | undefined> {
    return getDb().customers.where('name').equals(name).first()
  },

  async save(customer: Customer): Promise<string> {
    return getDb().customers.put(customer)
  },

  async saveMany(customers: Customer[]): Promise<void> {
    await getDb().customers.bulkPut(customers)
  },

  async delete(id: string): Promise<void> {
    await getDb().customers.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().customers.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().customers.count()
  },

  live() {
    return liveQuery(() => getDb().customers.toArray())
  },
}
