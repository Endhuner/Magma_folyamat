import { describe, it, expect } from 'vitest'
import {
  deductInventoryForOrders,
  applyInventoryDeduction,
  restoreInventoryForOrders,
} from './inventoryService'
import type { Order, Product, InventoryItem, InventoryTransaction } from './types'

const mkOrder = (p: Partial<Order>): Order =>
  ({
    id: 'o',
    customer: '',
    productName: '',
    designation: '',
    notes: '',
    ownOrderNumber: '',
    material: '',
    orderNumber: '',
    amountPc: 0,
    orderDate: '',
    requiredDate: '',
    pickupDate: '',
    surfaceTreatment: '',
    boxesCount: null,
    palletsCount: null,
    grossWeightKg: '',
    requiredMaterialKg: '',
    plannedProductionHours: '',
    deliveryNote: '',
    cmr: '',
    status: 'Felvéve',
    ...p,
  }) as Order

const mkProduct = (p: Partial<Product>): Product =>
  ({
    id: 'p',
    customer: '',
    drawingNumber: '',
    productName: '',
    notes: '',
    nestCount: '',
    weightPerPiece: '',
    material: '',
    surfaceTreatment: '',
    cycleTime: '',
    postProcessingTime: '',
    postProcessing: '',
    boxSize: '',
    piecesPerBox: '',
    boxesPerPallet: '',
    articleNumber: '',
    warehouse: '',
    spruWeight: '',
    ...p,
  }) as Product

const mkInv = (p: Partial<InventoryItem>): InventoryItem =>
  ({
    id: 'i',
    productId: '',
    productName: '',
    drawingNumber: '',
    customer: '',
    quantity: 0,
    location: '',
    notes: '',
    lastUpdated: '',
    createdAt: '',
    ...p,
  }) as InventoryItem

describe('deductInventoryForOrders', () => {
  it('reports failure when product not found in inventory', () => {
    const r = deductInventoryForOrders(
      [mkOrder({ id: 'o1', customer: 'A', productName: 'X', amountPc: 10 })],
      [],
      []
    )
    expect(r.success).toBe(false)
    expect(r.failedItems).toHaveLength(1)
    expect(r.deductedItems).toHaveLength(0)
  })

  it('full deduction when sufficient stock', () => {
    const products = [mkProduct({ id: 'p1', customer: 'A', productName: 'X' })]
    const inventory = [mkInv({ id: 'inv1', productId: 'p1', customer: 'A', productName: 'X', quantity: 100 })]
    const r = deductInventoryForOrders(
      [mkOrder({ id: 'o1', customer: 'A', productName: 'X', amountPc: 30 })],
      inventory,
      products
    )
    expect(r.success).toBe(true)
    expect(r.deductedItems[0].deductedQuantity).toBe(30)
    expect(r.deductedItems[0].shortage).toBe(0)
    expect(r.transactions).toHaveLength(1)
    expect(r.transactions[0].type).toBe('out')
  })

  it('partial deduction when stock < required (shortage > 0)', () => {
    const products = [mkProduct({ id: 'p1', customer: 'A', productName: 'X' })]
    const inventory = [mkInv({ id: 'inv1', productId: 'p1', customer: 'A', productName: 'X', quantity: 5 })]
    const r = deductInventoryForOrders(
      [mkOrder({ id: 'o1', customer: 'A', productName: 'X', amountPc: 20 })],
      inventory,
      products
    )
    expect(r.success).toBe(false) // shortage > 0
    expect(r.deductedItems[0].deductedQuantity).toBe(5)
    expect(r.deductedItems[0].shortage).toBe(15)
  })

  it('does not double-deduct when multiple orders point to the same inventory item', () => {
    const products = [mkProduct({ id: 'p1', customer: 'A', productName: 'X' })]
    const inventory = [mkInv({ id: 'inv1', productId: 'p1', customer: 'A', productName: 'X', quantity: 50 })]
    const r = deductInventoryForOrders(
      [
        mkOrder({ id: 'o1', customer: 'A', productName: 'X', amountPc: 30 }),
        mkOrder({ id: 'o2', customer: 'A', productName: 'X', amountPc: 30 }),
      ],
      inventory,
      products
    )
    expect(r.deductedItems).toHaveLength(2)
    expect(r.deductedItems[0].deductedQuantity).toBe(30)
    expect(r.deductedItems[1].deductedQuantity).toBe(20) // only 20 left
    expect(r.deductedItems[1].shortage).toBe(10)
  })

  it('skips orders with zero or missing amountPc', () => {
    const products = [mkProduct({ id: 'p1', customer: 'A', productName: 'X' })]
    const inventory = [mkInv({ id: 'inv1', productId: 'p1', customer: 'A', productName: 'X', quantity: 100 })]
    const r = deductInventoryForOrders(
      [mkOrder({ id: 'o1', customer: 'A', productName: 'X', amountPc: 0 })],
      inventory,
      products
    )
    expect(r.deductedItems).toHaveLength(0)
    expect(r.failedItems).toHaveLength(0)
  })
})

