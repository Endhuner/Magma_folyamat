/**
 * Termék Információs Adatlapok — admin-only CRUD a generikus factory-val.
 */
import type { FastifyInstance } from 'fastify'
import { datasheetCreateSchema, datasheetUpdateSchema } from '@produktivpro/shared'
import { productDatasheets } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function datasheetsRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'product-datasheets',
    table: productDatasheets,
    insertSchema: datasheetCreateSchema,
    updateSchema: datasheetUpdateSchema,
    auditEntity: 'datasheet',
    auditLabel: 'Termék adatlap',
    nameField: 'docId',
    jsonFields: ['machineSettings', 'castingChecks', 'postOperations'],
    requireAuthForMutations: true,
    permissions: {
      read: ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
