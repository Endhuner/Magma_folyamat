import { Order, Product, InventoryItem, InventoryTransaction } from './types'

export interface InventoryDeductionResult {
  success: boolean
  deductedItems: Array<{
    inventoryItemId: string
    productName: string
    drawingNumber: string
    deductedQuantity: number
  }>
  failedItems: Array<{
    productName: string
    drawingNumber: string
    requiredQuantity: number
    availableQuantity: number
    reason: string
  }>
  transactions: InventoryTransaction[]
}

export function deductInventoryForOrders(
  orders: Order[],
  inventory: InventoryItem[],
  products: Product[]
): InventoryDeductionResult {
  const deductedItems: InventoryDeductionResult['deductedItems'] = []
  const failedItems: InventoryDeductionResult['failedItems'] = []
  const transactions: InventoryTransaction[] = []

  for (const order of orders) {
    const product = products.find(p => 
      p.productName === order.productName && 
      p.customer === order.customer
    )

    if (!product) {
      failedItems.push({
        productName: order.productName,
        drawingNumber: order.designation || '',
        requiredQuantity: order.amountPc || 0,
        availableQuantity: 0,
        reason: 'Termék nem található az adatbázisban'
      })
      continue
    }

    const inventoryItem = inventory.find(item => 
      item.drawingNumber === product.drawingNumber &&
      item.customer === order.customer
    )

    if (!inventoryItem) {
      failedItems.push({
        productName: order.productName,
        drawingNumber: product.drawingNumber,
        requiredQuantity: order.amountPc || 0,
        availableQuantity: 0,
        reason: 'Nincs készleten ez a termék'
      })
      continue
    }

    const requiredQuantity = order.amountPc || 0
    
    if (inventoryItem.quantity < requiredQuantity) {
      failedItems.push({
        productName: order.productName,
        drawingNumber: product.drawingNumber,
        requiredQuantity: requiredQuantity,
        availableQuantity: inventoryItem.quantity,
        reason: 'Nincs elegendő mennyiség készleten'
      })
      continue
    }

    deductedItems.push({
      inventoryItemId: inventoryItem.id,
      productName: order.productName,
      drawingNumber: product.drawingNumber,
      deductedQuantity: requiredQuantity
    })

    const transaction: InventoryTransaction = {
      id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      inventoryItemId: inventoryItem.id,
      type: 'out',
      quantity: requiredQuantity,
      orderId: order.id,
      notes: `Automatikus levonás: Rendelés ${order.ownOrderNumber || order.orderNumber} kiszállítva`,
      createdAt: new Date().toISOString()
    }
    
    transactions.push(transaction)
  }

  return {
    success: failedItems.length === 0,
    deductedItems,
    failedItems,
    transactions
  }
}

export function applyInventoryDeduction(
  inventory: InventoryItem[],
  deductionResult: InventoryDeductionResult
): InventoryItem[] {
  const now = new Date().toISOString()
  
  return inventory.map(item => {
    const deduction = deductionResult.deductedItems.find(
      d => d.inventoryItemId === item.id
    )
    
    if (deduction) {
      return {
        ...item,
        quantity: Math.max(0, item.quantity - deduction.deductedQuantity),
        lastUpdated: now
      }
    }
    
    return item
  })
}
