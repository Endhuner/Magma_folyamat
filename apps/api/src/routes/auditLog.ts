/**
 * Audit-log: csak olvasásra. Az írást a `recordAudit()` szolgáltatás végzi
 * a CRUD-factory-ból, NEM a kliens.
 *
 * A frontend Activity Log oldal tudja szűrni entityType / action / entityId /
 * since szerint. A `since` paraméter ISO-string formát vár.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { auditLogQuerySchema } from '@produktivpro/shared'
import { auditLog } from '../db/schema.js'
import { getDb } from '../db/connection.js'

interface AuditQuery {
  entityType?: string
  entityId?: string
  action?: string
  limit?: number
  offset?: number
  since?: string
}

export async function auditLogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/audit-log', async (req: FastifyRequest<{ Querystring: AuditQuery }>, reply) => {
    const parsed = auditLogQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Érvénytelen lekérdezési paraméterek',
        issues: parsed.error.issues,
      })
    }
    const q = parsed.data

    const conds: SQL[] = []
    if (q.entityType) conds.push(eq(auditLog.entityType, q.entityType as never))
    if (q.entityId) conds.push(eq(auditLog.entityId, q.entityId))
    if (q.action) conds.push(eq(auditLog.action, q.action as never))
    if (q.since) conds.push(gte(auditLog.createdAt, q.since))

    const db = getDb()
    const rows = db
      .select()
      .from(auditLog)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(q.limit)
      .offset(q.offset)
      .all()

    return rows.map((r) => ({
      ...r,
      changes: r.changes ? safeParse(r.changes) : undefined,
    }))
  })

  /**
   * Karbantartás: a legrégebbi N+1. és későbbi bejegyzések törlése.
   * A frontend Phase 0-beli `pruneAuditLog` szerver-oldali megfelelője.
   * Idempotens — bárhányszor lehet hívni.
   */
  app.post('/audit-log/prune', async (req: FastifyRequest<{ Body: { keepLast?: number } }>) => {
    const keepLast = Math.max(1, Math.min(100000, req.body?.keepLast ?? 10000))
    const db = getDb()
    const total = (db.$count(auditLog) as unknown as number) ?? 0
    if (total <= keepLast) return { deleted: 0, total }
    // SQLite-ban nincs LIMIT a DELETE-en alapból, de a Drizzle rowid-szubquery-vel
    // elintézhető. Egyszerűbb: a legkorábbi (total - keepLast) sort olvasni
    // és id-szerűen törölni.
    const cutoff = db
      .select({ createdAt: auditLog.createdAt })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(1)
      .offset(keepLast - 1)
      .get()
    if (!cutoff) return { deleted: 0, total }
    const deleted = db.delete(auditLog).where(lt(auditLog.createdAt, cutoff.createdAt)).run().changes
    return { deleted, total }
  })
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
