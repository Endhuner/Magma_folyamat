/**
 * Customer sequences route — vevőnkénti szállítólevél-sorszámok.
 *
 * GET /api/v1/customer-sequences         → Record<string, number> (teljes térkép)
 * PUT /api/v1/customer-sequences/:id     → { sequence: number } → upsert
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { customerSequenceUpsertSchema } from '@produktivpro/shared'
import { customerSequences } from '../db/schema.js'
import { getDb } from '../db/connection.js'

export async function customerSequencesRoutes(app: FastifyInstance): Promise<void> {
  // GET /customer-sequences → { [customerId]: sequence }
  app.get('/customer-sequences', async (_req, reply) => {
    const db = getDb()
    const rows = await db.select().from(customerSequences)
    const map: Record<string, number> = {}
    for (const row of rows) {
      map[row.customerId] = row.sequence
    }
    return reply.send(map)
  })

  // PUT /customer-sequences/:id
  app.put<{ Params: { id: string }; Body: unknown }>('/customer-sequences/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id
    if (!id) return reply.badRequest('Érvénytelen customerId')

    const parsed = customerSequenceUpsertSchema.safeParse(req.body)
    if (!parsed.success) return reply.badRequest('sequence szám kötelező')

    const db = getDb()
    const now = new Date().toISOString()

    await db
      .insert(customerSequences)
      .values({ customerId: id, sequence: parsed.data.sequence, updatedAt: now })
      .onConflictDoUpdate({
        target: customerSequences.customerId,
        set: { sequence: parsed.data.sequence, updatedAt: now },
      })

    return reply.send({ customerId: id, sequence: parsed.data.sequence, updatedAt: now })
  })
}
