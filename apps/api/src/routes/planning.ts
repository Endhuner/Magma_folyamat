/**
 * Gyártástervező routes.
 *
 * GET  /api/v1/machine-planning              — összes hozzárendelés
 * POST /api/v1/machine-planning              — rendelés hozzárendelése géphez (+ gépalap log)
 * PUT  /api/v1/machine-planning/reorder      — sorrend változtatás gépen belül
 * PUT  /api/v1/machine-planning/:id          — hozzárendelés frissítése (pl. mozgatás másik gépre)
 * DELETE /api/v1/machine-planning/:id        — hozzárendelés törlése (+ gépalap log)
 *
 * GET  /api/v1/machine-planning-log          — gépalap log (összes gép)
 * GET  /api/v1/machine-planning-log/:machineId — egy gép gépalap logja
 */
import type { FastifyInstance } from 'fastify'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/connection.js'
import {
  machinePlanningAssignments,
  machinePlanningLog,
} from '../db/schema.js'
import {
  machinePlanningAssignmentCreateSchema,
  machinePlanningAssignmentUpdateSchema,
  machinePlanningReorderSchema,
  machinePlanningLogCreateSchema,
} from '@produktivpro/shared'
import { broadcast } from '../lib/sseBroadcaster.js'
import { tryAuth } from '../lib/authGuards.js'
import type { CurrentUser } from '@produktivpro/shared'

function userOf(req: any): { userId: string; userName: string } {
  const u = req.user as CurrentUser | undefined
  return { userId: u?.id || '', userName: u?.name || '' }
}

const nowIso = () => new Date().toISOString()

