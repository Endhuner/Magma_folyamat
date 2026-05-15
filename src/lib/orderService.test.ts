import { describe, it, expect } from 'vitest'
import {
  computeBoxesCount,
  computePalletsCount,
  computeRequiredMaterialKg,
  computeGrossWeightKg,
  computePlannedProductionHours,
  computeAutoFieldsForOrder,
} from './orderService'
import type { Product } from './types'

describe('computeBoxesCount', () => {
  it('rounds up: 100 db / 30 db/doboz = 4 doboz', () => {
    expect(computeBoxesCount(100, '30')).toBe(4)
  })
  it('exact division', () => {
    expect(computeBoxesCount(120, '30')).toBe(4)
  })
  it('returns null on missing inputs', () => {
    expect(computeBoxesCount(100, '')).toBeNull()
    expect(computeBoxesCount(100, '0')).toBeNull()
  })
})

describe('computePalletsCount', () => {
  it('rounds up boxes per pallet', () => {
    expect(computePalletsCount(10, '4')).toBe(3)
  })
  it('returns null on missing pallet capacity', () => {
    expect(computePalletsCount(10, '')).toBeNull()
  })
})

describe('computeRequiredMaterialKg', () => {
  it('formats with "kg" suffix and 1 decimal', () => {
    // 1000 db × 50 g = 50_000 g = 50.0 kg
    expect(computeRequiredMaterialKg(1000, '50')).toBe('50.0 kg')
  })
  it('returns empty string when weight missing', () => {
    expect(computeRequiredMaterialKg(1000, '')).toBe('')
  })
})

describe('computeGrossWeightKg', () => {
  it('adds pallet tare (20 kg per pallet)', () => {
    // 1000 × 50g = 50 kg + 2 raklap × 20 kg = 90 kg
    expect(computeGrossWeightKg(1000, '50', 2)).toBe('90.0 kg')
  })
  it('handles zero pallets', () => {
    expect(computeGrossWeightKg(1000, '50', 0)).toBe('50.0 kg')
  })
})

describe('computePlannedProductionHours', () => {
  it('uses cycle-time × amount / fészekszám, returns whole hours', () => {
    // 120 db × 60s / 2 fészek = 3600s = 1 óra
    expect(computePlannedProductionHours(120, 0, '60', '2')).toBe('1 óra')
  })
  it('fészekszám=1 esetén ugyanaz mint korábban', () => {
    // 3600 db × 1s / 1 fészek = 3600s = 1 óra
    expect(computePlannedProductionHours(3600, 0, '1', '1')).toBe('1 óra')
  })
  it('returns empty when cycle time missing', () => {
    expect(computePlannedProductionHours(60, 0, '')).toBe('')
  })
})

describe('computeAutoFieldsForOrder', () => {
  const products: Product[] = [
    {
      id: 'p1',
      customer: 'A',
      productName: 'Widget',
      drawingNumber: 'W-1',
      piecesPerBox: '30',
      boxesPerPallet: '20',
      weightPerPiece: '50',
      cycleTime: '60',
      surfaceTreatment: 'galv',
      material: 'PA6',
    } as Product,
  ]
  it('returns blank fields when no product match', () => {
    const r = computeAutoFieldsForOrder('Z', 'X', 100, products)
    expect(r.surfaceTreatment).toBe('')
    expect(r.material).toBe('')
    expect(r.boxesCount).toBeNull()
  })
  it('computes derived fields from matched product', () => {
    const r = computeAutoFieldsForOrder('A', 'Widget', 600, products)
    expect(r.surfaceTreatment).toBe('galv')
    expect(r.material).toBe('PA6')
    expect(r.boxesCount).toBe(20)
    expect(r.palletsCount).toBe(1)
    expect(r.requiredMaterialKg).toBe('30.0 kg') // 600 × 50g = 30 kg
  })
  it('matches by drawing number too', () => {
    const r = computeAutoFieldsForOrder('A', 'W-1', 100, products)
    expect(r.material).toBe('PA6')
  })
})
