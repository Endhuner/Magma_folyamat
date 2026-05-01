import { describe, it, expect, beforeEach } from 'vitest'
import { idbAvailable } from './_setup'
import { _resetDbForTests } from '../database'
import { auditLogRepo } from '../repos'

const d = idbAvailable ? describe : describe.skip

function makeEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    entityType: overrides.entityType ?? 'order',
    entityLabel: overrides.entityLabel ?? 'Rendelés',
    entityId: overrides.entityId ?? 'oid-1',
    entityName: overrides.entityName ?? 'ORD-001',
    action: overrides.action ?? 'create',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  } as any
}

d('auditLogRepo', () => {
  beforeEach(async () => {
    _resetDbForTests()
    const Dexie = (await import('dexie')).default
    await Dexie.delete('tir_db').catch(() => {})
  })

  it('byEntity — összetett index, fordított időrend', async () => {
    await auditLogRepo.saveMany([
      makeEntry({ id: 'a', entityType: 'order', entityId: 'X', createdAt: '2026-01-01T00:00:00Z' }),
      makeEntry({ id: 'b', entityType: 'order', entityId: 'X', createdAt: '2026-01-02T00:00:00Z' }),
      makeEntry({ id: 'c', entityType: 'order', entityId: 'Y', createdAt: '2026-01-02T00:00:00Z' }),
    ])
    const list = await auditLogRepo.byEntity('order', 'X')
    expect(list.length).toBe(2)
    expect(list[0].id).toBe('b') // legfrissebb elöl
    expect(list[1].id).toBe('a')
  })

  it('listPaged limit + offset', async () => {
    const now = Date.now()
    const entries = Array.from({ length: 25 }, (_, i) =>
      makeEntry({
        id: `e${i}`,
        createdAt: new Date(now - (25 - i) * 1000).toISOString(),
      })
    )
    await auditLogRepo.saveMany(entries)

    const page1 = await auditLogRepo.listPaged({ limit: 10 })
    expect(page1.length).toBe(10)
    // Legfrissebbek elöl — fordított időrendben e24, e23, ...
    expect(page1[0].id).toBe('e24')

    const page2 = await auditLogRepo.listPaged({ limit: 10, offset: 10 })
    expect(page2.length).toBe(10)
    expect(page2[0].id).toBe('e14')
  })

  it('listPaged szűréssel entityType-ra', async () => {
    await auditLogRepo.saveMany([
      makeEntry({ id: 'a', entityType: 'order' }),
      makeEntry({ id: 'b', entityType: 'product' }),
      makeEntry({ id: 'c', entityType: 'order' }),
    ])
    const orders = await auditLogRepo.listPaged({ entityType: 'order' })
    expect(orders.length).toBe(2)
  })

  it('pruneOlderThan törli a régi sorokat', async () => {
    await auditLogRepo.saveMany([
      makeEntry({ id: 'old', createdAt: '2020-01-01T00:00:00Z' }),
      makeEntry({ id: 'mid', createdAt: '2024-01-01T00:00:00Z' }),
      makeEntry({ id: 'new', createdAt: '2026-01-01T00:00:00Z' }),
    ])
    const deleted = await auditLogRepo.pruneOlderThan('2025-01-01T00:00:00Z')
    expect(deleted).toBe(2)
    const left = await auditLogRepo.list()
    expect(left.length).toBe(1)
    expect(left[0].id).toBe('new')
  })
})
