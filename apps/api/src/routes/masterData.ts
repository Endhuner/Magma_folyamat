import type { FastifyInstance } from 'fastify'
import {
  machineCreateSchema,
  machineUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
  materialCreateSchema,
  materialUpdateSchema,
} from '@produktivpro/shared'
import { machines, users, materials } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'
import { hashPin } from '../lib/passwords.js'

/**
 * A users-routenek két speciális dolga van:
 *  1) az input `pin` mezőt bcrypt-eljük és `pinHash`-be tesszük, az eredeti
 *     `pin`-t soha nem tároljuk
 *  2) a kimenő rekordokból kihagyjuk a `pinHash`-t (PII)
 *  3) csak admin jogú felhasználó kezelheti
 */
function transformUserInput(input: Record<string, unknown>): Record<string, unknown> {
  const out = { ...input }
  if (typeof out.pin === 'string' && out.pin.length > 0) {
    out.pinHash = hashPin(out.pin)
  }
  delete out.pin
  return out
}

function redactUserOutput(row: Record<string, unknown>): Record<string, unknown> {
  const { pinHash: _pinHash, ...rest } = row
  return rest
}

export async function masterDataRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'machines',
    table: machines,
    insertSchema: machineCreateSchema,
    updateSchema: machineUpdateSchema,
    auditEntity: 'machine',
    auditLabel: 'Gép',
    nameField: 'name',
  })
  registerCrudRoutes(app, {
    resource: 'users',
    table: users,
    insertSchema: userCreateSchema,
    updateSchema: userUpdateSchema,
    auditEntity: 'user',
    auditLabel: 'Felhasználó',
    nameField: 'name',
    transformInput: transformUserInput,
    redactOutput: redactUserOutput,
    requireAuthForMutations: true,
    permissions: {
      // listázás/olvasás bárki bejelentkezett felhasználónak — a frontend
      // login screen ehhez nem itt fordul, hanem a /auth/users-public-hez,
      // ami publikus
      read: ['admin', 'operator', 'viewer'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
  registerCrudRoutes(app, {
    resource: 'materials',
    table: materials,
    insertSchema: materialCreateSchema,
    updateSchema: materialUpdateSchema,
    auditEntity: 'material',
    auditLabel: 'Anyag',
    nameField: 'name',
  })
}
