import type { Order, OrderStatus, ProductionShift } from '@/lib/types'
import { ORDER_STATUS } from '@/lib/constants/orderStatus'
import { isDelivered } from '@/lib/helpers'

/**
 * Státusz-javaslatok — gyártás-vezérelt, „javaslat + megerősítés" logika.
 *
 * A rendelés státusza SOHA nem vált magától; ez a tiszta függvény csak
 * KISZÁMOLJA, mi lenne a logikus következő státusz a legyártott mennyiség
 * alapján. A felhasználó egy gombbal erősíti meg (toast / chip).
 *
 * Két szabály (a felhasználó választása szerint):
 *  1) Legyártott mennyiség eléri a rendeltet → `Elkészült`.
 *  2) Megkezdett gyártás (van legyártott db) és a rendelés még `Felvéve` /
 *     `Előkészítve` → `Folyamatban`.
 *
 * Az 1) szabály erősebb: ha a gyártás egyből teljesíti a mennyiséget, rögtön
 * az `Elkészült`-et javasoljuk, nem a `Folyamatban`-t.
 */

export interface StatusSuggestion {
  status: OrderStatus
  /** Ember-olvasható indok a megerősítő felülethez. */
  reason: string
}

/** A `productionShifts`-ből összegzi egy rendelés eddig legyártott darabszámát. */
export function sumProducedForOrder(
  orderId: string,
  shifts: ProductionShift[]
): number {
  return shifts.reduce(
    (sum, s) => (s.orderId === orderId ? sum + (s.producedQuantity || 0) : sum),
    0
  )
}

/**
 * Visszaadja a javasolt státuszt egy rendeléshez az eddig legyártott
 * mennyiség alapján, vagy `null`-t, ha nincs értelmes javaslat.
 */
export function suggestStatusChange(
  order: Order | undefined | null,
  producedTotal: number
): StatusSuggestion | null {
  if (!order) return null
  // Már kiszállított rendelésre nincs javaslat.
  if (isDelivered(order.status)) return null

  const amount = order.amountPc || 0

  // 1) Kész mennyiség → Elkészült (kivéve, ha már Elkészült).
  if (amount > 0 && producedTotal >= amount && order.status !== ORDER_STATUS.ELKESZULT) {
    return {
      status: ORDER_STATUS.ELKESZULT,
      reason: `${producedTotal.toLocaleString('hu-HU')}/${amount.toLocaleString('hu-HU')} db legyártva`,
    }
  }

  // 2) Megkezdett gyártás + még felvett/előkészített → Folyamatban.
  if (
    producedTotal > 0 &&
    (order.status === ORDER_STATUS.FELVEVE || order.status === ORDER_STATUS.ELOKESZITVE)
  ) {
    return {
      status: ORDER_STATUS.FOLYAMATBAN,
      reason: 'Megkezdett gyártás',
    }
  }

  return null
}
