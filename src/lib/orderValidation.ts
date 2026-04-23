import { Order, Product } from './types'

export interface OrderValidationResult {
  isValid: boolean
  warnings: string[]
  hasProductMatch: boolean
  hasDesignationMismatch: boolean
}

export function validateOrder(order: Order, products: Product[]): OrderValidationResult {
  const warnings: string[] = []
  let hasProductMatch = false
  let hasDesignationMismatch = false

  if (!order.customer || !order.productName) {
    return {
      isValid: true,
      warnings: [],
      hasProductMatch: true,
      hasDesignationMismatch: false,
    }
  }

  const matchingProduct = products.find(
    p => p.customer.trim() === order.customer.trim() && 
    (p.drawingNumber.trim() === order.productName.trim() || p.productName.trim() === order.productName.trim())
  )
  
  if (!matchingProduct) {
    warnings.push('Termék rajzszám vagy név nem található a termékek között')
    hasProductMatch = false
  } else {
    hasProductMatch = true
  }

  if (order.designation && matchingProduct) {
    const designationProduct = products.find(
      p => p.customer.trim() === order.customer.trim() && 
      p.productName.trim().toLowerCase() === order.designation.trim().toLowerCase()
    )
    
    if (designationProduct && designationProduct.drawingNumber !== matchingProduct.drawingNumber) {
      warnings.push('Megnevezés nem egyezik a rajzszámmal')
      hasDesignationMismatch = true
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    hasProductMatch,
    hasDesignationMismatch,
  }
}

export function validateOrders(orders: Order[], products: Product[]): Map<string, OrderValidationResult> {
  const results = new Map<string, OrderValidationResult>()
  
  orders.forEach(order => {
    results.set(order.id, validateOrder(order, products))
  })
  
  return results
}
