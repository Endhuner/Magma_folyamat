/**
 * Inventory routes — items + transactions.
 *
 * Az `items` és `transactions` külön resource-ok, de logikailag össze-
 * tartoznak. Phase 2-ben jön egy dedikált POST /inventory/deduct endpoint,
 * ami atomikusan vesz le készletet és ír tranzakciót (a frontend
 * `commitInventoryDeduction` szerver-oldali megfelelője).
 */
import type { FastifyInstance } from 'fastify'
import {
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  inventoryTransactionCreateSchema,
  inventoryTransactionUpdateSchema,
} from '@produktivpro/shared'
import { inventoryItems, inventoryTransactions } from '../db/schema.js'
import { registerCrudRoutes } from '../lib/crudFactory.js'

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  registerCrudRoutes(app, {
    resource: 'inventory-items',
    table: inventoryItems,
    insertSchema: inventoryItemCreateSchema,
    updateSchema: inventoryItemUpdateSchema,
    auditEntity: 'inventory',
    auditLabel: 'Készlet tétel',
    nameField: 'productName',
    permissions: {
      read:   ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
  registerCrudRoutes(app, {
    resource: 'inventory-transactions',
    table: inventoryTransactions,
    insertSchema: inventoryTransactionCreateSchema,
    updateSchema: inventoryTransactionUpdateSchema,
    auditEntity: 'inventoryTransaction',
    auditLabel: 'Készletmozgás',
    permissions: {
      read:   ['admin', 'operator'],
      create: ['admin', 'operator'],
      update: ['admin'],
      delete: ['admin'],
    },
  })
}
