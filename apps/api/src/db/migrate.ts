/**
 * Resiliens migráció-futtató.
 *
 * A Drizzle beépített `migrate()` helyett saját runner, amely:
 *  - minden migrációt külön futtat (nem egy nagy tranzakcióban)
 *  - "duplicate column name" / "already exists" hibákat figyelmeztetésként
 *    kezeli (nem fatális) — ha az oszlopot korábban kézzel adták hozzá,
 *    a migráció mégis "alkalmazottnak" jelölődik, és a többi folytatódik
 *  - idempotens: ugyanazt a migrációt kétszer nem futtatja le
 *
 * A tracking táblában (`__drizzle_migrations`) a tag-nevet tárolja hash-ként,
 * de a régi, Drizzle által generált hash-eket is érintetlenül hagyja — az
 * összes már-alkalmazott migráció biztonságosan megmarad.
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { closeDb, getSqlite } from './connection.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface JournalEntry {
  idx: number
  tag: string
  when: number
  breakpoints?: boolean
}
interface Journal {
  entries: JournalEntry[]
}

/** "Már korábban alkalmazva volt" típusú SQLite hibák */
function isAlreadyApplied(msg: string): boolean {
  return (
    msg.includes('duplicate column name') ||
    msg.includes('already exists') ||
    msg.includes('table already exists')
  )
}

async function run(): Promise<void> {
  const db = getSqlite()
  const folder = path.resolve(__dirname, 'migrations')
  // eslint-disable-next-line no-console
  console.log(`[migrate] Mappából futtatok: ${folder}`)

  // Tracking tábla biztosítása (idempotens)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT    NOT NULL UNIQUE,
      created_at NUMERIC
    )
  `).run()

  // Journal beolvasása
  const journalPath = path.join(folder, 'meta', '_journal.json')
  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))

  // Már alkalmazott hash-ek (Drizzle-formátumú SHA-k + tag-alapú ID-k vegyesen)
  const applied = new Set(
    (db.prepare('SELECT hash FROM __drizzle_migrations').all() as { hash: string }[]).map(
      (r) => r.hash
    )
  )

  let newCount = 0

  for (const entry of journal.entries) {
    // Ha a tag már benne van a tracking táblában → kihagyás
    if (applied.has(entry.tag)) continue

    const sqlFile = path.join(folder, `${entry.tag}.sql`)
    if (!fs.existsSync(sqlFile)) {
      // eslint-disable-next-line no-console
      console.warn(`[migrate] Hiányzó SQL fájl: ${entry.tag}.sql — kihagyás`)
      continue
    }

    const sql = fs.readFileSync(sqlFile, 'utf-8')
    // Drizzle konvenció: `--> statement-breakpoint` választja el az utasításokat
    const stmts = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    // eslint-disable-next-line no-console
    console.log(`[migrate] Alkalmazás: ${entry.tag}`)

    for (const stmt of stmts) {
      try {
        db.prepare(stmt).run()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (isAlreadyApplied(msg)) {
          // eslint-disable-next-line no-console
          console.log(
            `[migrate]   ~ kihagyás (már alkalmazva kézzel): ${stmt.slice(0, 80)}`
          )
          // Nem dobjuk el a többi utasítást, folytatjuk
        } else {
          throw new Error(`Migráció hiba (${entry.tag}): ${msg}`)
        }
      }
    }

    // Megjelöljük alkalmazottként — INSERT OR IGNORE, ha valami miatt már bent van
    db.prepare(
      'INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
    ).run(entry.tag, Date.now())
    // eslint-disable-next-line no-console
    console.log(`[migrate] ✓ ${entry.tag}`)
    newCount++
  }

  // eslint-disable-next-line no-console
  console.log(
    newCount > 0
      ? `[migrate] Kész: ${newCount} új migráció alkalmazva.`
      : '[migrate] Kész: nincs új migráció.'
  )
  closeDb()
}

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] Hiba:', err)
  process.exit(1)
})
