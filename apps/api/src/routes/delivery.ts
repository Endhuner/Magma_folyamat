import type { FastifyInstance } from 'fastify'
import { deliveryNoteCreateSchema, deliveryNoteUpdateSchema } from '@produktivpro/shared'
import { deliveryNotes } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function deliveryRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'delivery-notes',
    table: deliveryNotes,
    insertSchema: deliveryNoteCreateSchema,
    updateSchema: deliveryNoteUpdateSchema,
    jsonFields: ['orderIds', 'exportData'] as const,
    // delivery note audit-entitás-típus külön nincs a Phase 0 enumban — order-hez társítjuk
    auditEntity: 'order',
    auditLabel: 'Szállítólevél',
    nameField: 'sequenceNumber',
    permissions: {
      read:   ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
