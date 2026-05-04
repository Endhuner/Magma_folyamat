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

  // Stable string for dep array
  const sseKey = sseEventTypes.join(',')

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<T[]>(apiUrl(resource))
      setItems(data ?? [])
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

  // SSE feliratkozás — valós idejű frissítés más felhasználók mutációira
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/v1/events`, { withCredentials: true })
    const types = sseKey.split(',')
    const handler = () => { reloadRef.current() }
    for (const t of types) {
      if (t) es.addEventListener(t, handler)
    }
    return () => {
      for (const t of types) {
        if (t) es.removeEventListener(t, handler)
      }
      es.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseKey])

  const idMap = useMemo(() => {
    const m = new Map<string, T>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const byId = useCallback((id: string) => idMap.get(id), [idMap])

  const add = useCallback((item: T) => {
    setItems(cur => [...cur, item])
    apiFetch<T>(apiUrl(resource), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).then(created => {
      if (created) setItems(cur => cur.map(it => it.id === item.id ? created : it))
    }).catch(() => {
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
        })
      )
    ).catch(() => reloadRef.current())
  }, [resource])

  const update = useCallback((id: string, patch: Partial<T>) => {
    setItems(cur => cur.map(it => it.id === id ? { ...it, ...patch } : it))
    apiFetch<T>(apiUrl(resource, id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => reloadRef.current())
  }, [resource])

  const replace = useCallback((item: T) => {
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