export async function planningRoutes(app: FastifyInstance): Promise<void> {
  // ── Hozzárendelések ────────────────────────────────────────────────────

  // GET /machine-planning — összes hozzárendelés
  app.get('/machine-planning', async (_req, reply) => {
    const db = getDb()
    const rows = db.select().from(machinePlanningAssignments).all()
    return reply.send(rows)
  })

  // POST /machine-planning — rendelés hozzárendelése géphez
  app.post('/machine-planning', { preHandler: [tryAuth] }, async (req, reply) => {
    const parsed = machinePlanningAssignmentCreateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Érvénytelen adat', issues: parsed.error.issues })

    const db = getDb()
    const input = parsed.data
    const now = nowIso()

    // Ha a rendelés már más gépen van, töröljük az ottani hozzárendelést és logoljuk
    const existing = db.select().from(machinePlanningAssignments)
      .where(eq(machinePlanningAssignments.orderId, input.orderId))
      .get()

    const fromMachineId = existing?.machineId ?? ''

    const id = typeof input.id === 'string' && input.id.length > 0 ? input.id : uuidv4()
    const row = {
      id,
      machineId: input.machineId,
      orderId: input.orderId,
      position: input.position ?? 0,
      plannedHoursOverride: input.plannedHoursOverride ?? '',
      assignedAt: input.assignedAt || now,
      createdAt: now,
      updatedAt: now,
    }

    // Gépalap log bejegyzés
    const { userId, userName } = userOf(req)
    const logAction = fromMachineId ? 'moved' : 'assigned'
    const logRow = {
      id: uuidv4(),
      machineId: input.machineId,
      orderId: input.orderId,
      action: logAction as 'assigned' | 'moved',
      productName: (input as any).productName || '',
      designation: (input as any).designation || '',
      ownOrderNumber: (input as any).ownOrderNumber || '',
      customer: (input as any).customer || '',
      fromMachineId,
      userId,
      userName,
      timestamp: now,
      createdAt: now,
    }

    // Egy tranzakcióban: régi hozzárendelés törlése + új beszúrása + log.
    // Ha bármelyik lépés hibázik, a hozzárendelés nem veszhet el félúton.
    db.transaction((tx) => {
      if (existing) {
        tx.delete(machinePlanningAssignments)
          .where(eq(machinePlanningAssignments.id, existing.id))
          .run()
      }
      tx.insert(machinePlanningAssignments).values(row).run()
      tx.insert(machinePlanningLog).values(logRow).run()
    })

    broadcast({ type: 'order', action: 'update', id: input.orderId })
    return reply.code(201).send(row)
  })

  // PUT /machine-planning/reorder — sorrend frissítése gépen belül
  app.put('/machine-planning/reorder', { preHandler: [tryAuth] }, async (req, reply) => {
    const parsed = machinePlanningReorderSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Érvénytelen adat' })

    const db = getDb()
    const { orderedIds } = parsed.data
    const now = nowIso()

    // Tranzakcióban: vagy a teljes új sorrend érvényesül, vagy semmi.
    db.transaction((tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const rowId = orderedIds[i]
        if (!rowId) continue
        tx.update(machinePlanningAssignments)
          .set({ position: i, updatedAt: now })
          .where(eq(machinePlanningAssignments.id, rowId))
          .run()
      }
    })

    broadcast({ type: 'order', action: 'update', id: 'planning-reorder' })
    return reply.send({ ok: true })
  })

  // PUT /machine-planning/:id — hozzárendelés frissítése
  app.put<{ Params: { id: string } }>('/machine-planning/:id', { preHandler: [tryAuth] }, async (req, reply) => {
    const parsed = machinePlanningAssignmentUpdateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Érvénytelen adat' })

    const db = getDb()
    const now = nowIso()
    db.update(machinePlanningAssignments)
      .set({ ...parsed.data, updatedAt: now })
      .where(eq(machinePlanningAssignments.id, req.params.id))
      .run()

    broadcast({ type: 'order', action: 'update', id: req.params.id })
    return reply.send({ ok: true })
  })

  // DELETE /machine-planning/order/:orderId — egy rendelés összes hozzárendelésének törlése (Elkészült státusz esetén)
  app.delete<{ Params: { orderId: string } }>('/machine-planning/order/:orderId', { preHandler: [tryAuth] }, async (req, reply) => {
    const db = getDb()
    const { orderId } = req.params

    const existing = db.select().from(machinePlanningAssignments)
      .where(eq(machinePlanningAssignments.orderId, orderId))
      .get()

    if (!existing) return reply.code(204).send()

    db.delete(machinePlanningAssignments)
      .where(eq(machinePlanningAssignments.orderId, orderId))
      .run()

    const { userId, userName } = userOf(req)
    db.insert(machinePlanningLog).values({
      id: uuidv4(),
      machineId: existing.machineId,
      orderId,
      action: 'removed' as const,
      productName: '',
      designation: '',
      ownOrderNumber: '',
      customer: '',
      fromMachineId: '',
      userId,
      userName,
      timestamp: nowIso(),
      createdAt: nowIso(),
    }).run()

    broadcast({ type: 'order', action: 'update', id: orderId })
    return reply.code(204).send()
  })

  // DELETE /machine-planning/:id — hozzárendelés törlése
  app.delete<{ Params: { id: string } }>('/machine-planning/:id', { preHandler: [tryAuth] }, async (req, reply) => {
    const db = getDb()

    const existing = db.select().from(machinePlanningAssignments)
      .where(eq(machinePlanningAssignments.id, req.params.id))
      .get()

    if (!existing) return reply.code(404).send({ error: 'Nem található' })

    db.delete(machinePlanningAssignments)
      .where(eq(machinePlanningAssignments.id, req.params.id))
      .run()

    // Gépalap log — eltávolítás
    const { userId, userName } = userOf(req)
    const logRow = {
      id: uuidv4(),
      machineId: existing.machineId,
      orderId: existing.orderId,
      action: 'removed' as const,
      productName: '',
      designation: '',
      ownOrderNumber: '',
      customer: '',
      fromMachineId: '',
      userId,
      userName,
      timestamp: nowIso(),
      createdAt: nowIso(),
    }
    db.insert(machinePlanningLog).values(logRow).run()

    broadcast({ type: 'order', action: 'update', id: existing.orderId })
    return reply.code(204).send()
  })

  // ── Gépalap log ────────────────────────────────────────────────────────

  // GET /machine-planning-log — összes log bejegyzés (legfrissebb elöl)
  app.get('/machine-planning-log', async (_req, reply) => {
    const db = getDb()
    const rows = db.select().from(machinePlanningLog)
      .orderBy(desc(machinePlanningLog.timestamp))
      .all()
    return reply.send(rows)
  })

  // GET /machine-planning-log/:machineId — egy gép logja
  app.get<{ Params: { machineId: string } }>('/machine-planning-log/:machineId', async (req, reply) => {
    const db = getDb()
    const rows = db.select().from(machinePlanningLog)
      .where(eq(machinePlanningLog.machineId, req.params.machineId))
      .orderBy(desc(machinePlanningLog.timestamp))
      .all()
    return reply.send(rows)
  })

  // POST /machine-planning-log — manuális log bejegyzés
  app.post('/machine-planning-log', { preHandler: [tryAuth] }, async (req, reply) => {
    const parsed = machinePlanningLogCreateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Érvénytelen adat' })
    const db = getDb()
    const now = nowIso()
    const row = { ...parsed.data, id: parsed.data.id || uuidv4(), createdAt: now }
    db.insert(machinePlanningLog).values(row as any).run()
    return reply.code(201).send(row)
  })
}
