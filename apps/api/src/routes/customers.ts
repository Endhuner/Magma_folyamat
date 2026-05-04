import type { FastifyInstance } from 'fastify'
import { customerCreateSchema, customerUpdateSchema } from '@produktivpro/shared'
import { customers } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'customers',
    table: customers,
    insertSchema: customerCreateSchema,
    updateSchema: customerUpdateSchema,
    auditEntity: 'customer',
    auditLabel: 'Vevő',
    nameField: 'name',
    permissions: {
      read:   ['admin', 'operator'],  // operátor látja a vevőneveket a gyártási nézetben
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
