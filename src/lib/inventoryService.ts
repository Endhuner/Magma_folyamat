import { generateId } from './generateId'
import { Order, Product, InventoryItem, InventoryTransaction } from './types'

export interface InventoryDeductionResult {
  success: boolean
  /**
   * Készletről sikeresen levonható tételek — mennyiség a rendelkezésre álló
   * készletig, akár részleges is. Egy orderId csak egyszer jelenhet meg.
   */
  deductedItems: Array<{
    inventoryItemId: string
    orderId: string
    productName: string
    drawingNumber: string
    /** Ennyit vonunk le (<= készlet). */
    deductedQuantity: number
    /** A rendelésen szereplő teljes mennyiség. */
    requiredQuantity: number
    /** Levonás előtti készletmennyiség. */
    availableQuantity: number
    /**
     * Hiánymennyiség: `requiredQuantity - deductedQuantity`. Ha > 0, akkor
     * a rendelés nem volt teljes mértékben fedezve — figyelmeztetés jelenik meg,
     * de a levonás (részleges) a felhasználó megerősítésével végbemehet.
     */
    shortage: number
  }>
  /** Teljes hiánytételek — egyáltalán nem vonható le (nincs termék vagy nincs InventoryItem). */
  failedItems: Array<{
    orderId: string
    productName: string
    drawingNumber: string
    requiredQuantity: number
    availableQuantity: number
    reason: string
  }>
  transactions: InventoryTransaction[]
}

function findMatchingProduct(order: Order, products: Product[]): Product | undefined {
  return products.find(
    (p) =>
      p.customer === order.customer &&
      (p.productName === order.productName ||
        p.drawingNumber === order.productName ||
        p.productName === order.designation ||
        p.drawingNumber === order.designation)
  )
}

function findMatchingInventoryItem(
  order: Order,
  product: Product | undefined,
  inventory: InventoryItem[]
): InventoryItem | undefined {
  if (product) {
    const byProductId = inventory.find((i) => i.productId === product.id)
    if (byProductId) return byProductId
    const byDrawing = inventory.find(
      (i) => i.customer === product.customer && i.drawingNumber === product.drawingNumber
    )
    if (byDrawing) return byDrawing
  }
  return inventory.find(
    (i) =>
      i.customer === order.customer &&
      (i.productName === order.productName ||
        i.drawingNumber === order.productName ||
        i.productName === order.designation ||
        i.drawingNumber === order.designation)
  )
}

export function deductInventoryForOrders(
  orders: Order[],
  inventory: InventoryItem[],
  products: Product[]
): InventoryDeductionResult {
  const deductedItems: InventoryDeductionResult['deductedItems'] = []
  const failedItems: InventoryDeductionResult['failedItems'] = []
  const transactions: InventoryTransaction[] = []

  // Működés közbeni készlet-térkép, hogy ha ugyanarra a készlettételre több
  // rendelés mutat, ne vonjuk le ugyanazt kétszer.
  const remaining = new Map<string, number>()
  for (const i of inventory) remaining.set(i.id, i.quantity)

  for (const order of orders) {
    const requiredQuantity = order.amountPc || 0
    if (requiredQuantity <= 0) continue

    const product = findMatchingProduct(order, products)
    const inventoryItem = findMatchingInventoryItem(order, product, inventory)

    if (!inventoryItem) {
      failedItems.push({
        orderId: order.id,
        productName: order.productName,
        drawingNumber: product?.drawingNumber || order.designation || '',
        requiredQuantity,
        availableQuantity: 0,
        reason: product ? 'Nincs készleten ez a termék' : 'Termék nem található a készletben',
      })
      continue
    }

    const available = remaining.get(inventoryItem.id) ?? inventoryItem.quantity
    const deductQty = Math.min(available, requiredQuantity)
    const shortage = Math.max(0, requiredQuantity - deductQty)

    if (deductQty > 0) {
      remaining.set(inventoryItem.id, available - deductQty)
      deductedItems.push({
        inventoryItemId: inventoryItem.id,
        orderId: order.id,
        productName: order.productName,
        drawingNumber: product?.drawingNumber || inventoryItem.drawingNumber || '',
        deductedQuantity: deductQty,
        requiredQuantity,
        availableQuantity: available,
        shortage,
      })

      const transaction: InventoryTransaction = {
        id: generateId(),
        inventoryItemId: inventoryItem.id,
        type: 'out',
        quantity: deductQty,
        orderId: order.id,
        notes: shortage > 0
          ? `Szállító ${order.ownOrderNumber || order.orderNumber} — részleges levonás (hiány: ${shortage} db)`
          : `Szállító ${order.ownOrderNumber || order.orderNumber} — levonás`,
        createdAt: new Date().toISOString(),
      }
      transactions.push(transaction)
    } else {
      // 0 készlet — teljes hiány
      failedItems.push({
        orderId: order.id,
        productName: order.productName,
        drawingNumber: product?.drawingNumber || inventoryItem.drawingNumber || '',
        requiredQuantity,
        availableQuantity: available,
        reason: 'Nincs elegendő mennyiség készleten',
      })
    }
  }

  return {
    success: failedItems.length === 0 && deductedItems.every((d) => d.shortage === 0),
    deductedItems,
    failedItems,
    transactions,
  }
}

