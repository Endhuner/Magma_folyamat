/**
 * useCustomerSequences()
 *
 * Szerver-alapú vevői sorszám hook.
 * Helyettesíti a useKV('customerSequences', {}) hívást az App.tsx-ben.
 *
 * API:
 *   GET /api/v1/customer-sequences       → Record<string, number>
 *   PUT /api/v1/customer-sequences/:id   ← { sequence: number }
 *
 * Visszatér:
 *   [sequences, setSequences]
 *   - sequences: Record<string, number> — vevőnév → sorszám
 *   - setSequences: funkcionális updater, mint a régi useKV setter
 *     Ha az új érték különbözik a régitől, szinkronizál a szerverrel.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = '/api/v1'

type SequenceMap = Record<string, number>

export function useCustomerSequences(): [SequenceMap, (updater: SequenceMap | ((prev: SequenceMap) => SequenceMap)) => void] {
  const [sequences, setSequencesLocal] = useState<SequenceMap>({})
  const loadedRef = useRef(false)

  // Betöltés a szerverről
  useEffect(() => {
    fetch(`${API_BASE}/customer-sequences`)
      .then((r) => (r.ok ? r.json() as Promise<SequenceMap> : Promise.resolve({})))
      .then((data) => {
        setSequencesLocal(data ?? {})
        loadedRef.current = true
      })
      .catch(() => {
        loadedRef.current = true
      })
  }, [])

  const setSequences = useCallback(
    (updater: SequenceMap | ((prev: SequenceMap) => SequenceMap)) => {
      setSequencesLocal((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater

        // Diff: csak a megváltozott kulcsokat szinkronizáljuk a szerverrel
        const changedKeys = Object.keys(next).filter((k) => next[k] !== prev[k])
        for (const key of changedKeys) {
          fetch(`${API_BASE}/customer-sequences/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sequence: next[key] }),
          }).catch((err) => {
            console.error('[useCustomerSequences] szinkronizálás sikertelen:', key, err)
          })
        }

        return next
      })
    },
    []
  )

  return [sequences, setSequences]
}
