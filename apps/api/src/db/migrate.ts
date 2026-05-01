/**
 * Migráció-futtató CLI.
 *
 * Használat:
 *   npm run db:migrate
 *
 * A `drizzle-kit generate` által előállított SQL-fájlokat futtatja le
 * a `src/db/migrations/` mappából. Idempotens — Drizzle elnevezés szerint
 * tartja a `__drizzle_migrations` táblában, mit futtatott le már.
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from './connection.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function run(): Promise<void> {
  const db = getDb()
  const folder = path.resolve(__dirname, 'migrations')
  // eslint-disable-next-line no-console
  console.log(`[migrate] Mappából futtatok: ${folder}`)
  migrate(db, { migrationsFolder: folder })
  // eslint-disable-next-line no-console
  console.log('[migrate] Kész.')
  closeDb()
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] Hiba:', err)
  process.exit(1)
})
