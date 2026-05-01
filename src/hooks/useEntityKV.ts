/**
 * useEntityKV — `useKV`-kompatibilis adapter IndexedDB tábla fölött.
 *
 * Cél: a meglévő komponensek minimális diff-fel migrálhatók legyenek
 * `useKV` → `useEntityKV` cserével. Az API azonos:
 *   const [orders, setOrders] = useEntityKV<Order>(ordersRepo)
 *
 * Belül viszont:
 *   - Olvasás Dexie `liveQuery`-vel — frissül, ha bármelyik tab változtat.
 *   - Írás közben diff-et számolunk a régi és új tömb között:
 *       * új vagy módosult sorok → `bulkPut`
 *       * eltűnt id-k → `bulkDelete`
 *     Egy `readwrite` tranzakcióban hajtódik végre, így atomi.
 *
 * Megjegyzés: a "tömb-egészet újraírni" minta lassabb, mint a per-record
 * mutáció (`repo.save(one)` / `repo.delete(id)`), ezért az új komponens-
 * rétegben fokozatosan érdemes inkább `useEntityList` + közvetlen repo
 * hívásokra váltani. Ez az adapter a migrációt teszi biztonságossá és
 * fokozatossá.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'
import { getDb } from '@/lib/db/database'
import type { EntityTable } from '@/lib/db/schema'

type Setter<T> = T[] | ((current: T[]) => T[])

interface RepoLike<T extends { id: string }> {
  list(): Promise<T[]>
  saveMany(items: T[]): Promise<void>
  deleteMany(ids: string[]): Promise<void>
  /**
   * A repo által birtokolt tábla neve a Dexie sémában. Az adapter ezt
   * használja a tranzakcióhoz — ha nincs megadva, esetenkénti írásokat
   * használ (kevésbé atomi, de még mindig korrekt).
   */
  tableName?: EntityTable
}

/**
 * @example
 *   const [orders, setOrders] = useEntityKV(ordersRepo)
 *   // Drop-in csere a `useKV<Order[]>('orders', [])` helyett.
 */
export function useEntityKV<T extends { id: string }>(
  repo: RepoLike<T>
): [T[], (next: Setter<T>) => void] {
  const [items, setItems] = useState<T[]>([])
  const itemsRef = useRef<T[]>([])
  itemsRef.current = items

  // liveQuery subscribe — a table teljes tartalma.
  useEffect(() => {
    const obs = liveQuery(() => repo.list())
    const sub = obs.subscribe({
      next: (value) => setItems(value),
      error: (err) => {
        console.error('[useEntityKV] liveQuery error:', err)
      },
    })
    return () => sub.unsubscribe()
    // A repo modul-szintű singleton, az effect csak mount-kor fut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = useCallback(
    (next: Setter<T>) => {
      // Lokális, optimista update — UI azonnal reagál.
      // A liveQuery utána frissíti az "igazságot" az adatbázisból.
      setItems((current) => {
        const nextValue =
          typeof next === 'function' ? (next as (c: T[]) => T[])(current) : next
        // Indítjuk a tényleges DB-írást (fire-and-forget; a hibát logoljuk).
        void applyDiff(repo, current, nextValue)
        return nextValue
      })
    },
    [repo]
  )

  return [items, set]
}

/**
 * Diff-alapú perzisztálás: az `prev` és `next` tömböt összehasonlítva
 * eldönti, mit kell `bulkPut`-tal frissíteni / `bulkDelete`-tel törölni.
 * Ha a repo megadja a `tableName`-jét, egyetlen `rw` tranzakcióban hajtódik
 * végre (atomic).
 */
async function applyDiff<T extends { id: string }>(
  repo: RepoLike<T>,
  prev: T[],
  next: T[]
): Promise<void> {
  const prevById = new Map(prev.map((it) => [it.id, it]))
  const nextById = new Map(next.map((it) => [it.id, it]))

  const toUpsert: T[] = []
  for (const item of next) {
    const before = prevById.get(item.id)
    if (!before || !shallowEqual(before, item)) {
      toUpsert.push(item)
    }
  }

  const toDelete: string[] = []
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) toDelete.push(id)
  }

  if (toUpsert.length === 0 && toDelete.length === 0) return

  try {
    if (repo.tableName) {
      const db = getDb()
      const table = db.tableByName(repo.tableName)
      await db.transaction('rw', [table], async () => {
        if (toUpsert.length) await table.bulkPut(toUpsert)
        if (toDelete.length) await table.bulkDelete(toDelete)
      })
    } else {
      // Fallback: nem-tranzakciós, de a repos saját bulk-műveletei
      // még így is gyorsabbak, mint a useKV egész-tömb-újraírás.
      if (toUpsert.length) await repo.saveMany(toUpsert)
      if (toDelete.length) await repo.deleteMany(toDelete)
    }
  } catch (err) {
    console.error('[useEntityKV] persist diff error:', err)
  }
}

/** Sekélyösszehasonlítás — kerüljük el a felesleges `bulkPut`-okat. */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    const av = a[k]
    const bv = b[k]
    if (av === bv) continue
    // Egyszintű mély-egyezés tömbökre / objektumokra.
    if (
      av && bv && typeof av === 'object' && typeof bv === 'object' &&
      JSON.stringify(av) === JSON.stringify(bv)
    ) {
      continue
    }
    return false
  }
  return true
}
