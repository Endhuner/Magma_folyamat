import { describe, it, expect } from 'vitest'
import {
  diffObjects,
  entityLabelFor,
  actionLabelFor,
  fieldLabelFor,
  buildAuditEntry,
  pruneAuditLog,
  AUDIT_LOG_MAX_ENTRIES,
  displayValue,
} from './auditLog'
import type { AuditLogEntry } from './types'

describe('diffObjects', () => {
  it('detects changed fields', () => {
    const r = diffObjects({ a: 1, b: 2 }, { a: 1, b: 3 })
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ field: 'b', before: 2, after: 3 })
  })
  it('ignores `updatedAt` by default', () => {
    const r = diffObjects(
      { a: 1, updatedAt: '2024-01-01' },
      { a: 1, updatedAt: '2024-12-31' }
    )
    expect(r).toHaveLength(0)
  })
  it('treats null and undefined as equal', () => {
    const r = diffObjects({ a: null }, { a: undefined })
    expect(r).toHaveLength(0)
  })
  it('treats "0" and 0 as equal (number-string fuzziness)', () => {
    const r = diffObjects({ a: '0' }, { a: 0 })
    expect(r).toHaveLength(0)
  })
  it('handles missing keys in either side', () => {
    const r = diffObjects({ a: 1 }, { a: 1, b: 2 })
    expect(r).toEqual([{ field: 'b', before: undefined, after: 2 }])
  })
  it('respects custom ignore list', () => {
    const r = diffObjects({ a: 1, b: 2 }, { a: 9, b: 9 }, ['a'])
    expect(r).toEqual([{ field: 'b', before: 2, after: 9 }])
  })
})

describe('entityLabelFor / actionLabelFor', () => {
  it('returns Hungarian labels for entities', () => {
    expect(entityLabelFor('order')).toBe('Rendelés')
    expect(entityLabelFor('inventory')).toBe('Készlet')
  })
  it('returns Hungarian labels for actions', () => {
    expect(actionLabelFor('create')).toBe('Létrehozás')
    expect(actionLabelFor('bulkDelete')).toBe('Csoportos törlés')
  })
})

describe('fieldLabelFor', () => {
  it('returns Hungarian label for known fields', () => {
    expect(fieldLabelFor('order', 'customer')).toBe('Vevő')
    expect(fieldLabelFor('order', 'amountPc')).toBe('Mennyiség (db)')
  })
  it('falls back to raw field name when unknown', () => {
    expect(fieldLabelFor('order', 'someUnknownField')).toBe('someUnknownField')
  })
})

describe('buildAuditEntry', () => {
  it('fills id and createdAt automatically', () => {
    const e = buildAuditEntry({
      action: 'create',
      entityType: 'order',
      entityId: 'o1',
      entityLabel: 'Rendelés',
      entityName: '#1',
      changes: [],
    })
    expect(e.id).toMatch(/^audit-\d+-\d+$/)
    expect(e.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('pruneAuditLog', () => {
  const mk = (i: number): AuditLogEntry =>
    ({
      id: `e-${i}`,
      createdAt: new Date(2024, 0, 1, 0, 0, i).toISOString(),
      action: 'create',
      entityType: 'order',
      entityId: 'o',
      entityLabel: '',
      entityName: '',
      changes: [],
    }) as AuditLogEntry
  it('returns the same reference when under cap', () => {
    const arr = [mk(1), mk(2)]
    expect(pruneAuditLog(arr, 10)).toBe(arr)
  })
  it('keeps only the most recent N entries', () => {
    const arr = Array.from({ length: 15 }, (_, i) => mk(i))
    const r = pruneAuditLog(arr, 5)
    expect(r).toHaveLength(5)
    expect(r.map((e) => e.id).sort()).toEqual(['e-10', 'e-11', 'e-12', 'e-13', 'e-14'].sort())
  })
  it('handles null/undefined input', () => {
    expect(pruneAuditLog(null)).toEqual([])
    expect(pruneAuditLog(undefined)).toEqual([])
  })
  it('uses AUDIT_LOG_MAX_ENTRIES as default', () => {
    expect(AUDIT_LOG_MAX_ENTRIES).toBe(10000)
  })
})

describe('displayValue', () => {
  it('formats null/undefined/empty as em-dash', () => {
    expect(displayValue(null)).toBe('—')
    expect(displayValue(undefined)).toBe('—')
    expect(displayValue('')).toBe('—')
  })
  it('formats booleans in Hungarian', () => {
    expect(displayValue(true)).toBe('Igen')
    expect(displayValue(false)).toBe('Nem')
  })
  it('truncates long strings', () => {
    const long = 'x'.repeat(200)
    expect(displayValue(long).endsWith('…')).toBe(true)
    expect(displayValue(long).length).toBeLessThanOrEqual(80)
  })
})
