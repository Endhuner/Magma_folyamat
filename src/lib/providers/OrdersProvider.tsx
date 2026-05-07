/**
 * OrdersProvider — a rendelés-domain context-je.
 *
 * Mit ad:
 *  - useOrders()  — teljes CRUD API (useCrudKV alapján) + computed értékek
 *  - useCustomerSequences()  — vevőnként a soron következő ownOrderNumber sorszám
 *
 * Miért külön kontext:
 *  - 22 useKV hívás volt App.tsx-ben, ezt 10 domain-providerre szedjük szét
 *  - a Order-domain az orders + customerSequences (a sorszám-számláló is a
 *    rendelésekhez tartozik logikailag, ld. ownOrderNumber generálás)
 *  - a perzisztencia + cross-tab sync továbbra is a useKV felelőssége,
 *    ez csak typed React Context-ot ad köré
 *
 * Megj.: az audit-log írást NEM ez kezeli — minden komponens, ami módosít,
 * a useAuditLog().log(...) hívást maga kell végezzen. (Ez tudatos: a
 * domain-provider tisztán adat-kezelő, nincsenek side-effectjei a saját
 * scope-ján kívül.)
 */
import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react'
import type { Order, OrderStatus } from '@/lib/types'
import { useCustomerSequences } from '@/hooks/useCustomerSequences'
import { useCrudKV, type CrudApi } from './createCrudHook'

type CustomerSequenceMap = Record<string, number>

export interface OrdersContextValue extends CrudApi<Order> {
  /** Aktív rendelések (nem 'Kiszállítva' státusszal). */
  activeOrders: Order[]
  /** Státusz szerint csoportosítva — gyors metric-ekhez. */
  ordersByStatus: Record<string, Order[]>
  /** Vevőnként a következő sorszám. Map-szerűen kezeljük (pure object). */
  customerSequences: CustomerSequenceMap
  /** Setter — useKV-szerű (érték vagy függvény). */
  setCustomerSequences: (
    next: CustomerSequenceMap | ((current: CustomerSequenceMap) => CustomerSequenceMap)
  ) => void
  /**
   * Egy adott vevőhöz a következő sorszámot adja (NEM increment-eli!).
   * Az incrementer a hívó dolga, mert a "consume" mintát csak sikeres
   * ownOrderNumber-mentés után akarjuk lefuttatni.
   */
  peekNextSequence: (customerId: string) => number
  /**
   * Atomic increment + visszaadja a most kiosztott számot.
   * Sikeres rendelés-mentésnél ez a "vesd elő és léptesd" lépés.
   */
  consumeNextSequence: (customerId: string) => number
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }): ReactElement {
  const crud = useCrudKV<Order>('orders', [])
  const [customerSequences, setCustomerSequences] = useCustomerSequences()

  const activeOrders = useMemo(
    () => crud.items.filter((o) => o.status !== 'Kiszállítva'),
    [crud.items]
  )

  const ordersByStatus = useMemo(() => {
    const map: Record<string, Order[]> = {}
    for (const o of crud.items) {
      const key = o.status as OrderStatus
      if (!map[key]) map[key] = []
      map[key].push(o)
    }
    return map
  }, [crud.items])

  const peekNextSequence = (customerId: string): number => {
    return (customerSequences[customerId] ?? 0) + 1
  }

  const consumeNextSequence = (customerId: string): number => {
    const next = (customerSequences[customerId] ?? 0) + 1
    setCustomerSequences((cur) => ({ ...cur, [customerId]: next }))
    return next
  }

  const value = useMemo<OrdersContextValue>(
    () => ({
      ...crud,
      activeOrders,
      ordersByStatus,
      customerSequences,
      setCustomerSequences,
      peekNextSequence,
      consumeNextSequence,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crud, activeOrders, ordersByStatus, customerSequences]
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext)
  if (!ctx) {
    throw new Error('useOrders() csak <OrdersProvider> alatt használható')
  }
  return ctx
}
