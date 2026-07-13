/**
 * Lomtár route-ok (soft delete kezelése).
 *
 * GET    /trash              → törölt tételek listája (payload nélkül)
 * POST   /trash/:id/restore  → visszaállítás az eredeti táblába
 * DELETE /trash/:id          → egy tétel végleges törlése
 * DELETE /trash              → teljes lomtár ürítése
 *
 * Csak admin. A visszaállítás/törlés SSE-t broadcastol, hogy a többi kliens
 * frissüljön.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { AuditEntityType } from '@produktivpro/shared'
import { requireRole } from '../lib/authGuards.js'
import { broadcast } from '../lib/sseBroadcaster.js'
import {
  listTrash,
  restoreFromTrash,
  purgeTrashItem,
  purgeExpiredTrash,
} from '../lib/trashService.js'

export async function trashRoutes(app: FastifyInstance): Promise<void> {
  app.get('/trash', { preHandler: [requireRole('admin')] }, async () => {
    return listTrash()
  })

  app.post<{ Params: { id: string } }>(
    '/trash/:id/restore',
    { preHandler: [requireRole('admin')] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = restoreFromTrash(req.params.id)
      if (!result.ok) {
        const code = result.reason === 'not-found' ? 404 : result.reason === 'conflict' ? 409 : 400
        const msg =
          result.reason === 'not-found' ? 'A lomtár-tétel nem található'
          : result.reason === 'conflict' ? 'Ez az azonosító már létezik — nem állítható vissza'
          : 'Ismeretlen entitás-típus — nem állítható vissza'
        return reply.code(code).send({ error: msg })
      }
      // Az érintett entitás-listát frissítse minden kliens.
      broadcast({ type: result.entityType as AuditEntityType, action: 'create', id: result.entityId })
      return reply.send({ ok: true })
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/trash/:id',
    { preHandler: [requireRole('admin')] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const ok = purgeTrashItem(req.params.id)
      if (!ok) return reply.code(404).send({ error: 'A lomtár-tétel nem található' })
      return reply.code(204).send()
    }
  )

  app.delete('/trash', { preHandler: [requireRole('admin')] }, async (_req, reply) => {
    // Teljes ürítés = mindent lejártnak veszünk (0 napos megőrzés).
    const deleted = purgeExpiredTrash(0)
    return reply.send({ deleted })
  })
}
