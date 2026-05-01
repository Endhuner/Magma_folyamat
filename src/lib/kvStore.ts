/**
 * Egyszerű, szinkron kulcs-érték tár localStorage felett.
 *
 * A korábbi `@github/spark/spark` `spark.kv.*` API helyettesítője.
 * Ugyanazt a metódusnévkészletet használja (get/set/delete/keys), de szinkron.
 *
 * Korlátok:
 * - Csak JSON-szerializálható értékeket tárol.
 * - localStorage tipikusan ~5 MB / origin. Nagy bináris tartalmakhoz inkább
 *   IndexedDB-re kell áttérni egy későbbi iterációban.
 *
 * Az `await` használat (örökölt kód) működik továbbra is, mert a sima érték
 * `await`-tel is használható – nem dob hibát.
 *
 * Kvóta-monitorozás:
 * - `getQuotaUsage()` becsült byte-felhasználást ad vissza a `kv:` prefixű
 *   kulcsokra.
 * - Ha QuotaExceededError történik a `set` során, a `kv:quota-exceeded`
 *   custom esemény tüzelődik (App.tsx ezt elkapja és toast-ot mutat).
 * - Minden `set` után, ha a becsült felhasználás ≥ 80% (4 MB), egyszer
 *   tüzel a `kv:quota-warning` esemény (per session, hogy ne spammeljen).
 */

const PREFIX = 'kv:'
const CHANNEL_NAME = 'produktivpro-kv'

/**
 * BroadcastChannel — több böngésző-tab közti azonnali szinkronizáció.
 * A natív `storage` esemény is működik (a másik tab triggereli, ha localStorage
 * változik), de a BroadcastChannel megbízhatóbb és payload-ot is hordozhat,
 * így nem kell minden tabban újra olvasni a localStorage-t.
 *
 * Az API mindig `null` lehet (Node, régi böngésző) — ilyenkor csendben lemondunk
 * róla, és csak a `storage` esemény szolgálja ki a cross-tab szinkronizációt.
 */
const broadcastChannel: BroadcastChannel | null = (() => {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
})()

export interface KvBroadcastMessage<T = unknown> {
  type: 'set' | 'delete'
  key: string
  value?: T
  /** Időbélyeg (ms) — későbbi konfliktus-feloldáshoz használható. */
  ts: number
}

/**
 * Tipikus localStorage limit Chrome / Edge / Firefox / Safari alatt: ~5 MB
 * (10 millió UTF-16 karakter = ~5 MB UTF-8 ekvivalens). Ezt használjuk
 * referenciaként a kvóta-figyelmeztetéshez.
 */
export const ESTIMATED_QUOTA_BYTES = 5 * 1024 * 1024 // 5 MB
export const QUOTA_WARNING_THRESHOLD = 0.8 // 80%

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function safeParse<T>(raw: string | null): T | undefined {
  if (raw == null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/**
 * Becsült byte-felhasználás a `kv:` prefixű kulcsokra. UTF-16 → UTF-8
 * pontatlan, de a 80%-os küszöb miatt a "magas oldalra" tévedünk.
 */
export function getQuotaUsage(): { bytes: number; ratio: number; entries: number } {
  if (!isBrowser()) return { bytes: 0, ratio: 0, entries: 0 }
  let bytes = 0
  let entries = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      const v = window.localStorage.getItem(k) || ''
      // Két byte / karakter felső becslés (UTF-16 storage)
      bytes += k.length * 2 + v.length * 2
      entries += 1
    }
  } catch {
    // ignore
  }
  return { bytes, ratio: bytes / ESTIMATED_QUOTA_BYTES, entries }
}

let quotaWarningEmitted = false

function maybeEmitQuotaWarning(): void {
  if (!isBrowser()) return
  if (quotaWarningEmitted) return
  const usage = getQuotaUsage()
  if (usage.ratio >= QUOTA_WARNING_THRESHOLD) {
    quotaWarningEmitted = true
    window.dispatchEvent(
      new CustomEvent('kv:quota-warning', { detail: usage })
    )
  }
}

