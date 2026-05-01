/**
 * useEntityList — Dexie liveQuery alapú reaktív lista hook.
 *
 * Egy IndexedDB tábla aktuális tartalmát adja vissza, és minden
 * adatváltozásra (legyen az ugyanezen tab-ból, másik tab-ból vagy egy
 * tranzakcióból) automatikusan újraértékelődik.
 *
 * API a `useKV`-hez igazítva: tuple-t ad vissza,
 *   const [orders, { loading, error }] = useEntityList(ordersRepo)
 *
 * Mutáció NEM ezen a hookon keresztül történik — a komponensek
 * közvetlenül hívják a repo `save() / delete() / saveMany()` metódusait.
 * Ezzel elkerüljük a useKV-nél problémás "egész tömböt újraírunk" mintát.
 */
import { useEffect, useRef, useState } from 'react'

type LiveSource<T> = {
  /** A repo `live()` metódusa — Dexie Observable-t ad vissza. */
  live: () => {
    subscribe(observer: {
      next?: (value: T[]) => void
      error?: (err: unknown) => void
      complete?: () => void
    }): { unsubscribe(): void }
  }
}

export interface EntityListMeta {
  /** Igaz, amíg az első érték még nem érkezett meg. */
  loading: boolean
  /** Esetleges hiba, ha az alapquery elhasalt. */
  error: Error | null
}

/**
 * @example
 *   const [orders, meta] = useEntityList(ordersRepo)
 *   if (meta.loading) return <Spinner />
 *   if (meta.error) return <ErrorBanner err={meta.error} />
 *   return <OrdersTable rows={orders} />
 */
export function useEntityList<T>(source: LiveSource<T>): [T[], EntityListMeta] {
  const [items, setItems] = useState<T[]>([])
  const [meta, setMeta] = useState<EntityListMeta>({ loading: true, error: null })

  // A `source.live()` minden hívásakor új Observable-t ad — ezért a
  // refet használjuk, hogy strict-mode unmount/remount alatt se kreáljunk
  // dupla subscribe-ot.
  const sourceRef = useRef(source)
  sourceRef.current = source

  useEffect(() => {
    let cancelled = false
    const sub = sourceRef.current.live().subscribe({
      next: (value) => {
        if (cancelled) return
        setItems(value)
        setMeta((prev) => (prev.loading || prev.error ? { loading: false, error: null } : prev))
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
    // A source minden komponens-példányra állandó (egy-egy modul-szintű repo),
    // így az effect csak mount/unmount lefutására kell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [items, meta]
}
