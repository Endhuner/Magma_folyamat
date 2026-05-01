/**
 * useLiveQuery — egyedi, paraméteres Dexie liveQuery hook.
 *
 * Akkor használjuk, amikor a `useEntityList`/`useEntity` nem elég (pl.
 * szűrt listák: `ordersRepo.byCustomer(customer)`, vagy join-szerű
 * összeállítások egy callbackben).
 *
 * A `deps` tömb hasonló a `useEffect` deps-hez: ha bármelyik elem változik,
 * újraépítjük az Observable-t. A querier referencia-stabilitása NEM kell —
 * a deps elegendő.
 *
 * @example
 *   const [orders, meta] = useLiveQuery(
 *     () => ordersRepo.byCustomer(customer),
 *     [customer]
 *   )
 */
import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'

export interface LiveQueryMeta {
  loading: boolean
  error: Error | null
}

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: ReadonlyArray<unknown> = []
): [T | undefined, LiveQueryMeta] {
  const [value, setValue] = useState<T | undefined>(undefined)
  const [meta, setMeta] = useState<LiveQueryMeta>({ loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setMeta({ loading: true, error: null })
    const obs = liveQuery(querier)
    const sub = obs.subscribe({
      next: (v) => {
        if (cancelled) return
        setValue(v)
        setMeta({ loading: false, error: null })
      },
      error: (err) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        setMeta({ loading: false, error })
      },
    })
    return () => {
      cancelled = true
      sub.unsubscribe()
    }
    // A `querier` minden render új closure — szándékosan kihagyjuk a deps-ből,
    // és a hívó által átadott `deps` írja le a tényleges függőségeket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return [value, meta]
}
