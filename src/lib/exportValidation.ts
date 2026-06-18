import { Order, Customer, Product } from '@/lib/types'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
  orderIndex?: number
  orderId?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

export function validateCmrExport(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  cmrSettings?: CmrLayoutSettings
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (orders.length === 0) {
    errors.push({
      field: 'orders',
      message: 'Nincsenek kiválasztott rendelések',
      severity: 'error'
    })
    return { isValid: false, errors, warnings }
  }

  const firstCustomer = orders[0]?.customer
  const hasMultipleCustomers = orders.some(o => o.customer !== firstCustomer)
  
  if (hasMultipleCustomers) {
    errors.push({
      field: 'customer',
      message: 'Többféle vevő van kiválasztva. CMR csak egy vevőre készíthető egyszerre.',
      severity: 'error'
    })
  }

  const customerInfo = customers.find(c => c.name === firstCustomer)
  
  if (!customerInfo) {
    warnings.push({
      field: 'customer',
      message: `Vevő nem található az adatbázisban: ${firstCustomer}`,
      severity: 'warning'
    })
  } else {
    if (!customerInfo.city) {
      warnings.push({
        field: 'customer.city',
        message: `Hiányzó vevői város: ${firstCustomer}`,
        severity: 'warning'
      })
    }
    
    if (!customerInfo.country) {
      warnings.push({
        field: 'customer.country',
        message: `Hiányzó vevői ország: ${firstCustomer}`,
        severity: 'warning'
      })
    }
    
    if (!customerInfo.fullAddress && !customerInfo.street) {
      warnings.push({
        field: 'customer.address',
        message: `Hiányzó vevői cím: ${firstCustomer}`,
        severity: 'warning'
      })
    }
  }

  if (cmrSettings) {
    if (!cmrSettings.senderName) {
      errors.push({
        field: 'cmrSettings.senderName',
        message: 'Hiányzó feladó név a CMR beállításokban',
        severity: 'error'
      })
    }
    
    if (!cmrSettings.senderAddress) {
      errors.push({
        field: 'cmrSettings.senderAddress',
        message: 'Hiányzó feladó cím a CMR beállításokban',
        severity: 'error'
      })
    }
    
    if (!cmrSettings.senderCity) {
      warnings.push({
        field: 'cmrSettings.senderCity',
        message: 'Hiányzó feladó város a CMR beállításokban',
        severity: 'warning'
      })
    }
    
    if (!cmrSettings.senderCountry) {
      warnings.push({
        field: 'cmrSettings.senderCountry',
        message: 'Hiányzó feladó ország a CMR beállításokban',
        severity: 'warning'
      })
    }
  }

  orders.forEach((order, index) => {
    if (!order.productName) {
      errors.push({
        field: 'productName',
        message: `Hiányzó termék név`,
        severity: 'error',
        orderIndex: index,
        orderId: order.id
      })
    }
    
    if (!order.customer) {
      errors.push({
        field: 'customer',
        message: `Hiányzó vevő név`,
        severity: 'error',
        orderIndex: index,
        orderId: order.id
      })
    }
    
    if (!order.amountPc || order.amountPc === 0) {
      warnings.push({
        field: 'amountPc',
        message: `Hiányzó vagy nulla mennyiség: ${order.productName || 'Névtelen termék'}`,
        severity: 'warning',
        orderIndex: index,
        orderId: order.id
      })
    }
    
    if (!order.designation) {
      warnings.push({
        field: 'designation',
        message: `Hiányzó megnevezés: ${order.productName || 'Névtelen termék'}`,
        severity: 'warning',
        orderIndex: index,
        orderId: order.id
      })
    }
    
    const weight = typeof order.grossWeightKg === 'string' 
      ? parseFloat(order.grossWeightKg.replace(',', '.')) 
      : order.grossWeightKg
    
    if (!order.grossWeightKg || weight === 0 || order.grossWeightKg === '') {
      warnings.push({
        field: 'grossWeightKg',
        message: `Hiányzó bruttó súly: ${order.productName || 'Névtelen termék'}`,
        severity: 'warning',
        orderIndex: index,
        orderId: order.id
      })
    }
    
    if (!order.boxesCount || order.boxesCount === 0) {
      warnings.push({
        field: 'boxesCount',
        message: `Hiányzó dobozok száma: ${order.productName || 'Névtelen termék'}`,
        severity: 'warning',
        orderIndex: index,
        orderId: order.id
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateDeliveryExport(
  orders: Order[],
  customers: Customer[],
  products: Product[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (orders.length === 0) {
    errors.push({
      field: 'orders',
      message: 'Nincsenek kiválasztott rendelések',
      severity: 'error'
    })
    return { isValid: false, errors, warnings }
  }

  const firstCustomer = orders[0]?.customer
  const hasMultipleCustomers = orders.some(o => o.customer !== firstCustomer)
  
  if (hasMultipleCustomers) {
    errors.push({
      field: 'customer',
      message: 'Többféle vevő van kiválasztva. Szállítólevél csak egy vevőre készíthető egyszerre.',
      severity: 'error'
    })
  }

  const customerInfo = customers.find(c => c.name === firstCustomer)
  
  if (!customerInfo) {
    warnings.push({
      field: 'customer',
      message: `Vevő nem található az adatbázisban: ${firstCustomer}`,
      severity: 'warning'
    })
  }

  orders.forEach((order, index) => {
    // A szállítólevélhez elég, ha a terméket vagy a neve, vagy a megnevezése
    // (designation) azonosítja — csak akkor hiba, ha mindkettő hiányzik.
    if (!order.productName && !order.designation) {
      errors.push({
        field: 'productName',
        message: `Hiányzó termék név és megnevezés`,
        severity: 'error',
        orderIndex: index,
        orderId: order.id
      })
    }

    if (!order.customer) {
      errors.push({
        field: 'customer',
        message: `Hiányzó vevő név`,
        severity: 'error',
        orderIndex: index,
        orderId: order.id
      })
    }

    if (!order.orderNumber) {
      warnings.push({
        field: 'orderNumber',
        message: `Hiányzó vevői rendelési szám: ${order.productName || 'Névtelen termék'}`,
        severity: 'warning',
        orderIndex: index,
        orderId: order.id
      })
    }
    
    if (!order.amountPc || order.amountPc === 0) {
      warnings.push({
        field: 'amountPc',
        message: `Hiányzó vagy nulla mennyiség: ${order.productName || 'Névtelen termék'}`,
        severity: 'warning',
        orderIndex: index,
        orderId: order.id
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
