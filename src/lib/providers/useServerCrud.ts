/**
 * useServerCrud — szerver-oldali CRUD hook.
 *
 * A useCrudKV (localStorage-alapú) szerver-szinkronizált megfelelője.
 * Adatokat a backend API-ról tölt, SSE-n keresztül valós időben frissül,
 * és mutációk esetén optimista frissítést alkalmaz (azonnal látszik az UI-ban,
 * majd a szerver visszaigazolja).
 *
 * Így több felhasználó (admin + operátor) azonnal látja egymás adatait.
 *
 * @param resource     - API resource neve (pl. 'shifts', 'inventory-items')
 * @param sseEventTypes - SSE event típusok, amelyek esetén újratölt (pl. ['shift'])
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import type { CrudApi } from './createCrudHook'
import { subscribeSSE } from './sseClient'
import { enqueue } from '@/lib/offlineQueue'

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message.includes('NetworkError'))) return true
  if (!navigator.onLine) return true
  return false
}

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) || ''

function apiUrl(resource: string, id?: string) {
  return `${API_BASE}/api/v1/${resource}${id ? `/${encodeURIComponent(id)}` : ''}`
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  const res = await fetch(url, { credentials: 'include', ...init })
  if (res.status === 204) return undefined
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }
  return body as T
}

export interface ServerCrudApi<T extends { id: string }> extends CrudApi<T> {
  loading: boolean
  error: Error | null
  reload: () => Promise<void>
}

export function useServerCrud<T extends { id: string }>(
  resource: string,
  sseEventTypes: string[]
): ServerCrudApi<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Függőben lévő (optimista) add-ek id-halmaza.
  // Ha egy SSE-triggerelt reload érkezik amíg egy POST még úton van,
  // a szerver-lista nem tartalmazza az in-flight elemet → az UI-ból eltűnne.
  // Ezt az id-szettel védjük: a reload megtartja a pending elemeket.
  const pendingIds = useRef<Set<string>>(new Set())

  // Folyamatban lévő írások számlálója (POST/PUT/PATCH/DELETE).
  // Ha > 0, az SSE-triggered reload vár, hogy ne írja felül az optimista UI-t.
  const inFlightCount = useRef(0)

  // Stable string for dep array
  const sseKey = sseEventTypes.join(',')

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<T[]>(apiUrl(resource))
      const pendingSnapshot = new Set(pendingIds.current)
      setItems(cur => {
        const serverMap = new Map((data ?? []).map(i => [i.id, i]))
        const pending = cur.filter(
          i => (pendingSnapshot.has(i.id) || pendingIds.current.has(i.id)) && !serverMap.has(i.id)
        )
          return [...(data ?? []), ...pending]
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource])

  // Kezdeti betöltés
  useEffect(() => {
    reload()
  }, [reload])

  // SSE feliratkozás — egyetlen megosztott kapcsolaton keresztül (sseClient singleton)
  // Ez megakadályozza, hogy a 9 hook 9 külön EventSource-t nyisson, ami
  // meghaladná a böngésző HTTP/1.1 per-host 6 kapcsolatos limitjét.
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  useEffect(() => {
    const types = sseKey.split(',').filter(Boolean)
    const handler = () => {
      // Ha van folyamatban lévő írás, ne töltsük újra — az optimista UI helyes
      if (inFlightCount.current > 0) return
      reloadRef.current()
    }
    const unsubscribe = subscribeSSE(types, handler)
    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseKey])

  const idMap = useMemo(() => {
    const m = new Map<string, T>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const byId = useCallback((id: string) => idMap.get(id), [idMap])

  const add = useCallback((item: T) => {
    pendingIds.current.add(item.id)
    inFlightCount.current++
    setItems(cur => {
      if (cur.some(i => i.id === item.id)) return cur
      return [...cur, item]
    })
    apiFetch<T>(apiUrl(resource), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).then(created => {
      pendingIds.current.delete(item.id)
      inFlightCount.current--
      if (created) {
        setItems(cur => {
          const exists = cur.some(it => it.id === item.id)
          if (exists) return cur.map(it => it.id === item.id ? created : it)
          return [...cur, created]
        })
      }
    }).catch((err: Error) => {
      pendingIds.current.delete(item.id)
      inFlightCount.current--
      if (isNetworkError(err)) {
        enqueue({ resource, entityId: item.id, method: 'POST', body: JSON.stringify(item) })
          .catch(e => console.error('[OfflineQueue] enqueue hiba:', e))
        toast.warning(`Offline — a rögzítés szinkronizálásra vár (${resource})`, { duration: 6000 })
      } else {
        console.error(`[API] POST /${resource} SIKERTELEN:`, err, '\nKüldött adat:', item)
        setItems(cur => cur.filter(it => it.id !== item.id))
        const msg = err?.message ?? 'Ismeretlen hiba'
        toast.error(`Mentés sikertelen (${resource}): ${msg}`, { duration: 8000 })
      }
    })
  }, [resource])

  const addMany = useCallback((incoming: T[]) => {
    if (incoming.length === 0) return
    // Ugyanaz a védelem, mint az egyesével add()-nál: pendingIds őrzi az
    // optimista sorokat egy SSE-reload alatt, az inFlightCount pedig
    // elhalasztja a reload-ot, amíg a batch úton van.
    for (const item of incoming) pendingIds.current.add(item.id)
    inFlightCount.current++
    setItems(cur => [...cur, ...incoming])
    Promise.all(
      incoming.map(item =>
        apiFetch<T>(apiUrl(resource), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
          .then(() => {
            pendingIds.current.delete(item.id)
            return { item, err: null as Error | null }
          })
          .catch((err: Error) => {
            pendingIds.current.delete(item.id)
            return { item, err }
          })
      )
    ).then(async results => {
      inFlightCount.current--
      const netFails = results.filter(r => r.err && isNetworkError(r.err))
      const hardFails = results.filter(r => r.err && !isNetworkError(r.err))

      // Hálózati hiba → offline sorba (mint az add()-nál) — a sor visszajátssza
      for (const f of netFails) {
        await enqueue({ resource, entityId: f.item.id, method: 'POST', body: JSON.stringify(f.item) })
          .catch(e => console.error('[OfflineQueue] enqueue hiba:', e))
      }
      if (netFails.length > 0) {
        toast.warning(`Offline — ${netFails.length} tétel szinkronizálásra vár (${resource})`, { duration: 6000 })
      }

      // Szerver által elutasított tételek → kivesszük az UI-ból és jelezzük,
      // hogy ne maradjon fantom-sor, ami újratöltéskor csendben eltűnne.
      if (hardFails.length > 0) {
        const failedIds = new Set(hardFails.map(f => f.item.id))
        setItems(cur => cur.filter(it => !failedIds.has(it.id)))
        for (const f of hardFails) {
          console.error(`[API] POST /${resource} SIKERTELEN:`, f.err, '\nKüldött adat:', f.item)
        }
        toast.error(`${hardFails.length}/${incoming.length} tétel mentése sikertelen (${resource})`, { duration: 8000 })
      }
    })
  }, [resource])

  const update = useCallback((id: string, patch: Partial<T>) => {
    // Ha az elem POST-ban van (még nincs szerveren), a PATCH 404-et adna vissza
    // → reload → az optimista elem eltűnne. Kihagyjuk; a POST után az elem
    // a szerver-verziójával szinkronizálódik.
    if (pendingIds.current.has(id)) return
    inFlightCount.current++
    setItems(cur => cur.map(it => it.id === id ? { ...it, ...patch } : it))
    const patchBody = JSON.stringify(patch)
    apiFetch<T>(apiUrl(resource, id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: patchBody,
    }).then(() => { inFlightCount.current-- })
      .catch((err: unknown) => {
        inFlightCount.current--
        if (isNetworkError(err)) {
          enqueue({ resource, entityId: id, method: 'PATCH', body: patchBody })
            .catch(e => console.error('[OfflineQueue] enqueue hiba:', e))
        } else {
          reloadRef.current()
        }
      })
  }, [resource])

  const replace = useCallback((item: T) => {
    // Ugyanaz a védekezés mint update-nél: ha a POST még úton van, ne PUT-oljunk.
    if (pendingIds.current.has(item.id)) return
    inFlightCount.current++
    setItems(cur => cur.map(it => it.id === item.id ? item : it))
    apiFetch<T>(apiUrl(resource, item.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).then(() => { inFlightCount.current-- })
      .catch((err: unknown) => {
        inFlightCount.current--
        reloadRef.current()
        const msg = (err instanceof Error) ? err.message : 'Ismeretlen hiba'
        toast.error(`Mentés sikertelen (${resource}): ${msg}`, { duration: 8000 })
      })
  }, [resource])

  const remove = useCallback((id: string) => {
    inFlightCount.current++
    setItems(cur => cur.filter(it => it.id !== id))
    apiFetch<void>(apiUrl(resource, id), { method: 'DELETE' })
      .then(() => { inFlightCount.current-- })
      .catch((err: unknown) => {
        inFlightCount.current--
        if (isNetworkError(err)) {
          enqueue({ resource, entityId: id, method: 'DELETE' })
            .catch(e => console.error('[OfflineQueue] enqueue hiba:', e))
        } else {
          reloadRef.current()
        }
      })
  }, [resource])

  const removeMany = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const set = new Set(ids)
    setItems(cur => cur.filter(it => !set.has(it.id)))
    Promise.all(ids.map(id => apiFetch<void>(apiUrl(resource, id), { method: 'DELETE' })))
      .catch(() => reloadRef.current())
  }, [resource])

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
    loading,
    error,
    reload,
  }
}
