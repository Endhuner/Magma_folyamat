import { describe, it, expect } from 'vitest'
import { orderUpdateSchema } from '@produktivpro/shared'
import type { OrderStatus } from '@/lib/types'

// A szerver Zod-enumjának minden kliens-oldali státuszt ismernie kell:
// ami hiányzik, azt a `.catch('Felvéve')` csendben visszaírja „Felvéve"-re.
const ALL: OrderStatus[] = [
  'Felvéve', 'Szünetel', 'Kiszállítva', 'Kiszállítva/Számlázva',
  'Csomagolás alatt', 'Folyamatban', 'Előkészítve', 'Javítás alatt', 'Elkészült',
]

describe('orderUpdateSchema · státusz', () => {
  it('minden OrderStatus értéket változatlanul enged át', () => {
    for (const status of ALL) {
      expect(orderUpdateSchema.parse({ status }).status).toBe(status)
    }
  })
})
