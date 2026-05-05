/**
 * Orders REST endpointok.
 *
 * Megj.: státuszváltást a sima PUT/PATCH le tudja kezelni, a CRUD-factory
 * audit-logba menti a `status` mező változását. Phase 2-ben készítünk
 * dedikált POST /:id/status endpointot, amely a `status`-action típust írja
 * (a frontend audit-szűrője ezt használja a kék badge-hez).
 */
import type { FastifyInstance } from 'fastify'
import { orderCreateSchema, orderUpdateSchema } from '@produktivpro/shared'
import { orders } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'orders',
    table: orders,
    insertSchema: orderCreateSchema,
    updateSchema: orderUpdateSchema,
    auditEntity: 'order',
    auditLabel: 'Rendelés',
    nameField: 'orderNumber',
    permissions: {
      read:   ['admin', 'operator'],  // operátor is látja a gyártáshoz szükséges rendeléseket
      create: ['admin'],
      update: ['admin', 'operator'],  // operátor státuszt válthat (gyártás indítás/szünetelés/leállítás)
      delete: ['admin'],
    },
  })
}
