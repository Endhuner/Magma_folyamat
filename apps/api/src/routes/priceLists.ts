/**
 * Vevőnkénti mozgó anyagáras árlisták — admin-only CRUD a generikus factory-val.
 */
import type { FastifyInstance } from 'fastify'
import { priceListCreateSchema, priceListUpdateSchema } from '@produktivpro/shared'
import { priceLists } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function priceListsRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'price-lists',
    table: priceLists,
    insertSchema: priceListCreateSchema,
    updateSchema: priceListUpdateSchema,
    auditEntity: 'priceList',
    auditLabel: 'Árlista',
    nameField: 'customerName',
    jsonFields: ['items', 'mpHistory'],
    requireAuthForMutations: true,
    permissions: {
      read: ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
