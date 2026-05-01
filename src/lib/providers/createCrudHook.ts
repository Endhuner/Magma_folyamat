/**
 * Egyszerű CRUD-hook factory a useKV fölé.
 *
 * Cél: ne másoljuk a list / add / update / remove / setAll mintát 10
 * provider-ben — egyszer megírjuk, mindegyik domain ugyanazt használja.
 *
 * A perzisztencia és cross-tab sync továbbra is a useKV felelőssége
 * (localStorage + BroadcastChannel).
 *
 * Megjegyzés: ez nem tartalmaz audit-log írást — az a hívó dolga, mert
 * a context nélküli, side-effect-tiszta variánst akarjuk itt. (Az
 * audit-logot az AuditLogProvider biztosítja külön.)
 */
import { useCallback, useMemo } from 'react'
import { useKV } from '@/hooks/useKV'

export interface CrudApi<T extends { id: string }> {
  /** Az aktuális teljes lista. */
  items: T[]
  /** Egy item id alapján — gyors lookup, internálisan Map-ből. */
  byId: (id: string) => T | undefined
  /** Új item hozzáfűzése. Visszaadja a frissített tömböt. */
  add: (item: T) => void
  /** Több item hozzáfűzése egyetlen renderben (bulk import). */
  addMany: (items: T[]) => void
  /** Update by id (partial). Csak a megadott mezőket írja át. */
  update: (id: string, patch: Partial<T>) => void
  /** Csere: a teljes új objektum lép a régi helyére (id egyezik). */
  replace: (item: T) => void
  /** Törlés id alapján. */
  remove: (id: string) => void
  /** Több törlés egyszerre — egyetlen render. */
  removeMany: (ids: string[]) => void
  /** Direkt setter — ha a hívónak ad-hoc transzformáció kell. */
  setAll: (next: T[] | ((current: T[]) => T[])) => void
}

export function useCrudKV<T extends { id: string }>(
  storageKey: string,
  defaultValue: T[] = []
): CrudApi<T> {
  const [items, setItems] = useKV<T[]>(storageKey, defaultValue)

  // Map-ből gyors lookup. Csak a `items` változására szükséges újraépíteni.
  const idMap = useMemo(() => {
    const m = new Map<string, T>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const byId = useCallback((id: string) => idMap.get(id), [idMap])

  const add = useCallback(
    (item: T) => {
      setItems((cur) => [...cur, item])
    },
    [setItems]
  )

  const addMany = useCallback(
    (incoming: T[]) => {
      if (incoming.length === 0) return
      setItems((cur) => [...cur, ...incoming])
    },
    [setItems]
  )

  const update = useCallback(
    (id: string, patch: Partial<T>) => {
      setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    },
    [setItems]
  )

  const replace = useCallback(
    (item: T) => {
      setItems((cur) => cur.map((it) => (it.id === item.id ? item : it)))
    },
    [setItems]
  )

  const remove = useCallback(
    (id: string) => {
      setItems((cur) => cur.filter((it) => it.id !== id))
    },
    [setItems]
  )

  const removeMany = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const set = new Set(ids)
      setItems((cur) => cur.filter((it) => !set.has(it.id)))
    },
    [setItems]
  )

  return {
    items,
    byId,
    add,
    addMany,
    update,
    replace,
    remove,
    removeMany,
    setAll: setItems,
  }
}
