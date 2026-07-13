import { describe, it, expect } from 'vitest'
import {
  materialNameMatches,
  shotConsumptionKg,
  computeConsumptionKg,
  type ProductLike,
  type OrderLike,
  type ShiftLike,
} from '@produktivpro/shared'

const product = (p: Partial<ProductLike>): ProductLike => ({
  id: 'p1',
  customer: 'A',
  productName: 'Tengely',
  drawingNumber: 'T-100',
  material: 'Z410',
  nestCount: '4',
  weightPerPiece: '25', // gramm
  spruWeight: '10', // gramm
  ...p,
})

describe('materialNameMatches', () => {
  it('matches identical and containing names, case/accent-insensitive', () => {
    expect(materialNameMatches('Z410', 'Z410')).toBe(true)
    expect(materialNameMatches('Z410 tömb', 'z410')).toBe(true)
    expect(materialNameMatches('MŰANYAG granulátum', 'műanyag')).toBe(true)
  })
  it('does not match unrelated or too-short values', () => {
    expect(materialNameMatches('Z410', 'zamak')).toBe(false)
    expect(materialNameMatches('Z', 'Z410')).toBe(false)
    expect(materialNameMatches('Z410', '')).toBe(false)
  })
})

describe('shotConsumptionKg', () => {
  it('lövés × (fészek × darabsúly + beömlő) / 1000', () => {
    // 100 lövés × (4 × 25 g + 10 g) = 100 × 110 g = 11 kg
    expect(shotConsumptionKg(product({}), 100)).toBe(11)
  })
  it('hiányzó fészekszám = 1, hiányzó beömlő = 0', () => {
    expect(shotConsumptionKg(product({ nestCount: '', spruWeight: '' }), 100)).toBe(2.5)
  })
  it('magyar tizedesvessző a darabsúlyban', () => {
    expect(shotConsumptionKg(product({ weightPerPiece: '2,5', nestCount: '2', spruWeight: '' }), 1000)).toBe(5)
  })
  it('0 vagy negatív lövés = 0', () => {
    expect(shotConsumptionKg(product({}), 0)).toBe(0)
  })
})

describe('computeConsumptionKg', () => {
  const products: ProductLike[] = [
    product({ id: 'p1', material: 'Z410' }),
    product({ id: 'p2', material: 'Műanyag', weightPerPiece: '10', nestCount: '1', spruWeight: '0' }),
  ]
  const orders: OrderLike[] = [
    { id: 'o1', productId: 'p1', customer: 'A', productName: 'T-100', designation: 'Tengely' },
    { id: 'o2', productId: 'p2', customer: 'A', productName: 'M-1', designation: 'Műanyag alkatrész' },
  ]
  const shifts: ShiftLike[] = [
    { orderId: 'o1', date: '2026-07-01', shotsCount: 100 }, // Z410: 11 kg
    { orderId: 'o1', date: '2026-07-03', shotsCount: 200 }, // Z410: 22 kg
    { orderId: 'o2', date: '2026-07-02', shotsCount: 500 }, // Műanyag: 5 kg
    { orderId: 'ismeretlen', date: '2026-07-02', shotsCount: 999 }, // nincs rendelés → kihagyva
  ]

  it('csak a párosított anyag műszakjait összegzi', () => {
    expect(computeConsumptionKg('Z410', shifts, orders, products)).toBe(33)
    expect(computeConsumptionKg('Műanyag', shifts, orders, products)).toBe(5)
  })
  it('afterDate/beforeDate szűrés (könyvelési ablak)', () => {
    expect(computeConsumptionKg('Z410', shifts, orders, products, { afterDate: '2026-07-01' })).toBe(22)
    expect(computeConsumptionKg('Z410', shifts, orders, products, { beforeDate: '2026-07-03' })).toBe(11)
    expect(
      computeConsumptionKg('Z410', shifts, orders, products, { afterDate: '2026-07-03' })
    ).toBe(0)
  })
  it('nem párosítható anyagnál 0', () => {
    expect(computeConsumptionKg('acél', shifts, orders, products)).toBe(0)
  })
})
