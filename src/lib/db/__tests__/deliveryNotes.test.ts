import { describe, it, expect, beforeEach } from 'vitest'
import { idbAvailable } from './_setup'
import { _resetDbForTests } from '../database'
import { deliveryNotesRepo } from '../repos'

const d = idbAvailable ? describe : describe.skip

function makeNote(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? 'delivery',
    sequenceNumber: overrides.sequenceNumber ?? 'SZ-2026-001',
    customer: overrides.customer ?? 'Acme',
    orderIds: overrides.orderIds ?? [],
    fileName: overrides.fileName ?? 'sz.html',
    exportDate: overrides.exportDate ?? '2026-04-01',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  } as any
}

d('deliveryNotesRepo — multi-entry index', () => {
  beforeEach(async () => {
    _resetDbForTests()
    const Dexie = (await import('dexie')).default
    await Dexie.delete('tir_db').catch(() => {})
  })

  it('byOrderId megtalálja a rendelést hivatkozó leveleket', async () => {
    await deliveryNotesRepo.saveMany([
      makeNote({ id: 'a', orderIds: ['o1', 'o2'] }),
      makeNote({ id: 'b', orderIds: ['o3'] }),
      makeNote({ id: 'c', orderIds: ['o2', 'o4'] }),
    ])

    const linkedToO2 = await deliveryNotesRepo.byOrderId('o2')
    expect(linkedToO2.length).toBe(2)
    expect(linkedToO2.map((n) => n.id).sort()).toEqual(['a', 'c'])

    const linkedToO3 = await deliveryNotesRepo.byOrderId('o3')
    expect(linkedToO3.length).toBe(1)
    expect(linkedToO3[0].id).toBe('b')
  })

  it('bySequenceNumber egyedi keresés', async () => {
    await deliveryNotesRepo.save(makeNote({ id: 'a', sequenceNumber: 'SZ-X-1' }))
    const found = await deliveryNotesRepo.bySequenceNumber('SZ-X-1')
    expect(found?.id).toBe('a')
  })

  it('byType szűr delivery / cmr-re', async () => {
    await deliveryNotesRepo.saveMany([
      makeNote({ id: 'a', type: 'delivery' }),
      makeNote({ id: 'b', type: 'cmr' }),
      makeNote({ id: 'c', type: 'delivery' }),
    ])
    const cmrs = await deliveryNotesRepo.byType('cmr')
    expect(cmrs.length).toBe(1)
    expect(cmrs[0].id).toBe('b')
  })
})
