/**
 * ProductsProvider — termék-domain context.
 *
 * Vékony wrapper a useCrudKV<Product> köré + vevő-szerinti csoportosítás
 * (sokat használjuk: vevő → termékei).
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { Product } from '@/lib/types'
import { useCrudKV, type CrudApi } from './createCrudHook'

export interface ProductsContextValue extends CrudApi<Product> {
  /** Vevő (név) → termékek lista. Nem létező kulcsra üres tömb. */
  byCustomer: (customer: string) => Product[]
  /** Rajzszám alapján gyors lookup — egyedi azonosító a megrendelőkkel közösen. */
  byDrawingNumber: (drawingNumber: string) => Product | undefined
}

const ProductsContext = createContext<ProductsContextValue | null>(null)

export function ProductsProvider({ children }: { children: ReactNode }): ReactElement {
  const crud = useCrudKV<Product>('products', [])

  const customerIndex = useMemo(() => {
    const m = new Map<string, Product[]>()
    for (const p of crud.items) {
      const key = (p.customer || '').toLowerCase()
      const list = m.get(key) ?? []
      list.push(p)
      m.set(key, list)
    }
    return m
  }, [crud.items])

  const drawingIndex = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of crud.items) {
      if (p.drawingNumber) m.set(p.drawingNumber.toLowerCase(), p)
    }
    return m
  }, [crud.items])

  const byCustomer = (customer: string): Product[] =>
    customerIndex.get((customer || '').toLowerCase()) ?? []

  const byDrawingNumber = (drawingNumber: string): Product | undefined =>
    drawingIndex.get((drawingNumber || '').toLowerCase())

  const value = useMemo<ProductsContextValue>(
    () => ({ ...crud, byCustomer, byDrawingNumber }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crud, customerIndex, drawingIndex]
  )

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts() csak <ProductsProvider> alatt használható')
  return ctx
}
