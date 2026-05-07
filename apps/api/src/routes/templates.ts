/**
 * Templates routes — cimkesablonok és dokumentumsablonok (szállítólevél / CMR).
 *
 * /api/v1/label-templates   — LabelTemplate CRUD
 * /api/v1/saved-templates   — SavedTemplate (HTML/CSS szállítólevél + CMR) CRUD
 */
import type { FastifyInstance } from 'fastify'
import {
  labelTemplateCreateSchema,
  labelTemplateUpdateSchema,
  savedTemplateCreateSchema,
  savedTemplateUpdateSchema,
} from '@produktivpro/shared'
import { labelTemplates, savedTemplates } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function templatesRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'label-templates',
    table: labelTemplates,
    insertSchema: labelTemplateCreateSchema,
    updateSchema: labelTemplateUpdateSchema,
    auditEntity: 'order', // nincs dedikált entitástípus — logolunk order alá
    auditLabel: 'Cimkesablon',
    nameField: 'name',
    jsonFields: ['margins', 'cellSettings', 'fontSettings', 'alignmentSettings', 'printSettings', 'paddingSettings'],
  })

  registerCrudRoutes(app, {
    resource: 'saved-templates',
    table: savedTemplates,
    insertSchema: savedTemplateCreateSchema,
    updateSchema: savedTemplateUpdateSchema,
    auditEntity: 'order',
    auditLabel: 'Dokumentumsablon',
    nameField: 'name',
    jsonFields: ['data'],
  })
}
