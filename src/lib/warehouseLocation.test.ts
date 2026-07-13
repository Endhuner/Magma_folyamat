import { describe, it, expect } from 'vitest'
import {
  parseLocationCode,
  formatLocationCode,
  buildWarehouseIndex,
  occupiedBinCount,
  boxWidthPx,
  DEFAULT_RACKS,
} from './warehouseLocation'
import type { InventoryItem } from './types'

const mkItem = (p: Partial<InventoryItem>): InventoryItem =>
  ({
    id: 'i',
    productId: '',
    productName: '',
    drawingNumber: '',
    customer: '',
    quantity: 0,
    location: '',
    notes: '',
    lastUpdated: '',
    createdAt: '',
    ...p,
  }) as InventoryItem

describe('parseLocationCode', () => {
  it('parses canonical codes', () => {
    expect(parseLocationCode('A-2-3')).toEqual({ rackId: 'A', level: 2, bin: 3 })
    expect(parseLocationCode('SZ-1-12')).toEqual({ rackId: 'SZ', level: 1, bin: 12 })
  })
  it('tolerates whitespace and lowercase', () => {
    expect(parseLocationCode('  b - 1 - 4 ')).toEqual({ rackId: 'B', level: 1, bin: 4 })
  })
  it('rejects free text, empty, and zero indices', () => {
    expect(parseLocationCode('hátsó polc')).toBeNull()
    expect(parseLocationCode('')).toBeNull()
    expect(parseLocationCode(undefined)).toBeNull()
    expect(parseLocationCode('A-0-1')).toBeNull()
    expect(parseLocationCode('A-1')).toBeNull()
    expect(parseLocationCode('1-2-3')).toBeNull() // állvány-id betűvel kezdődik
  })
  it('round-trips with formatLocationCode', () => {
    const loc = parseLocationCode(formatLocationCode('a', 3, 4))!
    expect(loc).toEqual({ rackId: 'A', level: 3, bin: 4 })
  })
})

describe('buildWarehouseIndex', () => {
  const inventory = [
    mkItem({ id: '1', productName: 'T-100', location: 'A-1-1', quantity: 450 }),
    mkItem({ id: '2', productName: 'P-45', location: 'a-1-2', quantity: 1200 }),
    mkItem({ id: '3', productName: 'Szabad szöveges', location: 'hátsó sarok' }),
    mkItem({ id: '4', productName: 'Hely nélküli', location: '' }),
    mkItem({ id: '5', productName: 'Törölt állványon', location: 'X-1-1' }),
    mkItem({ id: '6', productName: 'Kiosztáson kívül', location: 'A-9-1' }), // A-nak csak 4 szintje van
  ]
  const idx = buildWarehouseIndex(inventory, DEFAULT_RACKS)

  it('places parseable items on their rack (case-insensitive)', () => {
    expect(idx.byRack.get('A')!.map((p) => p.item.id)).toEqual(['1', '2'])
  })
  it('collects free-text and empty locations as unplaced', () => {
    expect(idx.unplaced.map((i) => i.id).sort()).toEqual(['3', '4'])
  })
  it('collects codes pointing outside the configured racks as orphaned', () => {
    expect(idx.orphaned.map((p) => p.item.id).sort()).toEqual(['5', '6'])
  })
  it('counts occupied bins uniquely', () => {
    expect(occupiedBinCount(idx.byRack.get('A')!)).toBe(2)
  })
})

describe('boxWidthPx', () => {
  it('grows with quantity but stays clamped', () => {
    expect(boxWidthPx(0)).toBe(96)
    expect(boxWidthPx(9)).toBeGreaterThan(boxWidthPx(1))
    expect(boxWidthPx(100000)).toBe(260)
  })
})
