import { describe, it, expect, beforeEach } from 'vitest'
import { idbAvailable } from './_setup'
import { _resetDbForTests } from '../database'
import { ordersRepo } from '../repos'

const d = idbAvailable ? describe : describe.skip

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? crypto.randomUUID(),
    orderNumber: overrides.orderNumber ?? 'ORD-001',
    ownOrderNumber: overrides.ownOrderNumber ?? 'OWN-001',
    customer: overrides.customer ?? 'Acme',
    productName: overrides.productName ?? 'Test Product',
    quantity: overrides.quantity ?? 100,
    status: overrides.status ?? 'Új',
    orderDate: overrides.orderDate ?? '2026-01-15',
    requiredDate: overrides.requiredDate ?? '2026-02-15',
    notes: overrides.notes ?? '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  } as any
}

d('ordersRepo', () => {
  beforeEach(async () => {
    _resetDbForTests()
    // Reset by deleting the database from a fresh handle.
    const Dexie = (await import('dexie')).default
    await Dexie.delete('tir_db').catch(() => {})
  })

  it('starts empty', async () => {
    const list = await ordersRepo.list()
    expect(list).toEqual([])
    expect(await ordersRepo.count()).toBe(0)
  })

  it('save and getById round-trip', async () => {
    const o = makeOrder({ id: 'o1' })
    await ordersRepo.save(o)
    const back = await ordersRepo.getById('o1')
    expect(back?.id).toBe('o1')
    expect(back?.customer).toBe('Acme')
  })

  it('saveMany and list returns all', async () => {
    const items = [
      makeOrder({ id: 'a', customer: 'A' }),
      makeOrder({ id: 'b', customer: 'B' }),
      makeOrder({ id: 'c', customer: 'A' }),
    ]
    await ordersRepo.saveMany(items)
    const list = await ordersRepo.list()
    expect(list.length).toBe(3)
  })

  it('byCustomer uses index', async () => {
    await ordersRepo.saveMany([
      makeOrder({ id: 'a', customer: 'Acme' }),
      makeOrder({ id: 'b', customer: 'Globex' }),
      makeOrder({ id: 'c', customer: 'Acme' }),
    ])
    const acme = await ordersRepo.byCustomer('Acme')
    expect(acme.length).toBe(2)
    expect(acme.every((o) => o.customer === 'Acme')).toBe(true)
  })

  it('byStatus filters correctly', async () => {
    await ordersRepo.saveMany([
      makeOrder({ id: 'a', status: 'Új' }),
      makeOrder({ id: 'b', status: 'Folyamatban' }),
      makeOrder({ id: 'c', status: 'Új' }),
    ])
    const newOnes = await ordersRepo.byStatus('Új')
    expect(newOnes.length).toBe(2)
  })

  it('byOwnOrderNumber returns single match', async () => {
    await ordersRepo.saveMany([
      makeOrder({ id: 'a', ownOrderNumber: 'M-001' }),
      makeOrder({ id: 'b', ownOrderNumber: 'M-002' }),
    ])
    const found = await ordersRepo.byOwnOrderNumber('M-002')
    expect(found?.id).toBe('b')
  })

  it('delete removes the record', async () => {
    await ordersRepo.save(makeOrder({ id: 'x' }))
    await ordersRepo.delete('x')
    expect(await ordersRepo.getById('x')).toBeUndefined()
  })

  it('deleteMany removes multiple', async () => {
    await ordersRepo.saveMany([
      makeOrder({ id: 'a' }),
      makeOrder({ id: 'b' }),
      makeOrder({ id: 'c' }),
    ])
    await ordersRepo.deleteMany(['a', 'b'])
    const remaining = await ordersRepo.list()
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe('c')
  })
})
