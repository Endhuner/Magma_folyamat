/**
 * Árajánlatok — admin-only CRUD a generikus factory-val
 * (SSE broadcast 'quote' témán, audit-log, lomtárba törlés).
 */
import type { FastifyInstance } from 'fastify'
import { quoteCreateSchema, quoteUpdateSchema } from '@produktivpro/shared'
import { quotes } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function quotesRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'quotes',
    table: quotes,
    insertSchema: quoteCreateSchema,
    updateSchema: quoteUpdateSchema,
    auditEntity: 'quote',
    auditLabel: 'Árajánlat',
    nameField: 'number',
    jsonFields: ['items', 'calc'],
    requireAuthForMutations: true,
    permissions: {
      read: ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
