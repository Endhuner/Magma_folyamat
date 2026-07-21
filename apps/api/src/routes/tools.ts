/**
 * Eszközlista (Készlet → Eszközlista) — CRUD a generikus factory-val.
 * Olvasás/írás admin + operátor, törlés csak admin.
 */
import type { FastifyInstance } from 'fastify'
import { toolCreateSchema, toolUpdateSchema } from '@produktivpro/shared'
import { tools } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function toolsRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'tools',
    table: tools,
    insertSchema: toolCreateSchema,
    updateSchema: toolUpdateSchema,
    auditEntity: 'tool',
    auditLabel: 'Eszköz',
    nameField: 'name',
    // A beszerzési helyek JSON-tömbként élnek a DB-ben — enélkül nyers stringként menne ki.
    jsonFields: ['suppliers'],
    requireAuthForMutations: true,
    permissions: {
      read: ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin', 'operator'],
      delete: ['admin'],
    },
  })
}
