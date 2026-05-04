/**
 * ProductionProvider — gyártás-domain context.
 *
 * Három entitást fog össze (külön CRUD API-val):
 *  - ProductionShift (műszak — egy nap, egy műszak, egy rendelés)
 *  - ProductionDefect (selejt — műszakhoz kötve vagy önállóan)
 *  - ProductionLog (státuszváltás-, művelet-napló az egyes rendeléseknél)
 *
 * Plusz: gyakran kérdezett indexek (rendelés-id → műszakok, rendelés-id →
 * selejtek), hogy a komponensek ne kelljenek minden render-ben filter-elni.
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react'
import type {
  ProductionDefect,
  ProductionLog,
  ProductionShift,
} from '@/lib/types'
import { type CrudApi } from './createCrudHook'
import { useServerCrud } from './useServerCrud'

export interface ProductionContextValue {
  shifts: CrudApi<ProductionShift>
  defects: CrudApi<ProductionDefect>
  logs: CrudApi<ProductionLog>

  /** Rendelés-id alapján a hozzá tartozó műszakok (időrend szerint csökkenőben). */
  shiftsByOrderId: (orderId: string) => ProductionShift[]
  /** Rendelés-id alapján a hozzá tartozó selejt-rögzítések. */
  defectsByOrderId: (orderId: string) => ProductionDefect[]
  /** Rendelés-id alapján a napló-bejegyzések (időrend szerint csökkenőben). */
  logsByOrderId: (orderId: string) => ProductionLog[]

  /**
   * Rendelés-szintű összesítések — kis cache-elt számolás minden rendelésre.
   * Nem renderkritikus listáknál praktikus (sokat olvassuk: gyártott db, selejt).
   */
  totalsByOrderId: (orderId: string) => {
    shotsCount: number
    producedQuantity: number
    defectQuantity: number
  }
}

const ProductionContext = createContext<ProductionContextValue | null>(null)

export function ProductionProvider({ children }: { children: ReactNode }): ReactElement {
  const shifts = useServerCrud<ProductionShift>('shifts', ['shift'])
  const defects = useServerCrud<ProductionDefect>('defects', ['defect'])
  const logs = useServerCrud<ProductionLog>('production-logs', ['shift'])

  const shiftsIndex = useMemo(() => {
    const m = new Map<string, ProductionShift[]>()
    for (const s of shifts.items) {
      const list = m.get(s.orderId) ?? []
      list.push(s)
      m.set(s.orderId, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => b.date.localeCompare(a.date))
    }
    return m
  }, [shifts.items])

  const defectsIndex = useMemo(() => {
    const m = new Map<string, ProductionDefect[]>()
    for (const d of defects.items) {
      const list = m.get(d.orderId) ?? []
      list.push(d)
      m.set(d.orderId, list)
    }
    return m
  }, [defects.items])

  const logsIndex = useMemo(() => {
    const m = new Map<string, ProductionLog[]>()
    for (const l of logs.items) {
      const list = m.get(l.orderId) ?? []
      list.push(l)
      m.set(l.orderId, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return m
  }, [logs.items])

  const shiftsByOrderId = (orderId: string): ProductionShift[] =>
    shiftsIndex.get(orderId) ?? []
  const defectsByOrderId = (orderId: string): ProductionDefect[] =>
    defectsIndex.get(orderId) ?? []
  const logsByOrderId = (orderId: string): ProductionLog[] =>
    logsIndex.get(orderId) ?? []

  const totalsByOrderId = (orderId: string) => {
    const orderShifts = shiftsIndex.get(orderId) ?? []
    const orderDefects = defectsIndex.get(orderId) ?? []
    return {
      shotsCount: orderShifts.reduce((sum, s) => sum + (s.shotsCount || 0), 0),
      producedQuantity: orderShifts.reduce(
        (sum, s) => sum + (s.producedQuantity || 0),
        0
      ),
      defectQuantity: orderDefects.reduce(
        (sum, d) => sum + (d.quantity || 0),
        0
      ),
    }
  }

  const value = useMemo<ProductionContextValue>(
    () => ({
      shifts,
      defects,
      logs,
      shiftsByOrderId,
      defectsByOrderId,
      logsByOrderId,
      totalsByOrderId,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shifts, defects, logs, shiftsIndex, defectsIndex, logsIndex]
  )

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>
}

export function useProduction(): ProductionContextValue {
  const ctx = useContext(ProductionContext)
  if (!ctx) throw new Error('useProduction() csak <ProductionProvider> alatt használható')
  return ctx
}
