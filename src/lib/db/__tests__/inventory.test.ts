import { describe, it, expect, beforeEach } from 'vitest'
import { idbAvailable } from './_setup'
import { _resetDbForTests } from '../database'
import { inventoryRepo, inventoryTransactionsRepo } from '../repos'

const d = idbAvailable ? describe : describe.skip

function makeItem(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? crypto.randomUUID(),
    productId: overrides.productId ?? 'p1',
    productName: overrides.productName ?? 'Test',
    drawingNumber: overrides.drawingNumber ?? 'DR-001',
    customer: overrides.customer ?? 'Acme',
    quantity: overrides.quantity ?? 100,
    location: overrides.location ?? '',
    notes: overrides.notes ?? '',
    lastUpdated: overrides.lastUpdated ?? now,
    createdAt: overrides.createdAt ?? now,
    ...overrides,
  } as any
}

d('inventoryRepo — atomi tranzakciók', () => {
  beforeEach(async () => {
    _resetDbForTests()
    const Dexie = (await import('dexie')).default
    await Dexie.delete('tir_db').catch(() => {})
  })

  it('deductTx csökkenti a mennyiséget és logot ír', async () => {
    await inventoryRepo.save(makeItem({ id: 'inv1', quantity: 50 }))

    const result = await inventoryRepo.deductTx({
      inventoryItemId: 'inv1',
      quantity: 10,
      orderId: 'o1',
      notes: 'kiszállítás',
    })

    expect(result.item.quantity).toBe(40)
    expect(result.transaction.type).toBe('out')
    expect(result.transaction.quantity).toBe(10)

    const reread = await inventoryRepo.getById('inv1')
    expect(reread?.quantity).toBe(40)

    const txs = await inventoryTransactionsRepo.byInventoryItem('inv1')
    expect(txs.length).toBe(1)
    expect(txs[0].type).toBe('out')
  })

  it('deductTx visszadob hibát, ha nincs elég készlet', async () => {
    await inventoryRepo.save(makeItem({ id: 'inv1', quantity: 5 }))

    await expect(
      inventoryRepo.deductTx({ inventoryItemId: 'inv1', quantity: 10 })
    ).rejects.toThrow(/Nincs elegendő/)

    // Az eredeti mennyiség nem változott — atomi rollback.
    const reread = await inventoryRepo.getById('inv1')
    expect(reread?.quantity).toBe(5)
    const txs = await inventoryTransactionsRepo.byInventoryItem('inv1')
    expect(txs.length).toBe(0)
  })

  it('deductTx visszadob hibát ismeretlen tételre', async () => {
    await expect(
      inventoryRepo.deductTx({ inventoryItemId: 'nope', quantity: 1 })
    ).rejects.toThrow(/nem található/)
  })

  it('deductTx párhuzamos hívások szériában futnak (tranzakció)', async () => {
    await inventoryRepo.save(makeItem({ id: 'inv1', quantity: 30 }))

    const promises = [
      inventoryRepo.deductTx({ inventoryItemId: 'inv1', quantity: 10 }),
      inventoryRepo.deductTx({ inventoryItemId: 'inv1', quantity: 10 }),
      inventoryRepo.deductTx({ inventoryItemId: 'inv1', quantity: 10 }),
    ]
    await Promise.all(promises)

    const reread = await inventoryRepo.getById('inv1')
    expect(reread?.quantity).toBe(0)
    const txs = await inventoryTransactionsRepo.byInventoryItem('inv1')
    expect(txs.length).toBe(3)
    expect(txs.reduce((a, t) => a + t.quantity, 0)).toBe(30)
  })

  it('addTx növeli a mennyiséget', async () => {
    await inventoryRepo.save(makeItem({ id: 'inv1', quantity: 10 }))
    const r = await inventoryRepo.addTx({ inventoryItemId: 'inv1', quantity: 25 })
    expect(r.item.quantity).toBe(35)
    expect(r.transaction.type).toBe('in')
  })

  it('byCustomerAndDrawing összetett indexszel keres', async () => {
    await inventoryRepo.saveMany([
      makeItem({ id: 'a', customer: 'Acme', drawingNumber: 'DR-1' }),
      makeItem({ id: 'b', customer: 'Acme', drawingNumber: 'DR-2' }),
      makeItem({ id: 'c', customer: 'Globex', drawingNumber: 'DR-1' }),
    ])
    const r = await inventoryRepo.byCustomerAndDrawing('Acme', 'DR-1')
    expect(r.length).toBe(1)
    expect(r[0].id).toBe('a')
  })

  it('deductTx negatív mennyiséget elutasít', async () => {
    await inventoryRepo.save(makeItem({ id: 'inv1', quantity: 10 }))
    await expect(
      inventoryRepo.deductTx({ inventoryItemId: 'inv1', quantity: 0 })
    ).rejects.toThrow(/pozitív/)
    await expect(
      inventoryRepo.deductTx({ inventoryItemId: 'inv1', quantity: -5 })
    ).rejects.toThrow(/pozitív/)
  })
})
