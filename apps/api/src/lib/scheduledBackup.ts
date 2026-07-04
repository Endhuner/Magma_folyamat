/**
 * Ütemezett automatikus adatbázis-mentés.
 *
 * A better-sqlite3 `.backup()` online, konzisztens másolatot készít az élő
 * adatbázisról (WAL mellett is biztonságos) a `backups/` mappába, időbélyeggel.
 * A `backup.ts` route ugyanezt a mappát listázza / szolgálja ki letöltésre.
 *
 * - Induláskor egyszer fut (rövid késleltetéssel), utána 24 óránként.
 * - A megőrzési időn (alapból 30 nap) túli mentéseket törli.
 *
 * ponytail: egyszerű setInterval, nem cron. Egy konténer-példányra tervezve;
 * több példánynál külső ütemezőre (vagy elosztott lock-ra) kell váltani.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { FastifyBaseLogger } from 'fastify'
import { getSqlite } from '../db/connection.js'
import { purgeExpiredTrash } from './trashService.js'
import { config } from '../config.js'

const DAY_MS = 24 * 60 * 60 * 1000
const RETENTION_DAYS = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '', 10) || 30
const INTERVAL_MS = DAY_MS

function backupDir(): string {
  return path.join(path.dirname(config.databaseFile), 'backups')
}

/** Egy időbélyeges mentés készítése. Hibát nem dob — csak naplóz. */
export async function runBackupOnce(log: FastifyBaseLogger): Promise<void> {
  try {
    const dir = backupDir()
    fs.mkdirSync(dir, { recursive: true })
    // Fájlnév: rendezhető ISO-időbélyeg (a route reverse-sortolja).
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = path.join(dir, `produktivpro_auto_${stamp}.sqlite`)
    // A .backup() Promise-t ad vissza a better-sqlite3-ban.
    await getSqlite().backup(dest)
    log.info(`[backup] automatikus mentés kész: ${path.basename(dest)}`)
    pruneOldBackups(log)
    // Lejárt lomtár-tételek végleges törlése (30 napos megőrzés).
    const purged = purgeExpiredTrash(RETENTION_DAYS)
    if (purged > 0) log.info(`[trash] ${purged} lejárt lomtár-tétel véglegesen törölve`)
  } catch (err) {
    log.error(err, '[backup] automatikus mentés sikertelen')
  }
}

/** A megőrzési időn túli AUTOMATIKUS mentések törlése (a kézieket nem bántjuk). */
function pruneOldBackups(log: FastifyBaseLogger): void {
  const dir = backupDir()
  if (!fs.existsSync(dir)) return
  const cutoff = Date.now() - RETENTION_DAYS * DAY_MS
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('produktivpro_auto_') || !f.endsWith('.sqlite')) continue
    const full = path.join(dir, f)
    try {
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.unlinkSync(full)
        log.info(`[backup] régi mentés törölve (>${RETENTION_DAYS} nap): ${f}`)
      }
    } catch {
      // egy fájl törlési hibája ne állítsa le a takarítást
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null

/** Beindítja az ütemezett mentést. Idempotens — kétszer hívva nem duplikál. */
export function startScheduledBackups(log: FastifyBaseLogger): void {
  if (process.env.DISABLE_SCHEDULED_BACKUP === 'true') {
    log.info('[backup] ütemezett mentés kikapcsolva (DISABLE_SCHEDULED_BACKUP)')
    return
  }
  if (timer) return
  // Indulás után 60 mp-cel az első mentés (ne lassítsa a boot-ot), majd 24h-nként.
  setTimeout(() => void runBackupOnce(log), 60_000)
  timer = setInterval(() => void runBackupOnce(log), INTERVAL_MS)
  log.info(`[backup] ütemezett mentés aktív — ${RETENTION_DAYS} napos megőrzés`)
}
