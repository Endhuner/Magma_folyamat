/**
 * useOfflineSync — offline sor figyelése és szinkronizálása.
 *
 * Amikor az app online lesz, automatikusan lejátssza a függő műveleteket,
 * majd meghívja az érintett resource-ok reload callbackjét.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useOnlineStatus } from './useOnlineStatus'
import { getPendingCount, flushQueue } from '@/lib/offlineQueue'

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) || ''

async function apiFetch(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_BASE}${url}`, { credentials: 'include', ...init })
  if (res.status === 204) return undefined
  return res.json().catch(() => ({}))
}

export function useOfflineSync(onSynced?: () => void) {
  const { isOnline } = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const prevOnline = useRef(isOnline)

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 5_000)
    return () => clearInterval(interval)
  }, [refreshCount])

  useEffect(() => {
    const wasOffline = !prevOnline.current
    prevOnline.current = isOnline

    if (isOnline && wasOffline) {
      ;(async () => {
        const count = await getPendingCount()
        if (count === 0) return

        setIsSyncing(true)
        try {
          const { played, remaining } = await flushQueue(apiFetch)
          setPendingCount(remaining)
          if (played > 0) {
            toast.success(`Szinkronizálás kész — ${played} művelet elküldve`)
            onSynced?.()
          }
          if (remaining > 0) {
            toast.error(`${remaining} művelet szinkronizálása sikertelen`)
          }
        } finally {
          setIsSyncing(false)
        }
      })()
    }
  }, [isOnline, onSynced])

  return { isOnline, pendingCount, isSyncing, refreshCount }
}
