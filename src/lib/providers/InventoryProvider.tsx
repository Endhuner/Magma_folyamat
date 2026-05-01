/**
 * InventoryProvider — készlet-domain context.
 *
 * Két entitást fog össze:
 *  - InventoryItem (raktár-tételek; egy termékenként egy sor)
 *  - InventoryTransaction (mozgás-napló: be/ki/kiigazítás)
 *
 * Mindkettő külön CRUD API-t kap, plusz egy néhány gyakran használt
 * computed értéket (alacsony készlet figyelmeztetés, termék szerinti index).
 *
 * Megj.: a "deduktív" logika (rendelés → készlet csökkentés) NEM itt van —
 * az a komponensek dolga, mert tranzakcionális (mind az item-et, mind a
 * transaction-t együtt írja), és az audit-log is hozzátartozik.
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { InventoryItem, InventoryTransaction } from '@/lib/types'
import { useCrudKV, type CrudApi } from './createCrudHook'

export interface InventoryContextValue {
  /** Készlet-tételek CRUD API. */
  items: CrudApi<InventoryItem>
  /** Mozgás-napló CRUD API (általában csak add-ot használjuk). */
  transactions: CrudApi<InventoryTransaction>

  /** Termék-id alapján a hozzárendelt készlet-tétel (egyedi). */
  itemByProductId: (productId: string) => InventoryItem | undefined
  /** Adott készlet-tételhez tartozó tranzakciók (időrend szerint csökkenőben). */
  transactionsByItemId: (itemId: string) => InventoryTransaction[]
  /** Termékhez tartozó tranzakciók — több készlet-tétel is lehet ugyanahhoz a termékhez. */
  transactionsByProductId: (productId: string) => InventoryTransaction[]
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }): ReactElement {
  const items = useCrudKV<InventoryItem>('inventory', [])
  const transactions = useCrudKV<InventoryTransaction>('inventoryTransactions', [])

  const productIdIndex = useMemo(() => {
    const m = new Map<string, InventoryItem>()
    for (const it of items.items) m.set(it.productId, it)
    return m
  }, [items.items])

  const txByItem = useMemo(() => {
    const m = new Map<string, InventoryTransaction[]>()
    for (const tx of transactions.items) {
      const list = m.get(tx.inventoryItemId) ?? []
      list.push(tx)
      m.set(tx.inventoryItemId, list)
    }
    // időrend szerint csökkenőben (legutóbbi felül)
    for (const list of m.values()) {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return m
  }, [transactions.items])

  const itemByProductId = (productId: string): InventoryItem | undefined =>
    productIdIndex.get(productId)

  const transactionsByItemId = (itemId: string): InventoryTransaction[] =>
    txByItem.get(itemId) ?? []

  const transactionsByProductId = (productId: string): InventoryTransaction[] => {
    const item = productIdIndex.get(productId)
    if (!item) return []
    return txByItem.get(item.id) ?? []
  }

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      transactions,
      itemByProductId,
      transactionsByItemId,
      transactionsByProductId,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, transactions, productIdIndex, txByItem]
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory() csak <InventoryProvider> alatt használható')
  return ctx
}
