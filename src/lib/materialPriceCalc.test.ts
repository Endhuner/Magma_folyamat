import { describe, expect, it } from 'vitest'
import {
  buildProductIndex,
  calcPriceListItem,
  periodAverages,
  resolveItemSource,
  pricesForOrder,
} from './materialPriceCalc'

/**
 * Ellenőrző értékek az „Ela árkalkulátor mozgó anyagárral.xlsx"-ből
 * (90ZA-B001-06 sor): súly 14,85 g, MPB 2,33, aktuális MP 3,435,
 * leégés 6%, alapár 20,89 €/100 db.
 */
describe('calcPriceListItem — az Ela-Excel értékeivel', () => {
  const params = { burnRate: 0.06, mpbEurPerKg: 2.33, currentMpEurPerKg: 3.435 }
  const item = { weightG: 14.85, basePricePer100Eur: 20.89 }
  const r = calcPriceListItem(item, params)

  it('különbözet €/kg: 1,105', () => {
    expect(r.diffPerKg).toBeCloseTo(1.105, 6)
  })
  it('leégéses különbözet: 1,1713', () => {
    expect(r.diffWithBurnPerKg).toBeCloseTo(1.1713, 6)
  })
  it('árkorrekció/100 db: 1,73938', () => {
    expect(r.correctionPer100Eur).toBeCloseTo(1.7393805, 6)
  })
  it('aktuális ár: 22,6294 €/100 db és 0,2263 €/db', () => {
    expect(r.currentPricePer100Eur).toBeCloseTo(22.6293805, 6)
    expect(r.currentPricePerPieceEur).toBeCloseTo(0.226293805, 8)
  })
  it('MP = MPB esetén az ár az alapár', () => {
    const same = calcPriceListItem(item, { ...params, currentMpEurPerKg: 2.33 })
    expect(same.correctionPer100Eur).toBe(0)
    expect(same.currentPricePer100Eur).toBeCloseTo(20.89, 6)
  })
  it('MP < MPB esetén az ár csökken (negatív korrekció)', () => {
    const lower = calcPriceListItem(item, { ...params, currentMpEurPerKg: 2.0 })
    expect(lower.correctionPer100Eur).toBeLessThan(0)
    expect(lower.currentPricePer100Eur).toBeLessThan(20.89)
  })
})

describe('periodAverages', () => {
  const entries = [
    { date: '2026-01-05', eurPerKg: 2.3 },
    { date: '2026-02-10', eurPerKg: 2.5 },
    { date: '2026-03-20', eurPerKg: 2.7 },
    { date: '2026-04-02', eurPerKg: 3.0 },
    { date: '2026-11-11', eurPerKg: 2.0 },
  ]
  it('negyedéves átlagok: Q1 = (2,3+2,5+2,7)/3, Q2 = 3,0, Q4 = 2,0', () => {
    const q = periodAverages(entries, 'quarter')
    expect(q).toEqual([
      { label: '2026 Q1', avg: expect.closeTo(2.5, 6), count: 3 },
      { label: '2026 Q2', avg: expect.closeTo(3.0, 6), count: 1 },
      { label: '2026 Q4', avg: expect.closeTo(2.0, 6), count: 1 },
    ])
  })
  it('2 havi átlagok: Jan–Feb = 2,4; Már–Ápr = 2,85; Nov–Dec = 2,0', () => {
    const p = periodAverages(entries, 'twoMonth')
    expect(p).toEqual([
      { label: '2026 Jan–Feb', avg: expect.closeTo(2.4, 6), count: 2 },
      { label: '2026 Már–Ápr', avg: expect.closeTo(2.85, 6), count: 2 },
      { label: '2026 Nov–Dec', avg: expect.closeTo(2.0, 6), count: 1 },
    ])
  })
  it('üres lista → üres eredmény; érvénytelen dátum kimarad', () => {
    expect(periodAverages([], 'quarter')).toEqual([])
    expect(periodAverages([{ date: 'nem-datum', eurPerKg: 9 }], 'quarter')).toEqual([])
  })
})

describe('resolveItemSource — terméktörzs-kapcsolat', () => {
  const products = [
    { id: 'p1', customer: 'Ela Solutions Kft.', drawingNumber: '90ZA-B001-06', productName: 'zárbetét - 3mm', weightPerPiece: '14.85' },
    { id: 'p2', customer: 'Seidel Gmbh&co Kg', drawingNumber: 'M66', productName: 'RING ZAMAK 50 ML', weightPerPiece: 34 },
    { id: 'p3', customer: 'Systec Pos-Technology Gmbh', drawingNumber: 'M66', productName: 'Systec M66', weightPerPiece: '10.5' },
  ]
  const idx = buildProductIndex(products)

  it('egyező rajzszámnál a termék neve és súlya jön (élő kapcsolat)', () => {
    const r = resolveItemSource({ partNumber: '90ZA-B001-06', name: 'régi név', weightG: 99 }, 'Ela', idx)
    expect(r).toEqual({ name: 'zárbetét - 3mm', weightG: 14.85, linked: true, productId: 'p1' })
  })
  it('több jelöltnél a vevő-név dönt (rövid ↔ hosszú név)', () => {
    expect(resolveItemSource({ partNumber: 'M66' }, 'Seidel', idx).productId).toBe('p2')
    expect(resolveItemSource({ partNumber: 'm66 ' }, 'Systec', idx).productId).toBe('p3')
  })
  it('nincs egyezés → a tárolt érték marad (linked=false)', () => {
    const r = resolveItemSource({ partNumber: 'XYZ', name: 'tárolt', weightG: 5 }, 'Ela', idx)
    expect(r).toEqual({ name: 'tárolt', weightG: 5, linked: false })
  })
  it('hiányzó termék-súlynál a tárolt súly marad, de a név élő', () => {
    const idx2 = buildProductIndex([{ id: 'p4', drawingNumber: 'AAA', productName: 'név', weightPerPiece: '' }])
    const r = resolveItemSource({ partNumber: 'AAA', weightG: 7 }, 'Ela', idx2)
    expect(r).toEqual({ name: 'név', weightG: 7, linked: true, productId: 'p4' })
  })
})

describe('pricesForOrder — rendelés → árlista', () => {
  const priceLists = [{
    customerName: 'Ela',
    burnRate: 0.06, mpbEurPerKg: 2.33, currentMpEurPerKg: 3.435,
    items: [{ partNumber: '90ZA-B001-06', name: 'zárbetét', weightG: 14.85, basePricePer100Eur: 20.89 }],
  }]
  const idx = buildProductIndex([
    { id: 'p1', customer: 'Ela Solutions Kft.', drawingNumber: '90ZA-B001-06', productName: 'zárbetét - 3mm', weightPerPiece: '14.85' },
  ])
  it('aktuális darabár (0,226294) és munkadíj/db (0,172223, anyagár nélkül)', () => {
    const p = pricesForOrder(
      { customer: 'Ela Solutions Kft.', productName: '90ZA-B001-06' }, priceLists, idx)
    expect(p?.currentPerPiece).toBeCloseTo(0.226293805, 8)
    expect(p?.laborPerPiece).toBeCloseTo(0.1722235, 6)
  })
  it('nem egyező vevő vagy cikkszám → null', () => {
    expect(pricesForOrder({ customer: 'Seidel Gmbh', productName: '90ZA-B001-06' }, priceLists, idx)).toBeNull()
    expect(pricesForOrder({ customer: 'Ela Solutions Kft.', productName: 'XXX' }, priceLists, idx)).toBeNull()
  })
})
