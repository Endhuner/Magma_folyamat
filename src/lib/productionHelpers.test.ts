import { describe, it, expect } from 'vitest'
import {
  fmtInt,
  findProductForOrder,
  filterProductionOrders,
  searchOrders,
  filterByPriority,
  sortByDueDate,
  buildShiftsByOrder,
  groupOrdersByStatus,
} from './productionHelpers'
import type { Order, Product, ProductionShift } from './types'

const mkOrder = (p: Partial<Order>): Order =>
  ({
    id: '0',
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

describe('fmtInt', () => {
  it('formats positive integers with hu-HU thousands separator', () => {
    const r = fmtInt(1500)
    expect(r).toMatch(/1.500/) // Either 1\u00a0500 or 1 500 — both are valid hu-HU forms
  })
  it('returns "0" for invalid input', () => {
    expect(fmtInt(NaN)).toBe('0')
    expect(fmtInt(undefined)).toBe('0')
    expect(fmtInt(null)).toBe('0')
  })
  it('rounds floats', () => {
    const r = fmtInt(12.7)
    expect(r).toBe('13')
  })
})

describe('findProductForOrder', () => {
  const products: Product[] = [
    { id: 'pa', customer: 'A', productName: 'Widget', drawingNumber: 'W-1' } as Product,
    { id: 'pb', customer: 'B', productName: 'Gadget', drawingNumber: 'G-1' } as Product,
    // Trükkös duplikátum: másik vevőnél azonos név — a fallback heurisztika
    // ezt false-positive találatként visszaadhatná, de a productId nem.
    { id: 'pc', customer: 'C', productName: 'Widget', drawingNumber: 'W-2' } as Product,
  ]
  it('prefers productId match (strong reference) over name heuristic', () => {
    // A rendelés "Widget"-re és "C" vevőre néz, de a productId egyértelműen
    // a 'pa' termékre mutat. Az új algoritmus a productId-t hozza vissza.
    const r = findProductForOrder(
      mkOrder({ customer: 'C', productName: 'Widget', productId: 'pa' }),
      products
    )
    expect(r?.id).toBe('pa')
    expect(r?.drawingNumber).toBe('W-1')
  })
  it('falls back to name heuristic when productId is missing', () => {
    const r = findProductForOrder(mkOrder({ customer: 'A', productName: 'Widget' }), products)
    expect(r?.drawingNumber).toBe('W-1')
  })
  it('falls back to heuristic when productId points to non-existent product', () => {
    const r = findProductForOrder(
      mkOrder({ customer: 'A', productName: 'Widget', productId: 'deleted' }),
      products
    )
    expect(r?.drawingNumber).toBe('W-1')
  })
  it('matches by customer + drawingNumber stored in productName', () => {
    const r = findProductForOrder(mkOrder({ customer: 'A', productName: 'W-1' }), products)
    expect(r?.productName).toBe('Widget')
  })
  it('returns undefined when no match', () => {
    expect(findProductForOrder(mkOrder({ customer: 'Z' }), products)).toBeUndefined()
  })
})

describe('filterProductionOrders', () => {
  it('keeps only the 6 active production statuses', () => {
    const orders = [
      mkOrder({ id: '1', status: 'Felvéve' }),
      mkOrder({ id: '2', status: 'Folyamatban' }),
      mkOrder({ id: '3', status: 'Előkészítve' }),
      mkOrder({ id: '4', status: 'Szünetel' }),
      mkOrder({ id: '5', status: 'Javítás alatt' }),
      mkOrder({ id: '6', status: 'Kiszállítva' }),
      mkOrder({ id: '7', status: 'Csomagolás alatt' }),
      mkOrder({ id: '8', status: 'Elkészült' }),
    ]
    const r = filterProductionOrders(orders)
    expect(r).toHaveLength(6)
    expect(r.map((o) => o.id).sort()).toEqual(['1', '2', '3', '4', '5', '8'])
  })
})

describe('searchOrders', () => {
  const orders = [
    mkOrder({ id: '1', productName: 'Test Widget' }),
    mkOrder({ id: '2', customer: 'Acme Corp' }),
    mkOrder({ id: '3', orderNumber: 'PO-2024-001' }),
    mkOrder({ id: '4', ownOrderNumber: 'M2411' }),
  ]
  it('returns all when query is empty', () => {
    expect(searchOrders(orders, '')).toEqual(orders)
  })
  it('searches by productName', () => {
    expect(searchOrders(orders, 'widget').map((o) => o.id)).toEqual(['1'])
  })
  it('searches by customer', () => {
    expect(searchOrders(orders, 'acme').map((o) => o.id)).toEqual(['2'])
  })
  it('case-insensitive', () => {
    expect(searchOrders(orders, 'TEST').map((o) => o.id)).toEqual(['1'])
  })
})

describe('filterByPriority', () => {
  const today = new Date()
  const inDays = (d: number) => {
    const dt = new Date(today)
    dt.setDate(dt.getDate() + d)
    return dt.toISOString().split('T')[0]
  }
  const orders = [
    mkOrder({ id: 'urgent', requiredDate: inDays(3) }),
    mkOrder({ id: 'normal', requiredDate: inDays(30) }),
    mkOrder({ id: 'noDate', requiredDate: '' }),
  ]
  it('returns all on "all"', () => {
    expect(filterByPriority(orders, 'all')).toEqual(orders)
  })
  it('keeps only ≤7-day orders on "urgent"', () => {
    expect(filterByPriority(orders, 'urgent').map((o) => o.id)).toEqual(['urgent'])
  })
  it('treats no-date orders as normal', () => {
    expect(filterByPriority(orders, 'normal').map((o) => o.id)).toContain('noDate')
  })
})

describe('sortByDueDate', () => {
  it('sorts ascending, empty dates last', () => {
    const orders = [
      mkOrder({ id: 'late', requiredDate: '2099-01-01' }),
      mkOrder({ id: 'none', requiredDate: '' }),
      mkOrder({ id: 'early', requiredDate: '2020-01-01' }),
    ]
    expect(sortByDueDate(orders).map((o) => o.id)).toEqual(['early', 'late', 'none'])
  })
})

describe('buildShiftsByOrder', () => {
  it('groups shifts by orderId', () => {
    const shifts: ProductionShift[] = [
      { id: 's1', orderId: 'o1' } as ProductionShift,
      { id: 's2', orderId: 'o1' } as ProductionShift,
      { id: 's3', orderId: 'o2' } as ProductionShift,
    ]
    const m = buildShiftsByOrder(shifts)
    expect(m.get('o1')).toHaveLength(2)
    expect(m.get('o2')).toHaveLength(1)
    expect(m.get('o3')).toBeUndefined()
  })
})

describe('groupOrdersByStatus', () => {
  it('returns the 6 expected status keys', () => {
    const orders = [
      mkOrder({ id: '1', status: 'Felvéve' }),
      mkOrder({ id: '2', status: 'Folyamatban' }),
      mkOrder({ id: '3', status: 'Elkészült' }),
    ]
    const r = groupOrdersByStatus(orders)
    expect(Object.keys(r).sort()).toEqual(
      ['done', 'inProgress', 'paused', 'pending', 'ready', 'repair'].sort()
    )
    expect(r.pending).toHaveLength(1)
    expect(r.inProgress).toHaveLength(1)
    expect(r.done).toHaveLength(1)
  })
})
