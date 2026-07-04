/**
 * Általános CRUD-route factory Fastify + Drizzle felett.
 *
 * Cél: ne ismételjünk 9× ugyanazt a code-pathot. Minden entitás azonos
 * mintát követ:
 *
 *   GET    /:resource         — lista (limit/offset paging)
 *   GET    /:resource/:id     — egy darab vagy 404
 *   POST   /:resource         — create (ha nincs id, generálunk; setjük createdAt/updatedAt)
 *   PUT    /:resource/:id     — full update (id-t nem írjuk át; updatedAt-ot frissítjük)
 *   PATCH  /:resource/:id     — partial update (csak a megadott mezőket)
 *   DELETE /:resource/:id     — törlés
 *
 * A routerhez beadjuk a Drizzle-táblát, az insert + update Zod-sémákat,
 * és opcionális JSON-mező-listát (orderIds, exportData stb.), amelyeket
 * be/kifelé szerializálunk.
 *
 * Kibővítések későbbi fázisokra:
 *  - audit-log írás a service-ben (middleware-ből kiemelve, hogy a változás-
 *    objektum elérhető legyen)
 *  - SSE broadcast a mutáció után
 *  - lágy törlés (deletedAt) — most még nem kell, kemény delete elég
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { v4 as uuidv4 } from 'uuid'
import { z, type ZodTypeAny } from 'zod'
import { getDb } from '../db/connection.js'
import { broadcast } from './sseBroadcaster.js'
import { recordAudit } from './auditService.js'
import { registerTrashable, moveToTrash } from './trashService.js'
import { tryAuth, requireAuth, requireRole } from './authGuards.js'
import type { AuditEntityType, UserRole, CurrentUser } from '@produktivpro/shared'

/**
 * A request-userId-t kiveszi a hitelesített `request.user`-ből, ha van.
 * Phase 3-ban a soft-auth `tryAuth` preHandler az összes mutáló endpoint-on
 * fut, így ha a klienensnek van cookie-ja, a `req.user` populálódik.
 */
function userOf(req: FastifyRequest): { userId?: string; userName?: string } {
  const u = req.user as CurrentUser | undefined
  if (!u) return {}
  return { userId: u.id, userName: u.name }
}

export interface CrudOptions<TInsertSchema extends ZodTypeAny, TUpdateSchema extends ZodTypeAny> {
  /** URL-szegmens (pl. 'orders'). */
  resource: string
  /** Drizzle-tábla, amelyet kezelünk. Bármilyen sqliteTable. */
  table: SQLiteTable
  /** Insert-séma (POST body). Mezők, amelyeket a kliens be tud küldeni. */
  insertSchema: TInsertSchema
  /** Update-séma (PUT/PATCH body). Általában Partial(insertSchema). */
  updateSchema: TUpdateSchema
  /** JSON-szerializálandó mezők. A DB-ben string-ként tároljuk. */
  jsonFields?: readonly string[]
  /** Audit-log entitás-típus. */
  auditEntity: AuditEntityType
  /** Magyar feliratkozási név (pl. "Rendelés"). */
  auditLabel: string
  /** Mező-név, amely a humán-olvasható azonosítót adja az audit-logban. */
  nameField?: string
  /**
   * Phase 3 — szerep-mátrix. Mely role-ok mit tehetnek. Ha undefined,
   * minden bejelentkezett felhasználó tehet mindent (default).
   * Ha egyáltalán nincs auth, a CRUD továbbra is működik anonim módban
   * (gradual rollout) — a `requireAuthForMutations` flag ezt szigorítja.
   */
  permissions?: {
    read?: UserRole[]
    create?: UserRole[]
    update?: UserRole[]
    delete?: UserRole[]
  }
  /**
   * Ha true, a POST/PUT/PATCH/DELETE-hez **kötelező** a bejelentkezés
   * (akkor is, ha nincs `permissions` szűrés). Phase 3 alapból ezt FALSE-on
   * hagyjuk a backward-kompatibilitásért, de Phase 4-ben kötelező lesz.
   */
  requireAuthForMutations?: boolean
  /**
   * Hook, amely a Zod-validáció UTÁN, az insert/update ELŐTT módosíthatja
   * a payload-ot. Pl. PIN → bcrypt hash transformáció, sorszám-ütközés feloldás.
   * A `ctx` megmondja, create vagy update fut, és update-nél a rekord id-ját.
   */
  transformInput?: (
    input: Record<string, unknown>,
    ctx?: { op: 'create' | 'update'; id?: string }
  ) => Record<string, unknown>
  /**
   * Hook, amely a DB-ből visszaolvasott rekordot a kliens előtt szűri.
   * Pl. `pinHash` mező eltávolítása. NEM hívódik a list-result minden
   * elemére — azt is lefedi: a list-handler iterál vele.
   */
  redactOutput?: (row: Record<string, unknown>) => Record<string, unknown>
}

