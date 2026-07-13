import { describe, it, expect } from 'vitest'
import { detectMissingShifts } from './shiftValidation'
import type { Order, ProductionShift } from './types'

const mkOrder = (p: Partial<Order>): Order =>
  ({
    id: 'o1',
    customer: 'A',
    productName: 'X',
    status: 'Folyamatban',
    ...p,
  }) as Order

const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('detectMissingShifts', () => {
  // A gyártás 10 napja indult, egyetlen műszak van rögzítve → a 7 napos
  // visszatekintés minden munkanapjára hiányt jelez.
  const orders = [mkOrder({})]
  const shifts: ProductionShift[] = [
    { id: 's1', orderId: 'o1', date: daysAgo(10), shift: 'de' } as ProductionShift,
  ]

  it('does not flag weekend days by default', () => {
    const missing = detectMissingShifts(orders, shifts)
    for (const m of missing) {
      const dow = new Date(m.date).getDay()
      expect(dow).not.toBe(0) // vasárnap
      expect(dow).not.toBe(6) // szombat
    }
  })

  it('does not flag Hungarian holidays by default', () => {
    // A magyar munkaszüneti napok (pl. ünnepek) nem lehetnek a hiánylistán.
    const missing = detectMissingShifts(orders, shifts)
    const flaggedDates = new Set(missing.map((m) => m.date))
    // 2025 fix ünnepek — ha a 7 napos ablak érinti valamelyiket, nem szabad jeleznie.
    for (const holiday of ['2025-08-20', '2025-03-15', '2025-05-01']) {
      expect(flaggedDates.has(holiday)).toBe(false)
    }
  })

  it('flags weekends too when includeWeekends is set', () => {
    const missing = detectMissingShifts(orders, shifts, { includeWeekends: true })
    // 7 nap × 2 műszak = 14 hiány (a gyártás indulása előtti napok nem számítanak,
    // de itt 10 napja indult, így mind a 7 nap érintett)
    expect(missing.length).toBe(14)
  })

  it('reports nothing for orders with no shifts at all (production not started)', () => {
    const missing = detectMissingShifts([mkOrder({ id: 'o9' })], [])
    expect(missing).toHaveLength(0)
  })
})
