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
import type { CrudApi } from './createCrudHook'
import { subscribeSSE } from './sseClient'

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

  // Stable string for dep array
  const sseKey = sseEventTypes.join(',')

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<T[]>(apiUrl(resource))
      setItems(cur => {
        // Szerver-lista alapja
        const serverMap = new Map((data ?? []).map(i => [i.id, i]))
        // Megőrizzük a pending (in-flight POST) elemeket, ha a szerver még
        // nem adja vissza őket — így nem tűnnek el az UI-ból.
        const pending = cur.filter(i => pendingIds.current.has(i.id) && !serverMap.has(i.id))
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
    const handler = () => { reloadRef.current() }
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
    // Megjelöljük pending-ként MIELŐTT az optimista add megtörténik,
    // hogy egy esetleges azonnali SSE-reload ne dobja el.
    pendingIds.current.add(item.id)
    setItems(cur => {
      // Ha már benne van (pl. dupla hívás), ne adjuk hozzá mégegyszer
      if (cur.some(i => i.id === item.id)) return cur
      return [...cur, item]
    })
    apiFetch<T>(apiUrl(resource), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).then(created => {
      pendingIds.current.delete(item.id)
      if (created) {
        setItems(cur => {
          const exists = cur.some(it => it.id === item.id)
          if (exists) return cur.map(it => it.id === item.id ? created : it)
          // Ha egy közbülső reload eltávolította (pending guard ellenére),
          // adjuk vissza a szerver által visszaigazolt verzióval.
          return [...cur, created]
        })
      }
    }).catch((err) => {
      pendingIds.current.delete(item.id)
      console.error(`[API] POST /${resource} sikertelen:`, err, '\nKüldött adat:', item)
      setItems(cur => cur.filter(it => it.id !== item.id))
    })
  }, [resource])

  const addMany = useCallback((incoming: T[]) => {
    if (incoming.length === 0) return
    setItems(cur => [...cur, ...incoming])
    Promise.all(
      incoming.map(item =>
        apiFetch<T>(apiUrl(resource), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        }).catch((err) => {
          console.error(`[API] POST /${resource} sikertelen:`, err, '\nKüldött adat:', item)
          return null
        })
      )
    ).then(results => {
      const failed = results.filter(r => r === null).length
      if (failed > 0) {
        console.error(`[API] addMany /${resource}: ${failed}/${incoming.length} tétel sikertelen — újratöltés`)
        reloadRef.current()
      }
    })
  }, [resource])

  const update = useCallback((id: string, patch: Partial<T>) => {
    // Ha az elem POST-ban van (még nincs szerveren), a PATCH 404-et adna vissza
    // → reload → az optimista elem eltűnne. Kihagyjuk; a POST után az elem
    // a szerver-verziójával szinkronizálódik.
    if (pendingIds.current.has(id)) return
    setItems(cur => cur.map(it => it.id === id ? { ...it, ...patch } : it))
    apiFetch<T>(apiUrl(resource, id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => reloadRef.current())
  }, [resource])

  const replace = useCallback((item: T) => {
    // Ugyanaz a védekezés mint update-nél: ha a POST még úton van, ne PUT-oljunk.
    if (pendingIds.current.has(item.id)) return
    setItems(cur => cur.map(it => it.id === item.id ? item : it))
    apiFetch<T>(apiUrl(resource, item.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => reloadRef.current())
  }, [resource])

  const remove = useCallback((id: string) => {
    setItems(cur => cur.filter(it => it.id !== id))
    apiFetch<void>(apiUrl(resource, id), { method: 'DELETE' })
      .catch(() => reloadRef.current())
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