interface PagingQuery {
  limit?: number
  offset?: number
}

const pagingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

function nowIso(): string {
  return new Date().toISOString()
}

function serializeJsonFields<T extends Record<string, unknown>>(
  row: T,
  jsonFields: readonly string[]
): T {
  if (jsonFields.length === 0) return row
  const out: Record<string, unknown> = { ...row }
  for (const field of jsonFields) {
    if (out[field] !== undefined && out[field] !== null && typeof out[field] !== 'string') {
      out[field] = JSON.stringify(out[field])
    }
  }
  return out as T
}

function deserializeJsonFields<T extends Record<string, unknown>>(
  row: T,
  jsonFields: readonly string[]
): T {
  if (jsonFields.length === 0) return row
  const out: Record<string, unknown> = { ...row }
  for (const field of jsonFields) {
    const v = out[field]
    if (typeof v === 'string' && v.length > 0) {
      try {
        out[field] = JSON.parse(v)
      } catch {
        // Sérült JSON a DB-ben — naplózzuk (különben felderíthetetlen), és a
        // frontend várta típusnak megfelelő üres értéket adunk, hogy a
        // .map()/.length hívások ne dobjanak el egy teljes listanézetet.
        console.warn(`[crudFactory] hibás JSON a(z) "${field}" mezőben (id: ${String(out.id ?? '?')}):`, String(v).slice(0, 120))
        out[field] = v.trim().startsWith('{') ? {} : []
      }
    }
  }
  return out as T
}

function pickName(
  row: Record<string, unknown>,
  nameField?: string
): string {
  if (nameField && typeof row[nameField] === 'string') return row[nameField] as string
  // Fallback prioritás: orderNumber > productName > name > id
  const candidates = ['orderNumber', 'productName', 'name', 'id']
  for (const f of candidates) {
    if (typeof row[f] === 'string' && (row[f] as string).length > 0) return row[f] as string
  }
  return String(row.id || '')
}

export function registerCrudRoutes<
  TInsertSchema extends ZodTypeAny,
  TUpdateSchema extends ZodTypeAny,
