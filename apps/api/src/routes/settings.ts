/**
 * App settings route — általános kulcs-érték tároló.
 *
 * GET  /api/v1/settings/:key   → { key, value, updatedAt }
 * PUT  /api/v1/settings/:key   → { value: any } → upsert, visszaadja az újat
 *
 * Nincs lista-endpoint — minden kulcsot névvel kérdezünk le.
 * A `value` mezőt JSON-ként tároljuk TEXT-ben, visszaadjuk parsed objektumként.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { appSettingUpsertSchema } from '@produktivpro/shared'
import { appSettings } from '../db/schema.js'
import { getDb } from '../db/index.js'

const keyParamSchema = z.object({ key: z.string().min(1) })

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // GET /settings/:key
  app.get<{ Params: { key: string } }>('/settings/:key', async (req, reply) => {
    const parsed = keyParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.badRequest('Érvénytelen kulcs')

    const db = getDb()
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, parsed.data.key))
      .limit(1)

    if (rows.length === 0) {
      // Nincs mentve — alapértelmezett üres objektum
      return reply.send({ key: parsed.data.key, value: {}, updatedAt: null })
    }

    let value: unknown = {}
    try {
      value = JSON.parse(rows[0].value)
    } catch {
      value = {}
    }
    return reply.send({ key: rows[0].key, value, updatedAt: rows[0].updatedAt })
  })

  // PUT /settings/:key
  app.put<{ Params: { key: string }; Body: unknown }>('/settings/:key', async (req, reply) => {
    const keyParsed = keyParamSchema.safeParse(req.params)
    if (!keyParsed.success) return reply.badRequest('Érvénytelen kulcs')

    const bodyParsed = appSettingUpsertSchema.safeParse(req.body)
    if (!bodyParsed.success) return reply.badRequest('Érvénytelen kérés-törzs')

    const db = getDb()
    const serialized = JSON.stringify(bodyParsed.data.value ?? {})
    const now = new Date().toISOString()

    await db
      .insert(appSettings)
      .values({ key: keyParsed.data.key, value: serialized, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: serialized, updatedAt: now },
      })

    let value: unknown = {}
    try {
      value = JSON.parse(serialized)
    } catch {
      value = {}
    }
    return reply.send({ key: keyParsed.data.key, value, updatedAt: now })
  })
}