describe('applyInventoryDeduction', () => {
  it('subtracts deducted amount from matching inventory items', () => {
    const inventory = [
      mkInv({ id: 'inv1', quantity: 100 }),
      mkInv({ id: 'inv2', quantity: 50 }),
    ]
    const result = {
      success: true,
      deductedItems: [
        {
          inventoryItemId: 'inv1',
          orderId: 'o1',
          productName: '',
          drawingNumber: '',
          deductedQuantity: 30,
          requiredQuantity: 30,
          availableQuantity: 100,
          shortage: 0,
        },
      ],
      failedItems: [],
      transactions: [],
    }
    const updated = applyInventoryDeduction(inventory, result)
    expect(updated[0].quantity).toBe(70)
    expect(updated[1].quantity).toBe(50) // untouched
  })

  it('clamps quantity to zero, never negative', () => {
    const inventory = [mkInv({ id: 'inv1', quantity: 10 })]
    const result = {
      success: false,
      deductedItems: [
        {
          inventoryItemId: 'inv1',
          orderId: 'o1',
          productName: '',
          drawingNumber: '',
          deductedQuantity: 50, // somehow over-deducted
          requiredQuantity: 50,
          availableQuantity: 10,
          shortage: 40,
        },
      ],
      failedItems: [],
      transactions: [],
    }
    const updated = applyInventoryDeduction(inventory, result)
    expect(updated[0].quantity).toBe(0)
  })

  it('restores exactly the net deducted amount (out − previous restores)', () => {
    const order = mkOrder({ id: 'o1', ownOrderNumber: 'M261001' })
    const txs: InventoryTransaction[] = [
      { id: 't1', inventoryItemId: 'inv1', type: 'out', quantity: 100, orderId: 'o1', notes: '', createdAt: '' },
      // korábbi részleges visszatöltés
      { id: 't2', inventoryItemId: 'inv1', type: 'in', quantity: 40, orderId: 'o1', notes: '', createdAt: '' },
      // műszakból származó bevét — NEM számít bele
      { id: 't3', inventoryItemId: 'inv1', type: 'in', quantity: 500, orderId: 'o1', shiftId: 's1', notes: '', createdAt: '' },
      // másik rendelés mozgása — nem számít
      { id: 't4', inventoryItemId: 'inv1', type: 'out', quantity: 30, orderId: 'o2', notes: '', createdAt: '' },
    ]
    const r = restoreInventoryForOrders([order], txs)
    expect(r.restoredItems).toHaveLength(1)
    expect(r.restoredItems[0].quantity).toBe(60) // 100 − 40
    expect(r.transactions[0].type).toBe('in')
    expect(r.transactions[0].orderId).toBe('o1')
  })

  it('restore is idempotent — nothing left after a full restore', () => {
    const order = mkOrder({ id: 'o1' })
    const txs: InventoryTransaction[] = [
      { id: 't1', inventoryItemId: 'inv1', type: 'out', quantity: 50, orderId: 'o1', notes: '', createdAt: '' },
      { id: 't2', inventoryItemId: 'inv1', type: 'in', quantity: 50, orderId: 'o1', notes: '', createdAt: '' },
    ]
    const r = restoreInventoryForOrders([order], txs)
    expect(r.restoredItems).toHaveLength(0)
    expect(r.transactions).toHaveLength(0)
  })

  it('aggregates multiple deductions targeting the same item', () => {
    const inventory = [mkInv({ id: 'inv1', quantity: 100 })]
    const result = {
      success: true,
      deductedItems: [
        {
          inventoryItemId: 'inv1',
          orderId: 'o1',
          productName: '',
          drawingNumber: '',
          deductedQuantity: 20,
          requiredQuantity: 20,
          availableQuantity: 100,
          shortage: 0,
        },
        {
          inventoryItemId: 'inv1',
          orderId: 'o2',
          productName: '',
          drawingNumber: '',
          deductedQuantity: 30,
          requiredQuantity: 30,
          availableQuantity: 80,
          shortage: 0,
        },
      ],
      failedItems: [],
      transactions: [],
    }
    const updated = applyInventoryDeduction(inventory, result)
    expect(updated[0].quantity).toBe(50) // 100 - 20 - 30
  })
})
