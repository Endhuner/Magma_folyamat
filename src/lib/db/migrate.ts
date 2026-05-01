/**
 * Egyszeri localStorage → IndexedDB migráció.
 *
 * Az alkalmazás indulásakor (pl. App.tsx mountolásakor) hívandó.
 * Ha már lefutott egyszer, idempotensen visszatér — a `__migrationDone`
 * flagre támaszkodva.
 *
 * Logika:
 *   1. Ellenőrzi a flag-et: ha kész, kilép.
 *   2. Minden ismert KV kulcsra (orders, products, ...) ráolvas a
 *      localStorage-ról, parse-olja, és `bulkPut`-tal beírja az
 *      IndexedDB megfelelő táblájába.
 *   3. Sikeres írás után **nem törli** a localStorage adatot — még
 *      egy verzión át fallback marad. Egy következő release-ben (DB v2)
 *      törölhető. Ez óvatos rollback-stratégia.
 *   4. Beállítja a `__migrationDone` flag-et.
 *
 * Hiba esetén:
 *   - egy táblán belüli hiba nem szakítja meg a teljes migrációt
 *   - minden hibát naplózunk console.error-ral
 *   - a flag csak akkor kerül beállításra, ha minden tábla sikerült
 */
import { getDb } from './database'
import { KV_TO_TABLE, type EntityTable } from './schema'

const MIGRATION_FLAG_KEY = '__tir_db_migrated_v1'

interface MigrationResult {
  alreadyDone: boolean
  migrated: Partial<Record<EntityTable, number>>
  errors: Array<{ kvKey: string; error: string }>
}

/**
 * Lefuttatja a migrációt, ha még nem futott. Idempotens.
 * Visszaadja, hogy hány rekordot költöztetett táblánként.
 */
export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  const result: MigrationResult = {
    alreadyDone: false,
    migrated: {},
    errors: [],
  }

  // Flag-ellenőrzés
  if (
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(MIGRATION_FLAG_KEY) === 'done'
  ) {
    result.alreadyDone = true
    return result
  }

  const db = getDb()

  for (const [kvKey, tableName] of Object.entries(KV_TO_TABLE)) {
    try {
      const raw = window.localStorage?.getItem(`kv:${kvKey}`)
      if (!raw) continue

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        result.errors.push({ kvKey, error: 'Érvénytelen JSON' })
        continue
      }

      if (!Array.isArray(parsed)) continue

      // Csak olyan rekordokat költöztetünk, amelyeknél van id (string).
      const records = parsed.filter(
        (r): r is { id: string } & Record<string, unknown> =>
          r != null &&
          typeof r === 'object' &&
          typeof (r as { id?: unknown }).id === 'string'
      )

      if (records.length === 0) continue

      const table = db.tableByName(tableName as EntityTable)
      // bulkPut — ha valamelyik rekordot már beírtuk, felülírja (idempotens).
      await table.bulkPut(records)
      result.migrated[tableName as EntityTable] = records.length
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push({ kvKey, error: msg })
      console.error(`[migrate] ${kvKey} → ${tableName} hiba:`, e)
    }
  }

  // Csak akkor jelöljük befejezettnek, ha nem volt hiba.
  if (result.errors.length === 0) {
    window.localStorage?.setItem(MIGRATION_FLAG_KEY, 'done')
  }

  return result
}

/** Tesztelési és kézi reset eszköz. */
export function resetMigrationFlag(): void {
  if (typeof window !== 'undefined') {
    window.localStorage?.removeItem(MIGRATION_FLAG_KEY)
  }
}
