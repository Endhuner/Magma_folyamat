/**
 * Jelenléti ív — napi jelenlét + szabadság-kérelmek.
 * A jelenlét alanyai az OPERÁTOR szerepű felhasználók (nincs külön
 * dolgozó-névsor); az employeeId mező a user id-t tárolja.
 */
import type { FastifyInstance } from 'fastify'
import {
  attendanceEntryCreateSchema, attendanceEntryUpdateSchema,
  leaveRequestCreateSchema, leaveRequestUpdateSchema,
} from '@produktivpro/shared'
import { attendanceEntries, leaveRequests } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'attendance-entries',
    table: attendanceEntries,
    insertSchema: attendanceEntryCreateSchema,
    updateSchema: attendanceEntryUpdateSchema,
    auditEntity: 'attendance',
    auditLabel: 'Jelenlét',
    nameField: 'date',
    requireAuthForMutations: true,
    permissions: {
      read: ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin', 'operator'],
      delete: ['admin'],
    },
  })
  registerCrudRoutes(app, {
    resource: 'leave-requests',
    table: leaveRequests,
    insertSchema: leaveRequestCreateSchema,
    updateSchema: leaveRequestUpdateSchema,
    auditEntity: 'leave',
    auditLabel: 'Szabadság',
    nameField: 'fromDate',
    requireAuthForMutations: true,
    permissions: {
      read: ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
