import { describe, it, expect } from 'vitest'
import { suggestStatusChange, sumProducedForOrder } from './statusSuggestions'
import type { Order, ProductionShift } from './types'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    customer: 'Teszt Kft.',
    productName: 'Alkatrész',
    designation: '',
    notes: '',
    ownOrderNumber: '',
    material: '',
    orderNumber: '',
    amountPc: 1000,
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
    status: 'Felvéve',
    createdAt: '2026-06-01T00:00:00',
    updatedAt: '2026-06-01T00:00:00',
    ...overrides,
  }
}

function makeShift(orderId: string, producedQuantity: number, id = 's' + Math.random()): ProductionShift {
  return {
    id,
    orderId,
    date: '2026-06-10',
    shift: 'de',
    shotsCount: 100,
    producedQuantity,
    notes: '',
    createdAt: '2026-06-10T00:00:00',
  }
}

describe('sumProducedForOrder', () => {
  it('csak az adott rendelés műszakjait összegzi', () => {
    const shifts = [makeShift('o1', 300), makeShift('o2', 999), makeShift('o1', 200)]
    expect(sumProducedForOrder('o1', shifts)).toBe(500)
  })
  it('üres listára 0', () => {
    expect(sumProducedForOrder('o1', [])).toBe(0)
  })
})

describe('suggestStatusChange — Folyamatban szabály', () => {
  it('Felvéve + van legyártott db → Folyamatban', () => {
    const s = suggestStatusChange(makeOrder({ status: 'Felvéve' }), 50)
    expect(s?.status).toBe('Folyamatban')
  })
  it('Előkészítve + van legyártott db → Folyamatban', () => {
    const s = suggestStatusChange(makeOrder({ status: 'Előkészítve' }), 50)
    expect(s?.status).toBe('Folyamatban')
  })
  it('Felvéve, de még semmi sincs legyártva → nincs javaslat', () => {
    expect(suggestStatusChange(makeOrder({ status: 'Felvéve' }), 0)).toBeNull()
  })
  it('már Folyamatban + részleges gyártás → nincs javaslat', () => {
    expect(suggestStatusChange(makeOrder({ status: 'Folyamatban' }), 300)).toBeNull()
  })
})

describe('suggestStatusChange — Elkészült szabály', () => {
  it('legyártott >= rendelt → Elkészült', () => {
    const s = suggestStatusChange(makeOrder({ status: 'Folyamatban', amountPc: 1000 }), 1000)
    expect(s?.status).toBe('Elkészült')
    // Elválasztó-független (a tesztkörnyezet ICU-ja eltérhet): csak a számjegyek.
    expect(s?.reason.replace(/\D/g, '')).toContain('10001000')
  })
  it('túltermelés is Elkészültet javasol', () => {
    const s = suggestStatusChange(makeOrder({ status: 'Folyamatban', amountPc: 1000 }), 1200)
    expect(s?.status).toBe('Elkészült')
  })
  it('a kész mennyiség erősebb: Felvéve + teljes gyártás → Elkészült, nem Folyamatban', () => {
    const s = suggestStatusChange(makeOrder({ status: 'Felvéve', amountPc: 500 }), 500)
    expect(s?.status).toBe('Elkészült')
  })
  it('már Elkészült → nincs javaslat', () => {
    expect(suggestStatusChange(makeOrder({ status: 'Elkészült', amountPc: 1000 }), 1000)).toBeNull()
  })
  it('amountPc 0 esetén nem javasol Elkészültet', () => {
    const s = suggestStatusChange(makeOrder({ status: 'Folyamatban', amountPc: 0 }), 50)
    expect(s).toBeNull()
  })
})

describe('suggestStatusChange — kiszállított / üres', () => {
  it('kiszállított rendelésre nincs javaslat', () => {
    expect(suggestStatusChange(makeOrder({ status: 'Kiszállítva', amountPc: 1000 }), 1000)).toBeNull()
  })
  it('Kiszállítva/Számlázva státuszra sincs', () => {
    expect(suggestStatusChange(makeOrder({ status: 'Kiszállítva/Számlázva' }), 1000)).toBeNull()
  })
  it('undefined rendelésre null', () => {
    expect(suggestStatusChange(undefined, 100)).toBeNull()
  })
})