export function applyInventoryDeduction(
  inventory: InventoryItem[],
  deductionResult: InventoryDeductionResult
): InventoryItem[] {
  const now = new Date().toISOString()
  // Összevont levonási mennyiség készlettételenként (több rendelés is nyúlhat ugyanahhoz)
  const totals = new Map<string, number>()
  for (const d of deductionResult.deductedItems) {
    totals.set(d.inventoryItemId, (totals.get(d.inventoryItemId) ?? 0) + d.deductedQuantity)
  }
  return inventory.map((item) => {
    const toDeduct = totals.get(item.id)
    if (toDeduct && toDeduct > 0) {
      return {
        ...item,
        quantity: Math.max(0, item.quantity - toDeduct),
        lastUpdated: now,
      }
    }
    return item
  })
}

/**
 * Setter-típusok az `useKV<T>` által visszaadott `setX`-ekhez kompatibilisek.
 * A funkcionális forma `(prev) => next` — kötelező használnunk, hogy a két
 * tabban / két gyors egymás utáni levonásban se mossuk el a friss adatot.
 */
type SetState<T> = (
  updater: T | ((prev: T | undefined) => T)
) => void

/**
 * Atomicus készletlevonás-commit — egy hívásban, **funkcionális setter**
 * mintával frissíti az `inventory` és `inventoryTransactions` KV-kat.
 *
 * Miért ez a forma?
 *   - A korábbi kód `setInventory(applyInventoryDeduction(inventory, …))`
 *     a closure-ban befagyott `inventory`-ből számolt → ha közben más
 *     mentett (pl. másik tabból, vagy egy fürge bevét), a változás elveszett.
 *   - A korábbi kód minden tranzakciót külön `setInventoryTransactions(prev =>
 *     [...prev, t])` hívással adott — N rendelés = N re-render, és a
 *     React 19 batching ellenére is N külön kvóta-emisszió.
 *
 * Most mindkettő egyetlen funkcionális setter-hívással történik: az
 * `applyInventoryDeduction` mindig a legfrissebb `prev`-re számol, és a
 * tranzakciók egy lépésben fűződnek hozzá.
 */
export function commitInventoryDeduction(
  deductionResult: InventoryDeductionResult,
  setInventory: SetState<InventoryItem[]>,
  setInventoryTransactions: SetState<InventoryTransaction[]>
): void {
  if (deductionResult.deductedItems.length === 0) return
  setInventory((prev) => applyInventoryDeduction(prev || [], deductionResult))
  setInventoryTransactions((prev) => [...(prev || []), ...deductionResult.transactions])
}
