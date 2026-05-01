/**
 * CustomersProvider — vevő-domain context.
 *
 * Vékony wrapper a useCrudKV<Customer> köré + computed értékek
 * (név-szerint rendezett lista, gyors lookup név alapján).
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { Customer } from '@/lib/types'
import { useCrudKV, type CrudApi } from './createCrudHook'

export interface CustomersContextValue extends CrudApi<Customer> {
  /** Vevők név-szerint rendezve (magyar collation, kis-nagy érzéketlen). */
  sortedByName: Customer[]
  /** Gyors lookup név alapján — több helyen is lekérjük name-ből. */
  byName: (name: string) => Customer | undefined
}

const CustomersContext = createContext<CustomersContextValue | null>(null)

export function CustomersProvider({ children }: { children: ReactNode }): ReactElement {
  const crud = useCrudKV<Customer>('customers', [])

  const sortedByName = useMemo(() => {
    return [...crud.items].sort((a, b) => a.name.localeCompare(b.name, 'hu', { sensitivity: 'base' }))
  }, [crud.items])

  const nameMap = useMemo(() => {
    const m = new Map<string, Customer>()
    for (const c of crud.items) m.set(c.name.toLowerCase(), c)
    return m
  }, [crud.items])

  const byName = (name: string): Customer | undefined => nameMap.get(name.toLowerCase())

  const value = useMemo<CustomersContextValue>(
    () => ({ ...crud, sortedByName, byName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crud, sortedByName, nameMap]
  )

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
}

export function useCustomers(): CustomersContextValue {
  const ctx = useContext(CustomersContext)
  if (!ctx) throw new Error('useCustomers() csak <CustomersProvider> alatt használható')
  return ctx
}
