import { describe, it, expect } from 'vitest'
import {
  autoStatusForShift, workdaysBetween, ordersToAutoPause,
  nextSameProductOrder, splitOverProduction, producedForOrder,
} from './productionAutomation'
import { DEFAULT_WORK_CALENDAR } from './workCalendar'
import type { Order, ProductionShift } from './types'

const ord = (p: Partial<Order>): Order =>
  ({ id: 'o', customer: '', productName: 'P', designation: '', notes: '', ownOrderNumber: '',
     material: '', orderNumber: '', amountPc: 0, orderDate: '', requiredDate: '', pickupDate: '',
     status: 'Felvéve', ...p }) as Order
const sh = (p: Partial<ProductionShift>): ProductionShift =>
  ({ id: 's', orderId: 'o', date: '2026-07-06', shift: 'de', shotsCount: 0, producedQuantity: 0,
     notes: '', createdAt: '2026-07-06T00:00:00Z', ...p }) as ProductionShift

describe('autoStatusForShift', () => {
  it('sets Folyamatban once production starts', () => {
    expect(autoStatusForShift(ord({ status: 'Felvéve', amountPc: 100 }), 20)).toBe('Folyamatban')
  })
  it('sets Elkészült when produced reaches the ordered quantity', () => {
    expect(autoStatusForShift(ord({ status: 'Folyamatban', amountPc: 100 }), 100)).toBe('Elkészült')
    expect(autoStatusForShift(ord({ status: 'Folyamatban', amountPc: 100 }), 130)).toBe('Elkészült')
  })
  it('returns null when nothing changes', () => {
    expect(autoStatusForShift(ord({ status: 'Folyamatban', amountPc: 100 }), 20)).toBeNull()
    expect(autoStatusForShift(ord({ status: 'Elkészült', amountPc: 100 }), 100)).toBeNull()
  })
  it('never overrides final statuses', () => {
    for (const st of ['Kiszállítva', 'Kiszállítva/Számlázva', 'Javítás alatt'] as const) {
      expect(autoStatusForShift(ord({ status: st, amountPc: 100 }), 100)).toBeNull()
    }
  })
})

describe('workdaysBetween', () => {
  it('counts workdays strictly between, excluding weekends', () => {
    // 2026-07-06 hétfő → 2026-07-09 csütörtök: közte kedd, szerda = 2
    expect(workdaysBetween('2026-07-06', '2026-07-09', DEFAULT_WORK_CALENDAR)).toBe(2)
    // péntek → hétfő: közte szo, vas → 0 munkanap
    expect(workdaysBetween('2026-07-10', '2026-07-13', DEFAULT_WORK_CALENDAR)).toBe(0)
    expect(workdaysBetween('2026-07-06', '2026-07-06', DEFAULT_WORK_CALENDAR)).toBe(0)
  })
})

describe('ordersToAutoPause', () => {
  const cal = DEFAULT_WORK_CALENDAR
  it('pauses a Folyamatban order after 2 full workdays without a shift', () => {
    const orders = [ord({ id: 'A', status: 'Folyamatban' })]
    const shifts = [sh({ orderId: 'A', date: '2026-07-06' })] // hétfő
    // csütörtök: kedd+szerda telt el munkanapként
    expect(ordersToAutoPause(orders, shifts, '2026-07-09', cal)).toEqual(['A'])
    // szerdán még csak 1 munkanap (kedd) telt → nem
    expect(ordersToAutoPause(orders, shifts, '2026-07-08', cal)).toEqual([])
  })
  it('ignores non-Folyamatban and shift-less orders', () => {
    const orders = [ord({ id: 'A', status: 'Felvéve' }), ord({ id: 'B', status: 'Folyamatban' })]
    const shifts = [sh({ orderId: 'A', date: '2026-07-01' })]
    expect(ordersToAutoPause(orders, shifts, '2026-07-20', cal)).toEqual([])
  })
})

