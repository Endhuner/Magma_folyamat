/**
 * useOnlineStatus — hálózati elérhetőség figyelése.
 *
 * Két réteg:
 *  1. navigator.onLine: azonnali, de megbízhatatlan (csak a fizikai kapcsolatot látja)
 *  2. Periodikus API ping (/api/v1/health): megerősíti, hogy a szerver tényleg elérhető
 *
 * Az `isOnline` flag csak akkor true, ha mindkét forrás online-t jelez.
 * A `pendingCount` a Dexie-ból lekérdezett, még el nem küldött műveletek száma.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const PING_INTERVAL_MS = 15_000
const PING_URL = '/health'
const PING_TIMEOUT_MS = 4_000

async function pingServer(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch(PING_URL, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      return
    }
    const reachable = await pingServer()
    setIsOnline(reachable)
  }, [])

  useEffect(() => {
    check()

    const handleOnline = () => check()
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    pingRef.current = setInterval(check, PING_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (pingRef.current) clearInterval(pingRef.current)
    }
  }, [check])

  return { isOnline }
}
