/**
 * Production routes — shifts, defects, logs.
 *
 * A "shift" rögzítése a frontend Phase 0-ban implementált auto-inventory
 * logikát (lövésszám × fészekszám → bevét) jelenleg még a kliens
 * oldalon hajtja végre. Phase 2-ben átkerül a backendre, hogy az SSE-
 * broadcasten más kliensek is azonnal lássák.
 */
import type { FastifyInstance } from 'fastify'
import {
  productionShiftCreateSchema,
  productionShiftUpdateSchema,
  productionDefectCreateSchema,
  productionDefectUpdateSchema,
  productionLogCreateSchema,
  productionLogUpdateSchema,
} from '@produktivpro/shared'
import { productionShifts, productionDefects, productionLogs } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function productionRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'shifts',
    table: productionShifts,
    insertSchema: productionShiftCreateSchema,
    updateSchema: productionShiftUpdateSchema,
    auditEntity: 'shift',
    auditLabel: 'Műszak',
    permissions: {
      read:   ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin', 'operator'],
      delete: ['admin'],
    },
  })
  registerCrudRoutes(app, {
    resource: 'defects',
    table: productionDefects,
    insertSchema: productionDefectCreateSchema,
    updateSchema: productionDefectUpdateSchema,
    auditEntity: 'defect',
    auditLabel: 'Selejt',
    permissions: {
      read:   ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
  registerCrudRoutes(app, {
    resource: 'production-logs',
    table: productionLogs,
    insertSchema: productionLogCreateSchema,
    updateSchema: productionLogUpdateSchema,
    auditEntity: 'shift', // a frontend 'shift'-hez társítja a logokat
    auditLabel: 'Gyártási napló',
    permissions: {
      read:   ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
