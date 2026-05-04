/**
 * migrateToServer — egyszeri adatmigráció IndexedDB → szerver (SQLite).
 *
 * Mikor fut le:
 *   - Pontosan egyszer, amikor a felhasználó először nyitja meg az alkalmazást
 *     az új szerver-alapú verzióval.
 *   - Ezután a `local-to-server-migration-v1` localStorage kulcs megakadályozza
 *     az ismételt futást.
 *
 * Mit csinál:
 *   - Beolvassa a régi IndexedDB (Dexie) adatokat (rendelések, vevők, termékek,
 *     műszakok, selejtek, készlet, tranzakciók).
 *   - POSTol minden tételt a backend API-ra.
 *   - Duplikátumot elkerül: csak akkor küld, ha a szerver adatbázisa üres
 *     (vagy az adott entitásnál nincs egyezés).
 */
import { ordersRepo, customersRepo, productsRepo } from './repos'
import {
  inventoryRepo,
  inventoryTransactionsRepo,
  shiftsRepo,
  defectsRepo,
} from './repos'

const MIGRATION_FLAG = 'local-to-server-migration-v1'

const API_BASE = (typeof import.meta !== 'undefined' &&
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) || ''

async function postToApi<T>(resource: string, item: T): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/${resource}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    return res.ok || res.status === 409 // 409 = már létezik → OK
  } catch {
    return false
  }
}

async function getServerCount(resource: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/${resource}?limit=1`, {
      credentials: 'include',
    })
    if (!res.ok) return -1
    const data = await res.json()
    return Array.isArray(data) ? data.length : 0
  } catch {
    return -1
  }
}

export function isMigrationDone(): boolean {
  try {
    return localStorage.getItem(MIGRATION_FLAG) === 'done'
  } catch {
    return true // ha nincs localStorage, ne futtassuk
  }
}

export function markMigrationDone(): void {
  try {
    localStorage.setItem(MIGRATION_FLAG, 'done')
  } catch { /* ignore */ }
}

export async function migrateLocalDataToServer(
  onProgress?: (msg: string) => void
): Promise<{ migrated: number; skipped: number; errors: number }> {
  let migrated = 0
  let skipped = 0
  let errors = 0

  const log = (msg: string) => {
    console.log('[migration]', msg)
    onProgress?.(msg)
  }

  const resources: Array<{
    name: string
    resource: string
    loader: () => Promise<unknown[]>
  }> = [
    { name: 'Rendelések', resource: 'orders', loader: () => ordersRepo.list() },
    { name: 'Vevők', resource: 'customers', loader: () => customersRepo.list() },
    { name: 'Termékek', resource: 'products', loader: () => productsRepo.list() },
    { name: 'Készlet', resource: 'inventory-items', loader: () => inventoryRepo.list() },
    { name: 'Készlet tranzakciók', resource: 'inventory-transactions', loader: () => inventoryTransactionsRepo.list() },
    { name: 'Műszakok', resource: 'shifts', loader: () => shiftsRepo.list() },
    { name: 'Selejtek', resource: 'defects', loader: () => defectsRepo.list() },
  ]

  for (const { name, resource, loader } of resources) {
    let localItems: unknown[]
    try {
      localItems = await loader()
    } catch {
      log(`${name}: IndexedDB olvasási hiba, kihagyva`)
      continue
    }

    if (localItems.length === 0) {
      log(`${name}: helyi adat nincs, kihagyva`)
      continue
    }

    // Ha a szerver már tartalmaz adatot ebből az entitásból, kihagyjuk
    // (feltételezzük, hogy a migráció már korábban lefutott részben).
    const serverCount = await getServerCount(resource)
    if (serverCount > 0) {
      log(`${name}: szerver már tartalmaz ${serverCount} tételt, kihagyva`)
      skipped += localItems.length
      continue
    }

    log(`${name}: ${localItems.length} tétel migrálása...`)

    for (const item of localItems) {
      const ok = await postToApi(resource, item)
      if (ok) migrated++
      else errors++
    }

    log(`${name}: kész`)
  }

  return { migrated, skipped, errors }
}
