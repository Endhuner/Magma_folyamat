import type { FastifyInstance } from 'fastify'
import { productCreateSchema, productUpdateSchema } from '@produktivpro/shared'
import { products } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'products',
    table: products,
    insertSchema: productCreateSchema,
    updateSchema: productUpdateSchema,
    auditEntity: 'product',
    auditLabel: 'Termék',
    nameField: 'productName',
  })
}