describe('nextSameProductOrder', () => {
  it('returns the earliest-due same-product order that is still open', () => {
    const cur = ord({ id: 'A', productId: 'P1', requiredDate: '2026-07-01' })
    const orders = [
      cur,
      ord({ id: 'B', productId: 'P1', status: 'Folyamatban', requiredDate: '2026-08-01' }),
      ord({ id: 'C', productId: 'P1', status: 'Felvéve', requiredDate: '2026-07-15' }),
      ord({ id: 'D', productId: 'P2', status: 'Felvéve', requiredDate: '2026-07-02' }),
      ord({ id: 'E', productId: 'P1', status: 'Kiszállítva', requiredDate: '2026-07-03' }),
    ]
    expect(nextSameProductOrder(cur, orders)?.id).toBe('C') // P1, nyitott, legkorábbi határidő
  })
  it('matches by productName when there is no productId', () => {
    const cur = ord({ id: 'A', productName: 'Widget' })
    const orders = [cur, ord({ id: 'B', productName: 'Widget', status: 'Felvéve', requiredDate: '2026-07-10' })]
    expect(nextSameProductOrder(cur, orders)?.id).toBe('B')
  })
  it('returns null when none match', () => {
    const cur = ord({ id: 'A', productId: 'P1' })
    expect(nextSameProductOrder(cur, [cur, ord({ id: 'B', productId: 'P2' })])).toBeNull()
  })
})

describe('splitOverProduction', () => {
  it('caps the current shift and rolls the surplus to the next order with a continuous counter', () => {
    // A: 100 db kell, 0 gyártva. nest=2. Műszak 1000→1100 = 100 lövés = 200 db.
    // A-hoz 50 lövés (100 db) kell → A vége 1050; B: 1050→1100 = 50 lövés = 100 db.
    const order = ord({ id: 'A', amountPc: 100, ownOrderNumber: 'SR-1' })
    const next = ord({ id: 'B', amountPc: 100, status: 'Felvéve' })
    const shift = sh({ orderId: 'A', shotsCount: 100, producedQuantity: 200, endShotsAbsolute: 1100 })
    const r = splitOverProduction({ shift, order, producedBefore: 0, nest: 2, nextOrder: next, newId: 'newB', nowISO: 'NOW' })
    expect(r).not.toBeNull()
    expect(r!.cappedShift.shotsCount).toBe(50)
    expect(r!.cappedShift.producedQuantity).toBe(100)
    expect(r!.cappedShift.endShotsAbsolute).toBe(1050)
    expect(r!.rolloverShift.orderId).toBe('B')
    expect(r!.rolloverShift.shotsCount).toBe(50)
    expect(r!.rolloverShift.producedQuantity).toBe(100)
    expect(r!.rolloverShift.endShotsAbsolute).toBe(1100)
    expect(r!.rolloverShift.id).toBe('newB')
  })
  it('returns null when there is no overproduction', () => {
    const order = ord({ id: 'A', amountPc: 100 })
    const shift = sh({ orderId: 'A', shotsCount: 40, producedQuantity: 80, endShotsAbsolute: 1040 })
    expect(splitOverProduction({ shift, order, producedBefore: 0, nest: 2, nextOrder: ord({ id: 'B' }), newId: 'x', nowISO: 'N' })).toBeNull()
  })
  it('returns null when there is no next order or no counter', () => {
    const order = ord({ id: 'A', amountPc: 100 })
    const shift = sh({ orderId: 'A', shotsCount: 100, producedQuantity: 200, endShotsAbsolute: 1100 })
    expect(splitOverProduction({ shift, order, producedBefore: 0, nest: 2, nextOrder: null, newId: 'x', nowISO: 'N' })).toBeNull()
    const noCounter = sh({ orderId: 'A', shotsCount: 100, producedQuantity: 200 })
    expect(splitOverProduction({ shift: noCounter, order, producedBefore: 0, nest: 2, nextOrder: ord({ id: 'B' }), newId: 'x', nowISO: 'N' })).toBeNull()
  })
})

describe('producedForOrder', () => {
  it('sums producedQuantity for the given order', () => {
    const shifts = [sh({ orderId: 'A', producedQuantity: 10 }), sh({ orderId: 'A', producedQuantity: 5 }), sh({ orderId: 'B', producedQuantity: 99 })]
    expect(producedForOrder('A', shifts)).toBe(15)
  })
})
