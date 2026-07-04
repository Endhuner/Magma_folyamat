/**
 * Backup / adatbázis-letöltés endpoint (csak admin).
 *
 * GET /api/v1/backup/download   → az élő SQLite fájl letöltése
 * GET /api/v1/backup/list       → elérhető backup fájlok listája
 * GET /api/v1/backup/:filename  → egy konkrét backup letöltése
 */
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { requireRole } from '../lib/authGuards.js'
import { runBackupOnce } from '../lib/scheduledBackup.js'

const DB_FILE = process.env.DATABASE_FILE || '/data/produktivpro.sqlite'
const BACKUP_DIR = path.join(path.dirname(DB_FILE), 'backups')

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  // Azonnali szerver-oldali mentés kézzel (a UI "Mentés most" gombjához).
  app.post('/backup/create', {
    preHandler: [requireRole('admin')],
  }, async (_req, reply) => {
    await runBackupOnce(app.log)
    return reply.send({ ok: true })
  })

  // Élő adatbázis letöltése
  app.get('/backup/download', {
    preHandler: [requireRole('admin')],
  }, async (_req, reply) => {
    if (!fs.existsSync(DB_FILE)) {
      return reply.code(404).send({ error: 'Adatbázis fájl nem található' })
    }
    const filename = `produktivpro_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`
    return reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Type', 'application/octet-stream')
      .send(fs.createReadStream(DB_FILE))
  })

  // Elérhető backupok listája
  app.get('/backup/list', {
    preHandler: [requireRole('admin')],
  }, async (_req, reply) => {
    if (!fs.existsSync(BACKUP_DIR)) {
      return reply.send({ backups: [] })
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sqlite'))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f))
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        }
      })
    return reply.send({ backups: files })
  })

  // Konkrét backup letöltése
  app.get<{ Params: { filename: string } }>('/backup/:filename', {
    preHandler: [requireRole('admin')],
  }, async (req, reply) => {
    const { filename } = req.params
    // Biztonsági ellenőrzés: csak .sqlite fájl, path traversal ellen
    if (!filename.endsWith('.sqlite') || filename.includes('/') || filename.includes('..')) {
      return reply.code(400).send({ error: 'Érvénytelen fájlnév' })
    }
    const filePath = path.join(BACKUP_DIR, filename)
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Backup nem található' })
    }
    return reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Type', 'application/octet-stream')
      .send(fs.createReadStream(filePath))
  })
}
