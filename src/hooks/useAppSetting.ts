/**
 * useAppSetting<T>(key, defaultValue)
 *
 * Szerver-alapú kulcs-érték beállítás hook.
 * Helyettesíti a useKV-t minden olyan esetben, ahol a beállítást
 * az összes felhasználónak közösen kell látnia (pl. cmrSettings,
 * deliveryStyles, delivery-settings).
 *
 * API:
 *   GET  /api/v1/settings/:key   → { value }
 *   PUT  /api/v1/settings/:key   ← { value }
 *
 * Visszatér: [value, setSetting, loaded]
 *   - value: T — aktuális érték (alapértelmezett amíg be nem tölt)
 *   - setSetting: (newValue: T) => Promise<void> — menti a szerverre
 *   - loaded: boolean — true ha a szerver válaszolt
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = '/api/v1'

export function useAppSetting<T>(key: string, defaultValue: T): [T, (v: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(defaultValue)
  const [loaded, setLoaded] = useState(false)
  // Megakadályozza a komponens unmount utáni setState hívást
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    fetch(`${API_BASE}/settings/${encodeURIComponent(key)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`settings fetch ${r.status}`)
        return r.json() as Promise<{ value: T }>
      })
      .then((data) => {
        if (cancelled || !mountedRef.current) return
        // Ha a szerver {}  ad vissza (üres default), maradjon a defaultValue
        const v = data.value
        const isEmpty =
          v === null ||
          v === undefined ||
          (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
        setValue(isEmpty ? defaultValue : v)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return
        // Hálózati hiba → fallback az alapértelmezett értékre
        setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setSetting = useCallback(
    async (newValue: T): Promise<void> => {
      // Optimista frissítés
      setValue(newValue)
      try {
        const r = await fetch(`${API_BASE}/settings/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: newValue }),
        })
        if (!r.ok) throw new Error(`settings save ${r.status}`)
      } catch (err) {
        console.error('[useAppSetting] mentés sikertelen:', key, err)
      }
    },
    [key]
  )

  return [value, setSetting, loaded]
}