>(
  app: FastifyInstance,
  opts: CrudOptions<TInsertSchema, TUpdateSchema>
): void {
  const {
    resource,
    table,
    insertSchema,
    updateSchema,
    jsonFields = [],
    auditEntity,
    auditLabel,
    nameField,
    permissions,
    requireAuthForMutations = false,
    transformInput,
    redactOutput = (r) => r,
  } = opts
  const base = `/${resource}`

  // Lomtár-regisztráció: a törléskor ide mentett rekord a `trash`-route-tal
  // visszaállítható az eredeti táblába.
  registerTrashable(auditEntity, table, auditLabel)

  /**
   * preHandler-ek összerakása egy adott művelethez. A sorrend:
   *  1) `tryAuth` mindig fut, hogy a `req.user` elérhető legyen az audit-hoz.
   *  2) Ha role-szűrés van, `requireRole(...)` ellenőrzi.
   *  3) Ha kötelező az auth, de role-szűrés nincs, `requireAuth` ellenőrzi.
   */
  const handlersFor = (op: 'read' | 'create' | 'update' | 'delete') => {
    const allowed = permissions?.[op]
    if (allowed && allowed.length > 0) return [requireRole(...allowed)]
    if (requireAuthForMutations && op !== 'read') return [requireAuth]
    return [tryAuth]
  }

  // ---------- LIST ----------
  app.get(base, { preHandler: handlersFor('read') }, async (req: FastifyRequest<{ Querystring: PagingQuery }>) => {
    const parsed = pagingQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return { error: 'Érvénytelen lekérdezési paraméterek', issues: parsed.error.issues }
    }
    const { limit, offset } = parsed.data

    const db = getDb()
    let q = db.select().from(table) as unknown as { all: () => unknown[] } & {
      limit: (n: number) => typeof q
      offset: (n: number) => typeof q
    }
    if (limit !== undefined) q = q.limit(limit)
    if (offset !== undefined) q = q.offset(offset)
    const rows = q.all() as Record<string, unknown>[]
    return rows.map((r) => redactOutput(deserializeJsonFields(r, jsonFields)))
  })

  // ---------- GET ONE ----------
  app.get(`${base}/:id`, { preHandler: handlersFor('read') }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const db = getDb()
    const idCol = (table as unknown as { id: { name: string } }).id
    const rows = (db.select().from(table).where(eq(idCol as unknown as never, req.params.id)).all() as unknown) as Record<string, unknown>[]
    if (rows.length === 0) return reply.code(404).send({ error: `${auditLabel} nem található` })
    return redactOutput(deserializeJsonFields(rows[0]!, jsonFields))
  })

  // ---------- CREATE ----------
  app.post(base, { preHandler: handlersFor('create') }, async (req, reply) => {
    const parsed = insertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Érvénytelen kérés-test',
        issues: parsed.error.issues,
      })
    }
    const rawInput = parsed.data as Record<string, unknown>
    const input = transformInput ? transformInput(rawInput, { op: 'create' }) : rawInput
    const now = nowIso()
    const row = serializeJsonFields(
      {
        ...input,
        id: typeof input.id === 'string' && input.id.length > 0 ? input.id : uuidv4(),
        createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
        updatedAt: now,
      },
      jsonFields
    )

    const db = getDb()
    try {
      db.insert(table).values(row as never).run()
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      console.error(`[crudFactory] DB insert hiba (${resource}):`, msg, '\nSor:',
        Object.keys(row as object).join(', '))
      return reply.code(500).send({ error: `DB insert sikertelen: ${msg}` })
    }

    const created = redactOutput(deserializeJsonFields(row, jsonFields))

    try {
      recordAudit({
        entityType: auditEntity,
        entityLabel: auditLabel,
        entityId: row.id as string,
        entityName: pickName(created, nameField),
        action: 'create',
        ...userOf(req),
      })
    } catch (auditErr: unknown) {
      // Audit-log hiba nem akadályozza a sikeres választ — csak naplózzuk
      console.error(`[crudFactory] Audit-log hiba (${resource}):`, auditErr)
    }
    broadcast({ type: auditEntity, action: 'create', id: row.id as string })

    return reply.code(201).send(created)
  })

  // ---------- UPDATE (PUT/PATCH) ----------
  const handleUpdate = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Érvénytelen kérés-test',
        issues: parsed.error.issues,
      })
    }
    const db = getDb()
    const idCol = (table as unknown as { id: { name: string } }).id
    const existingRows = db.select().from(table).where(eq(idCol as unknown as never, req.params.id)).all() as Record<string, unknown>[]
    if (existingRows.length === 0) return reply.code(404).send({ error: `${auditLabel} nem található` })
    const before = deserializeJsonFields(existingRows[0]!, jsonFields)

    // Optimista konkurencia-ellenőrzés: ha a kliens elküldi az általa ismert
    // verziót (x-if-unmodified-since = a szerkesztés alapjául vett updatedAt),
    // és az időközben megváltozott, 409-cel jelezzük az ütközést + visszaadjuk
    // az aktuális szerver-verziót, hogy a kliens ne írja felül a más módosítását.
    const baseVersion = req.headers['x-if-unmodified-since']
    if (typeof baseVersion === 'string' && baseVersion.length > 0) {
      const currentVersion = before.updatedAt
      if (typeof currentVersion === 'string' && currentVersion !== baseVersion) {
        return reply.code(409).send({
          error: 'A rekordot időközben más módosította',
          current: redactOutput(before),
        })
      }
    }

    const updateRaw = parsed.data as Record<string, unknown>
    const transformed: Record<string, unknown> = transformInput
      ? transformInput(updateRaw, { op: 'update', id: req.params.id })
      : updateRaw
    const update: Record<string, unknown> = serializeJsonFields(
      { ...transformed, updatedAt: nowIso() },
      jsonFields
    )
    // id-t soha nem írjuk át — biztos ami biztos.
    delete update.id
    db.update(table).set(update as never).where(eq(idCol as unknown as never, req.params.id)).run()

    const afterRows = db.select().from(table).where(eq(idCol as unknown as never, req.params.id)).all() as Record<string, unknown>[]
    const after = redactOutput(deserializeJsonFields(afterRows[0]!, jsonFields))

    recordAudit({
      entityType: auditEntity,
      entityLabel: auditLabel,
      entityId: req.params.id,
      entityName: pickName(after, nameField),
      action: 'update',
      changes: diffShallow(before, after),
      ...userOf(req),
    })
    broadcast({ type: auditEntity, action: 'update', id: req.params.id })

    return after
  }

  app.put(`${base}/:id`, { preHandler: handlersFor('update') }, handleUpdate)
  app.patch(`${base}/:id`, { preHandler: handlersFor('update') }, handleUpdate)

  // ---------- DELETE ----------
  app.delete(`${base}/:id`, { preHandler: handlersFor('delete') }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const db = getDb()
    const idCol = (table as unknown as { id: { name: string } }).id
    const existingRows = db.select().from(table).where(eq(idCol as unknown as never, req.params.id)).all() as Record<string, unknown>[]
    if (existingRows.length === 0) return reply.code(404).send({ error: `${auditLabel} nem található` })
    const before = deserializeJsonFields(existingRows[0]!, jsonFields)

    // Soft delete: a nyers rekord (szerializált JSON-mezőkkel) a lomtárba
    // kerül, majd a fő táblából törlünk — egy tranzakcióban.
    const { userId, userName } = userOf(req)
    db.transaction(() => {
      moveToTrash({
        entityType: auditEntity,
        entityId: req.params.id,
        entityLabel: auditLabel,
        entityName: pickName(before, nameField),
        row: existingRows[0]!,
        deletedBy: userId,
        deletedByName: userName,
      })
      db.delete(table).where(eq(idCol as unknown as never, req.params.id)).run()
    })

    recordAudit({
      entityType: auditEntity,
      entityLabel: auditLabel,
      entityId: req.params.id,
      entityName: pickName(before, nameField),
      action: 'delete',
      ...userOf(req),
    })
    broadcast({ type: auditEntity, action: 'delete', id: req.params.id })

    return reply.code(204).send()
  })
}

/**
 * Egyszerű mező-szintű diff. Csak a top-level kulcsokat hasonlítja.
 * Sub-objektumokat referenciálisan, primitíveket szigorúan.
 *
 * Fontos: a `createdAt`/`updatedAt` mezőket nem logoljuk, mert minden
 * update-nél változnak és csak zajt adnának.
 */
function diffShallow(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { field: string; before: unknown; after: unknown }[] {
  const skip = new Set(['createdAt', 'updatedAt'])
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const out: { field: string; before: unknown; after: unknown }[] = []
  for (const k of keys) {
    if (skip.has(k)) continue
    const a = before[k]
    const b = after[k]
    if (a === b) continue
    // Tömbök / objektumok: deep-string-compare egy gyenge, de elég a Phase 1-ben.
    if (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b)) continue
    out.push({ field: k, before: a, after: b })
  }
  return out
}
