import { describe, it, expect } from 'vitest'
import {
  stripDiacritics,
  isDelivered,
  parseIntSafe,
  parseFloatSafe,
  parseYear,
  formatDate,
  isOverdue,
  generateOwnOrderNumber,
  generateDeliveryNoteSequenceNumber,
  calculateDashboardMetrics,
} from './helpers'
import type { Order } from './types'

describe('stripDiacritics', () => {
  it('lowercases and removes Hungarian accents', () => {
    expect(stripDiacritics('Árvíztűrő Tükörfúrógép')).toBe('arvizturo tukorfurogep')
  })
  it('handles undefined and null safely', () => {
    expect(stripDiacritics(undefined)).toBe('')
    expect(stripDiacritics(null)).toBe('')
  })
  it('trims whitespace', () => {
    expect(stripDiacritics('  Tűzoltó  ')).toBe('tuzolto')
  })
})

describe('isDelivered', () => {
  it('matches exact "Kiszállítva"', () => {
    expect(isDelivered('Kiszállítva')).toBe(true)
  })
  it('is accent-insensitive', () => {
    expect(isDelivered('kiszallitva')).toBe(true)
  })
  it('matches when "kiszallitva" is included', () => {
    expect(isDelivered('Részben kiszállítva')).toBe(true)
  })
  it('returns false for other statuses', () => {
    expect(isDelivered('Folyamatban')).toBe(false)
    expect(isDelivered('Felvéve')).toBe(false)
  })
})

describe('parseIntSafe', () => {
  it('parses simple integers', () => {
    expect(parseIntSafe('42')).toBe(42)
  })
  it('parses Hungarian decimal commas (truncated)', () => {
    expect(parseIntSafe('12,5')).toBe(12)
  })
  it('strips thousand separators (spaces)', () => {
    expect(parseIntSafe('1 500')).toBe(1500)
  })
  it('falls back on invalid input', () => {
    expect(parseIntSafe('abc', 99)).toBe(99)
  })
  it('falls back on NaN/Infinity', () => {
    expect(parseIntSafe(NaN, 7)).toBe(7)
    expect(parseIntSafe(Infinity, 7)).toBe(7)
  })
  it('respects allowNegative option', () => {
    expect(parseIntSafe('-10', 0, { allowNegative: false })).toBe(0)
    expect(parseIntSafe('-10', 0, { allowNegative: true })).toBe(-10)
  })
  it('handles empty/null/undefined', () => {
    expect(parseIntSafe('', 5)).toBe(5)
    expect(parseIntSafe(null, 5)).toBe(5)
    expect(parseIntSafe(undefined, 5)).toBe(5)
  })
})

describe('parseFloatSafe', () => {
  it('parses decimal commas', () => {
    expect(parseFloatSafe('12,5')).toBe(12.5)
  })
  it('parses decimal points', () => {
    expect(parseFloatSafe('12.75')).toBe(12.75)
  })
  it('respects allowNegative', () => {
    expect(parseFloatSafe('-1.5', 0, { allowNegative: false })).toBe(0)
  })
  it('falls back on bad input', () => {
    expect(parseFloatSafe('xyz', 0)).toBe(0)
  })
})

describe('parseYear', () => {
  it('extracts year from yyyy/MM/dd', () => {
    expect(parseYear('2024/05/12')).toBe(2024)
  })
  it('extracts year from MM/dd/yyyy', () => {
    expect(parseYear('05/12/2024')).toBe(2024)
  })
  it('falls back to first 4-digit year in string', () => {
    expect(parseYear('valami 2023 valami')).toBe(2023)
  })
  it('returns null for empty input', () => {
    expect(parseYear('')).toBeNull()
  })
})

describe('formatDate', () => {
  it('returns yyyy/MM/dd format', () => {
    expect(formatDate('2024-05-12T10:30:00Z')).toMatch(/^\d{4}\/\d{2}\/\d{2}$/)
  })
  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('')
  })
})

describe('isOverdue', () => {
  it('returns false when delivered', () => {
    expect(isOverdue('2000-01-01', 'Kiszállítva')).toBe(false)
  })
  it('returns true for past date and non-delivered status', () => {
    expect(isOverdue('2000-01-01', 'Folyamatban')).toBe(true)
  })
  it('returns false for future date', () => {
    expect(isOverdue('2099-01-01', 'Folyamatban')).toBe(false)
  })
  it('returns false on missing date', () => {
    expect(isOverdue('', 'Folyamatban')).toBe(false)
  })
})

describe('generateOwnOrderNumber', () => {
  it('returns first sequence with proper prefix on empty list', () => {
    const r = generateOwnOrderNumber([])
    const yy = String(new Date().getFullYear()).slice(-2)
    expect(r).toBe(`M${yy}11`)
  })
  it('increments sequence based on existing orders', () => {
    const yy = String(new Date().getFullYear()).slice(-2)
    const orders = [
      { ownOrderNumber: `M${yy}11` },
      { ownOrderNumber: `M${yy}1002` },
      { ownOrderNumber: `M${yy}1015` },
    ]
    const r = generateOwnOrderNumber(orders)
    expect(r).toBe(`M${yy}1016`)
  })
  it('ignores other-year prefixes', () => {
    const yy = String(new Date().getFullYear()).slice(-2)
    const orders = [
      { ownOrderNumber: 'M99999' },
      { ownOrderNumber: 'X12345' },
    ]
    const r = generateOwnOrderNumber(orders)
    expect(r).toBe(`M${yy}11`)
  })
})

describe('generateDeliveryNoteSequenceNumber', () => {
  it('starts at SZL0001 with empty list', () => {
    expect(generateDeliveryNoteSequenceNumber([], 'delivery')).toBe('SZL0001')
  })
  it('starts at CMR0001 for cmr type', () => {
    expect(generateDeliveryNoteSequenceNumber([], 'cmr')).toBe('CMR0001')
  })
  it('increments based on existing same-type notes', () => {
    const notes = [
      { sequenceNumber: 'SZL0007', type: 'delivery' },
      { sequenceNumber: 'CMR0099', type: 'cmr' },
    ]
    expect(generateDeliveryNoteSequenceNumber(notes, 'delivery')).toBe('SZL0008')
    expect(generateDeliveryNoteSequenceNumber(notes, 'cmr')).toBe('CMR0100')
  })
})

describe('calculateDashboardMetrics', () => {
  it('counts statuses correctly', () => {
    const orders: Partial<Order>[] = [
      { status: 'Felvéve' },
      { status: 'Felvéve' },
      { status: 'Folyamatban' },
      { status: 'Kiszállítva' },
      { status: 'Folyamatban', ready: 'x' },
      { status: 'Folyamatban', invoiced: 'X' },
    ]
    const m = calculateDashboardMetrics(orders as Order[])
    expect(m.totalOrders).toBe(6)
    expect(m.pendingOrders).toBe(2)
    expect(m.inProductionOrders).toBe(3)
    expect(m.readyForDeliveryOrders).toBe(1)
    expect(m.deliveredOrders).toBe(1)
    expect(m.invoicedOrders).toBe(1)
  })
})
