/**
 * Gép-karbantartási napló REST endpointok (CRUD-factory-val).
 *
 * GET/POST/PUT/PATCH/DELETE /api/v1/machine-maintenance
 * SSE event típus: 'maintenance'.
 */
import type { FastifyInstance } from 'fastify'
import { machineMaintenanceCreateSchema, machineMaintenanceUpdateSchema } from '@produktivpro/shared'
import { machineMaintenance } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function maintenanceRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'machine-maintenance',
    table: machineMaintenance,
    insertSchema: machineMaintenanceCreateSchema,
    updateSchema: machineMaintenanceUpdateSchema,
    auditEntity: 'maintenance',
    auditLabel: 'Karbantartás',
    nameField: 'description',
    permissions: {
      read:   ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin', 'operator'],
      delete: ['admin'],
    },
  })
}
