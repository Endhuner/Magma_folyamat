/**
 * sseClient — egyetlen megosztott SSE kapcsolat az egész alkalmazáshoz.
 *
 * A böngésző HTTP/1.1 esetén max 6 párhuzamos kapcsolatot enged ugyanarra a
 * host-ra. Az app 9 useServerCrud hook-ot használ — mindegyik saját
 * EventSource-t nyitna, ami 6 fölé tolná a limitet. A 7-9. kapcsolat
 * sorba áll, és sem az SSE-frissítések nem érkeznek meg, sem a logout POST
 * nem tud lefutni (szintén blokkolódik).
 *
 * Megoldás: egy singleton EventSource, amely minden eseményt szétoszt a
 * feliratkozóknak. Így csak 1 kapcsolat megy SSE-re, a többi szabad marad.
 */

type Handler = () => void

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) || ''

// event type => feliratkozók halmaza
const listeners = new Map<string, Set<Handler>>()

let es: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function activeTypes(): string[] {
  const result: string[] = []
  for (const [type, set] of listeners) {
    if (set.size > 0) result.push(type)
  }
  return result
}

function teardown(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (es !== null) {
    es.close()
    es = null
  }
}

function dispatch(type: string): void {
  const set = listeners.get(type)
  if (!set) return
  for (const fn of set) {
    try { fn() } catch { /* ne dobja le a többit */ }
  }
}

function connect(): void {
  teardown()
  const types = activeTypes()
  if (types.length === 0) return

  es = new EventSource(`${API_BASE}/api/v1/events`, { withCredentials: true })

  for (const type of types) {
    es.addEventListener(type, () => dispatch(type))
  }

  es.onerror = () => {
    teardown()
    reconnectTimer = setTimeout(() => {
      for (const [type] of listeners) {
        dispatch(type)
      }
      connect()
    }, 5000)
  }
}

/**
 * Feliratkozás egy vagy több SSE esemény-típusra.
 * @returns unsubscribe függvény — hívd meg unmount-kor
 */
export function subscribeSSE(types: string[], handler: Handler): () => void {
  if (types.length === 0) return () => { return }

  let needReconnect = false
  for (const type of types) {
    if (!type) continue
    const isNew = !listeners.has(type)
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type)!.add(handler)
    if (isNew) needReconnect = true
  }

  if (es === null || needReconnect) {
    connect()
  }

  return () => {
    for (const type of types) {
      const set = listeners.get(type)
      if (set) {
        set.delete(handler)
        if (set.size === 0) listeners.delete(type)
      }
    }
    if (activeTypes().length === 0) teardown()
  }
}
