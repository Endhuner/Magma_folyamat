import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type { Product } from '@/lib/types'

/**
 * ProductsRepo — Termékek adathozzáférési réteg.
 *
 * Mit indexelünk: `customer`, `drawingNumber`, `productName` és
 * `[customer+drawingNumber]` (összetett — pontos termék-azonosításhoz).
 */
export const productsRepo = {
  tableName: 'products' as const,

  async list(): Promise<Product[]> {
    return getDb().products.toArray()
  },

  async getById(id: string): Promise<Product | undefined> {
    return getDb().products.get(id)
  },

  async byCustomer(customer: string): Promise<Product[]> {
    return getDb().products.where('customer').equals(customer).toArray()
  },

  /**
   * Pontos termék-keresés vevő + rajzszám alapján — összetett index.
   * Ez a leggyakoribb keresési minta a rendelés→termék párosításnál.
   */
  async byCustomerAndDrawing(
    customer: string,
    drawingNumber: string
  ): Promise<Product | undefined> {
    return getDb()
      .products.where('[customer+drawingNumber]')
      .equals([customer, drawingNumber])
      .first()
  },

  async byDrawingNumber(drawingNumber: string): Promise<Product[]> {
    return getDb().products.where('drawingNumber').equals(drawingNumber).toArray()
  },

  async save(product: Product): Promise<string> {
    return getDb().products.put(product)
  },

  async saveMany(products: Product[]): Promise<void> {
    await getDb().products.bulkPut(products)
  },

  async delete(id: string): Promise<void> {
    await getDb().products.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().products.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().products.count()
  },

  live() {
    return liveQuery(() => getDb().products.toArray())
  },
}
