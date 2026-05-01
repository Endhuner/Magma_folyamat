/**
 * useEntity — Egy konkrét rekord (id alapján) reaktív lekérdezése Dexie-ből.
 *
 * Az adott id-jű rekordra subscribálunk a Dexie liveQuery-vel:
 *  - mindig a friss érték jelenik meg, akár másik tab változtatja.
 *  - undefined-et ad, ha nincs (vagy törölve lett) — a komponens ezt
 *    jellemzően "Nem található" állapotnak rendereli.
 *
 * A hook mutációt NEM tartalmaz — közvetlenül a repo `save()` / `delete()`
 * metódusait használja a hívó.
 */
import { useEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'

interface RepoLike<T> {
  getById(id: string): Promise<T | undefined>
}

export interface EntityMeta {
  loading: boolean
  error: Error | null
}

/**
 * @example
 *   const [order, meta] = useEntity(ordersRepo, currentOrderId)
 *   if (meta.loading) return <Spinner />
 *   if (!order) return <NotFound />
 *   return <OrderDetails order={order} />
 */
export function useEntity<T>(
  repo: RepoLike<T>,
  id: string | undefined | null
): [T | undefined, EntityMeta] {
  const [item, setItem] = useState<T | undefined>(undefined)
  const [meta, setMeta] = useState<EntityMeta>({ loading: true, error: null })

  const repoRef = useRef(repo)
  repoRef.current = repo

  useEffect(() => {
    if (!id) {
      setItem(undefined)
      setMeta({ loading: false, error: null })
      return
    }

    let cancelled = false
    const observable = liveQuery(() => repoRef.current.getById(id))
    const sub = observable.subscribe({
      next: (value) => {
        if (cancelled) return
        setItem(value)
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
  }, [id])

  return [item, meta]
}
