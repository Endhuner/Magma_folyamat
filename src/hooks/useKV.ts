import { useCallback, useEffect, useRef, useState } from 'react'
import { kvStore } from '@/lib/kvStore'

type Setter<T> = T | ((current: T) => T)

/**
 * Reaktív, perzisztens kulcs-érték hook.
 *
 * Pótolja a korábbi `@github/spark/hooks` `useKV` hookot. Az API ugyanaz:
 *   const [value, setValue] = useKV<T>('key', defaultValue)
 *
 * Tárolás: localStorage (lásd `kvStore`).
 * Több komponens / több böngésző-tab szinkronban marad a 'kv:change'
 * és a natív 'storage' eseményre figyelve.
 */
export function useKV<T>(key: string, defaultValue: T): [T, (next: Setter<T>) => void] {
  // Szinkron olvasás localStorage-ból első renderkor.
  const [state, setState] = useState<T>(() => {
    const stored = kvStore.get<T>(key)
    return stored === undefined ? defaultValue : stored
  })

  // Stabilan tartjuk a default-ot a refen, hogy ne triggerelje újra az effecteket.
  const defaultRef = useRef(defaultValue)
  defaultRef.current = defaultValue

  // Más komponens / másik tab változtatja → szinkronban tartani.
  // Háromszintű figyelés:
  //   1. 'kv:change' CustomEvent — ugyanazon tab más komponensei.
  //   2. BroadcastChannel — másik tab payload-dal együtt (gyors út, nem kell
  //      újra olvasnunk a localStorage-t).
  //   3. natív 'storage' esemény — fallback, ha BroadcastChannel nincs.
  useEffect(() => {
    const sync = () => {
      const stored = kvStore.get<T>(key)
      setState(stored === undefined ? defaultRef.current : stored)
    }

    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<{ key: string }>
      if (ce.detail?.key === key) sync()
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === `kv:${key}`) sync()
    }

    const unsubscribe = kvStore.subscribe((msg) => {
      if (msg.key !== key) return
      if (msg.type === 'delete') {
        setState(defaultRef.current)
        return
      }
      // 'set' — ha van payload, használjuk azt (gyors út), különben olvasunk.
      if ('value' in msg && msg.value !== undefined) {
        setState(msg.value as T)
      } else {
        sync()
      }
    })

    window.addEventListener('kv:change', onCustom as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      unsubscribe()
      window.removeEventListener('kv:change', onCustom as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [key])

  const set = useCallback(
    (next: Setter<T>) => {
      setState((current) => {
        const value =
          typeof next === 'function' ? (next as (c: T) => T)(current) : next
        kvStore.set(key, value)
        return value
      })
    },
    [key]
  )

  return [state, set]
}
