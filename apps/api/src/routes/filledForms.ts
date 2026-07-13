/**
 * Kitöltött űrlapok (MOHU, Intermetal) — admin-only CRUD.
 */
import type { FastifyInstance } from 'fastify'
import { filledFormCreateSchema, filledFormUpdateSchema } from '@produktivpro/shared'
import { filledForms } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function filledFormsRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'filled-forms',
    table: filledForms,
    insertSchema: filledFormCreateSchema,
    updateSchema: filledFormUpdateSchema,
    auditEntity: 'filledForm',
    auditLabel: 'Kitöltött űrlap',
    nameField: 'title',
    jsonFields: ['data'],
    requireAuthForMutations: true,
    permissions: {
      read: ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
