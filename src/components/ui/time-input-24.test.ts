import { describe, expect, it } from 'vitest'
import { normalizeTime24 } from './time-input-24'

describe('normalizeTime24', () => {
  it('rugalmas bevitel → HH:MM', () => {
    expect(normalizeTime24('8')).toBe('08:00')
    expect(normalizeTime24('18')).toBe('18:00')
    expect(normalizeTime24('830')).toBe('08:30')
    expect(normalizeTime24('1830')).toBe('18:30')
    expect(normalizeTime24('8:00')).toBe('08:00')
    expect(normalizeTime24('06:30')).toBe('06:30')
  })
  it('tartomány-vágás 23:59-re', () => {
    expect(normalizeTime24('9999')).toBe('23:59')
    expect(normalizeTime24('2560')).toBe('23:59')
  })
  it('üres marad üres', () => {
    expect(normalizeTime24('')).toBe('')
    expect(normalizeTime24('--:--')).toBe('')
  })
})
