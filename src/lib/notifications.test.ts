import { describe, it, expect } from 'vitest'
import { deriveNotifications, DEFAULT_NOTIFICATION_SETTINGS } from './notifications'
import type { Order, InventoryItem, ProductionKPIs } from './types'

const NOW = new Date('2026-06-24T10:00:00')

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    customer: 'Teszt Kft.',
    productName: 'Fröccsöntött alkatrész',
    designation: '',
    notes: '',
    ownOrderNumber: '',
    material: '',
    orderNumber: '',
    amountPc: 100,
    orderDate: '2026-06-01',
    requiredDate: '2026-06-30',
    pickupDate: '',
    invoiced: '',
    ready: '',
    surfaceTreatment: '',
    boxesCount: null,
    palletsCount: null,
    grossWeightKg: '',
    requiredMaterialKg: '',
    plannedProductionHours: '',
    deliveryNote: '',
    cmr: '',
    status: 'Folyamatban',
    createdAt: '2026-06-01T00:00:00',
    updatedAt: '2026-06-01T00:00:00',
    ...overrides,
  }
}

function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1',
    productId: 'p1',
    productName: 'Fröccsöntött alkatrész',
    drawingNumber: 'RAJZ-001',
    customer: 'Teszt Kft.',
    quantity: 5,
    location: '',
    notes: '',
    lastUpdated: '2026-06-20T00:00:00',
    createdAt: '2026-06-01T00:00:00',
    ...overrides,
  }
}

const noKpis: ProductionKPIs = {
  todayProduced: 0,
  weekProduced: 0,
  weekDefects: 0,
  defectRate: 0,
  dailyData: [],
}

describe('deriveNotifications — alacsony készlet', () => {
  it('tételenként egy warning értesítést ad', () => {
    const result = deriveNotifications({
      orders: [],
      lowStockItems: [makeInventoryItem({ id: 'a' }), makeInventoryItem({ id: 'b' })],
      now: NOW,
    })
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('low-stock')
    expect(result[0].severity).toBe('warning')
    expect(result[0].id).toBe('low-stock:a')
    expect(result[0].target).toEqual({ kind: 'inventory' })
  })

  it('üres lista esetén nincs értesítés', () => {
    expect(deriveNotifications({ orders: [], lowStockItems: [], now: NOW })).toHaveLength(0)
  })
})

describe('deriveNotifications — lejárt határidő', () => {
  it('lejárt, nem leszállított rendelésre error értesítést ad', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'late', requiredDate: '2026-06-20', status: 'Folyamatban' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('overdue')
    expect(result[0].severity).toBe('error')
    expect(result[0].id).toBe('overdue:late')
  })

  it('leszállított rendelésre NEM ad lejárt értesítést', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'done', requiredDate: '2026-06-20', status: 'Kiszállítva' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result).toHaveLength(0)
  })

  it('jövőbeli határidő nem számít lejártnak', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'future', requiredDate: '2026-07-30', status: 'Folyamatban' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result.filter((n) => n.type === 'overdue')).toHaveLength(0)
  })
})

describe('deriveNotifications — közelgő határidő', () => {
  it('az ablakon belüli (alapért. 3 nap) határidőre warning értesítést ad', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'soon', requiredDate: '2026-06-26', status: 'Folyamatban' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('due-soon')
    expect(result[0].id).toBe('due-soon:soon')
  })

  it('az ablakon kívüli határidő nem ad due-soon értesítést', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'far', requiredDate: '2026-07-10', status: 'Folyamatban' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result.filter((n) => n.type === 'due-soon')).toHaveLength(0)
  })

  it('a lejárt rendelést NEM duplikálja due-soon-ként', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'late', requiredDate: '2026-06-20', status: 'Folyamatban' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result.filter((n) => n.type === 'due-soon')).toHaveLength(0)
    expect(result.filter((n) => n.type === 'overdue')).toHaveLength(1)
  })

  it('leszállított rendelésre nincs due-soon', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'd', requiredDate: '2026-06-26', status: 'Kiszállítva' })],
      lowStockItems: [],
      now: NOW,
    })
    expect(result).toHaveLength(0)
  })
})

describe('deriveNotifications — selejt arány', () => {
  it('a küszöb fölötti heti selejt arányra warning értesítést ad', () => {
    const result = deriveNotifications({
      orders: [],
      lowStockItems: [],
      productionKPIs: { ...noKpis, defectRate: 8, weekDefects: 12 },
      now: NOW,
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('defect-rate')
    expect(result[0].target).toEqual({ kind: 'production' })
  })

  it('a küszöb alatti selejt arányra nincs értesítés', () => {
    const result = deriveNotifications({
      orders: [],
      lowStockItems: [],
      productionKPIs: { ...noKpis, defectRate: DEFAULT_NOTIFICATION_SETTINGS.defectThreshold },
      now: NOW,
    })
    expect(result).toHaveLength(0)
  })
})

describe('deriveNotifications — rendezés', () => {
  it('a hibák (error) a figyelmeztetések elé kerülnek', () => {
    const result = deriveNotifications({
      orders: [makeOrder({ id: 'late', requiredDate: '2026-06-20', status: 'Folyamatban' })],
      lowStockItems: [makeInventoryItem({ id: 'a' })],
      productionKPIs: { ...noKpis, defectRate: 9, weekDefects: 5 },
      now: NOW,
    })
    expect(result[0].severity).toBe('error')
    expect(result.slice(1).every((n) => n.severity === 'warning')).toBe(true)
  })
})
