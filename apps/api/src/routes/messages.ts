/**
 * Üzenetek / feladatok REST endpointok (CRUD-factory-val).
 *
 * GET/POST/PATCH/DELETE /api/v1/messages
 * SSE event típus: 'message' — új üzenetnél a címzett kliense azonnal frissül,
 * és a fejlécben villog a jelzés.
 *
 * Minden bejelentkezett szerep küldhet és olvashat; a kliens szűri a sajátjait
 * (a rendszer többi részéhez hasonlóan teljes-lista szinkronnal dolgozunk).
 */
import type { FastifyInstance } from 'fastify'
import { messageCreateSchema, messageUpdateSchema } from '@produktivpro/shared'
import { messages } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'messages',
    table: messages,
    insertSchema: messageCreateSchema,
    updateSchema: messageUpdateSchema,
    auditEntity: 'message',
    auditLabel: 'Üzenet',
    nameField: 'body',
    permissions: {
      read:   ['admin', 'operator', 'viewer'],
      create: ['admin', 'operator', 'viewer'],
      update: ['admin', 'operator', 'viewer'], // olvasottá tétel / feladat kész
      delete: ['admin'],
    },
  })
}
