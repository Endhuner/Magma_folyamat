import { describe, it, expect, beforeEach } from 'vitest'
import { idbAvailable } from './_setup'
import { _resetDbForTests } from '../database'
import { productsRepo } from '../repos'

const d = idbAvailable ? describe : describe.skip

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? crypto.randomUUID(),
    customer: overrides.customer ?? 'Acme',
    productName: overrides.productName ?? 'Test',
    drawingNumber: overrides.drawingNumber ?? 'DR-001',
    nestCount: overrides.nestCount ?? '2',
    autoUpdateInventory: overrides.autoUpdateInventory ?? false,
    notes: overrides.notes ?? '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  } as any
}

d('productsRepo', () => {
  beforeEach(async () => {
    _resetDbForTests()
    const Dexie = (await import('dexie')).default
    await Dexie.delete('tir_db').catch(() => {})
  })

  it('byCustomerAndDrawing — összetett index, egyedi találat', async () => {
    await productsRepo.saveMany([
      makeProduct({ id: 'a', customer: 'Acme', drawingNumber: 'DR-1' }),
      makeProduct({ id: 'b', customer: 'Acme', drawingNumber: 'DR-2' }),
      makeProduct({ id: 'c', customer: 'Globex', drawingNumber: 'DR-1' }),
    ])
    const found = await productsRepo.byCustomerAndDrawing('Acme', 'DR-2')
    expect(found?.id).toBe('b')

    const notFound = await productsRepo.byCustomerAndDrawing('Acme', 'DR-9')
    expect(notFound).toBeUndefined()
  })

  it('byCustomer minden vevői termék', async () => {
    await productsRepo.saveMany([
      makeProduct({ id: 'a', customer: 'Acme' }),
      makeProduct({ id: 'b', customer: 'Acme' }),
      makeProduct({ id: 'c', customer: 'Globex' }),
    ])
    const acme = await productsRepo.byCustomer('Acme')
    expect(acme.length).toBe(2)
  })

  it('byDrawingNumber — minden vevő ugyanazon rajzszám alatt', async () => {
    await productsRepo.saveMany([
      makeProduct({ id: 'a', customer: 'Acme', drawingNumber: 'DR-X' }),
      makeProduct({ id: 'b', customer: 'Globex', drawingNumber: 'DR-X' }),
      makeProduct({ id: 'c', customer: 'Acme', drawingNumber: 'DR-Y' }),
    ])
    const dx = await productsRepo.byDrawingNumber('DR-X')
    expect(dx.length).toBe(2)
  })
})