/**
 * Resetelhető a session során — pl. ha a felhasználó takarított és újra
 * akarjuk látni a következő küszöbátlépést.
 */
export function resetQuotaWarningFlag(): void {
  quotaWarningEmitted = false
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: number }
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  )
}

export const kvStore = {
  /**
   * Lekéri a tárolt értéket vagy undefined-ot, ha nincs.
   * A korábbi Spark API async volt; itt is engedjük az `await`-et.
   */
  get<T>(key: string): T | undefined {
    if (!isBrowser()) return undefined
    return safeParse<T>(window.localStorage.getItem(PREFIX + key))
  },

  set<T>(key: string, value: T): void {
    if (!isBrowser()) return
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
      // Engedjük, hogy más tabok és a useKV hook reagáljanak.
      window.dispatchEvent(new CustomEvent('kv:change', { detail: { key } }))
      // Cross-tab broadcast — a többi tab azonnal frissítheti a state-jét
      // anélkül, hogy újra kellene olvasnia a localStorage-t.
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({
            type: 'set',
            key,
            value,
            ts: Date.now(),
          } satisfies KvBroadcastMessage<T>)
        } catch {
          // Ha a payload nem szerializálható (pl. body-cycle), csendben elnyeljük —
          // a `storage` esemény még megoldja a sync-et.
        }
      }
      // Soft figyelmeztetés, ha a tár megtelőben van.
      maybeEmitQuotaWarning()
    } catch (err) {
      // QuotaExceededError vagy szerializációs hiba – ne dobjuk tovább,
      // hogy ne ölje meg a renderelést, de a konzolba jelezzük.
      // eslint-disable-next-line no-console
      console.error('[kvStore.set] failed for key', key, err)
      if (isQuotaError(err)) {
        const usage = getQuotaUsage()
        window.dispatchEvent(
          new CustomEvent('kv:quota-exceeded', {
            detail: { key, ...usage },
          })
        )
      }
    }
  },

  delete(key: string): void {
    if (!isBrowser()) return
    window.localStorage.removeItem(PREFIX + key)
    window.dispatchEvent(new CustomEvent('kv:change', { detail: { key } }))
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'delete',
          key,
          ts: Date.now(),
        } satisfies KvBroadcastMessage)
      } catch {
        /* storage event still covers it */
      }
    }
  },

  /**
   * Más tab-eseményekre való feliratkozás. A `useKV` hook ezt használja a
   * BroadcastChannel-en érkező `set`/`delete` üzenetek elkapására. Visszaadja
   * az `unsubscribe` függvényt.
   *
   * Ha a böngésző nem támogatja a BroadcastChannel-t, a hívó nem kap üzeneteket
   * ezen az úton — a `storage` esemény szolgálja ki a sync-et helyette.
   */
  subscribe(listener: (msg: KvBroadcastMessage) => void): () => void {
    if (!broadcastChannel) return () => {}
    const handler = (e: MessageEvent) => {
      const data = e.data as KvBroadcastMessage | undefined
      if (!data || (data.type !== 'set' && data.type !== 'delete')) return
      listener(data)
    }
    broadcastChannel.addEventListener('message', handler)
    return () => broadcastChannel.removeEventListener('message', handler)
  },

  keys(): string[] {
    if (!isBrowser()) return []
    const out: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length))
    }
    return out
  },
}

/**
 * Háttér-kompatibilis aszinkron felület a régi `spark.kv` használatához.
 * A új kódban inkább `kvStore`-t használj.
 */
export const sparkKvCompat = {
  async get<T>(key: string): Promise<T | undefined> {
    return kvStore.get<T>(key)
  },
  async set<T>(key: string, value: T): Promise<void> {
    kvStore.set<T>(key, value)
  },
  async delete(key: string): Promise<void> {
    kvStore.delete(key)
  },
  async keys(): Promise<string[]> {
    return kvStore.keys()
  },
}
