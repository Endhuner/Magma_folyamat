/**
 * SQLite kapcsolat better-sqlite3 felett, Drizzle ORM-mel.
 *
 * - WAL mód: konkurens olvasások egy író mellett — kötelező egy SSE-broadcast
 *   webszerverhez, ahol több kapcsolat egyszerre olvashat.
 * - foreign_keys ON: SQLite-ban alapból kikapcsolva, mi konzisztencia miatt
 *   bekapcsoljuk.
 * - busy_timeout: 5 mp. Ha másik tranzakció éppen ír, várjon ennyit, mielőtt
 *   SQLITE_BUSY-t dobna. Egy gyártásirányítási rendszerre bőven elég.
 *
 * Drizzle "schema" objektumát itt nem importáljuk a circular import elkerülése
 * miatt — a route-ok majd közvetlenül a `db`-t kapják + külön a schemát.
 */
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import * as schema from './schema.js'

let _sqlite: Database.Database | null = null
let _db: BetterSQLite3Database<typeof schema> | null = null

export function getSqlite(): Database.Database {
  if (_sqlite) return _sqlite

  // Az adatfájl mappáját biztosítjuk (pl. /app/data Docker volume).
  const dir = path.dirname(config.databaseFile)
  mkdirSync(dir, { recursive: true })

  const sqlite = new Database(config.databaseFile)
  // Pragmák — SOR a fontos.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL') // WAL alatt biztonságos, gyorsabb mint FULL
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  _sqlite = sqlite
  return sqlite
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (_db) return _db
  _db = drizzle(getSqlite(), { schema, logger: false })
  return _db
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}

// Graceful shutdown: SIGTERM / SIGINT esetén lezárjuk a fájlt, hogy a WAL
// checkpoint lefusson és ne maradjon -wal/-shm szennyezés.
process.once('SIGTERM', closeDb)
process.once('SIGINT', closeDb)

export type AppDb = ReturnType<typeof getDb>
