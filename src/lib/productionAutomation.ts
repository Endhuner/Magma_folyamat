/**
 * Gyártási automatika — a műszakrögzítéshez kötött státusz- és számláló-logika.
 *
 *  - Vég lövésszám beírása → a rendelés „Folyamatban"
 *  - Gyártott darab eléri a kért mennyiséget → „Elkészült"
 *  - 2 teljes MUNKANAPIG nincs műszak → „Szünetel"
 *  - Túltermelés: ha egy műszak túltölti a rendelést és van másik azonos termékű
 *    rendelés, a felesleg-lövések oda kerülnek, folytonos számlálóval.
 *
 * A „végleges" státuszokat (Kiszállítva, Kiszállítva/Számlázva, Javítás alatt)
 * az automatika sosem írja felül.
 */
import type { Order, OrderStatus, ProductionShift } from './types'
import { isWorkday, type WorkCalendarSettings } from './workCalendar'

/** Az automatika ezeket sosem módosítja. */
export const FINAL_STATUSES: readonly OrderStatus[] = [
  'Kiszállítva', 'Kiszállítva/Számlázva', 'Javítás alatt',
]

export function producedForOrder(orderId: string, shifts: ProductionShift[]): number {
  return shifts.reduce((sum, s) => (s.orderId === orderId ? sum + (s.producedQuantity || 0) : sum), 0)
}

/**
 * Új státusz egy műszak mentése után — null, ha nem kell változtatni.
 * producedTotal = a rendelés teljes gyártott darabszáma a mentés UTÁN.
 */
export function autoStatusForShift(order: Order, producedTotal: number): OrderStatus | null {
  if (FINAL_STATUSES.includes(order.status)) return null
  if (order.amountPc > 0 && producedTotal >= order.amountPc) {
    return order.status === 'Elkészült' ? null : 'Elkészült'
  }
  if (producedTotal > 0) {
    return order.status === 'Folyamatban' ? null : 'Folyamatban'
  }
  return null
}

/** Munkanapok száma szigorúan a két nap KÖZÖTT (from és to nem számít bele). */
export function workdaysBetween(fromISO: string, toISO: string, cal: WorkCalendarSettings): number {
  if (fromISO >= toISO) return 0
  let count = 0
  const d = new Date(fromISO + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const end = new Date(toISO + 'T00:00:00')
  while (d < end) {
    if (isWorkday(d, cal)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * „Folyamatban" rendelések, amelyeknél 2+ teljes munkanapja nincs műszakbeírás
 * → Szünetel. Műszak nélküli rendelést nem érint.
 */
export function ordersToAutoPause(
  orders: Order[], shifts: ProductionShift[], todayISO: string, cal: WorkCalendarSettings,
): string[] {
  const ids: string[] = []
  for (const o of orders) {
    if (o.status !== 'Folyamatban') continue
    const dates = shifts.filter((s) => s.orderId === o.id).map((s) => s.date)
    if (dates.length === 0) continue
    const last = dates.reduce((m, d) => (d > m ? d : m))
    if (last >= todayISO) continue
    if (workdaysBetween(last, todayISO, cal) >= 2) ids.push(o.id)
  }
  return ids
}

/** A következő azonos termékű, nem-végleges és nem-kész rendelés (határidő szerint). */
export function nextSameProductOrder(current: Order, orders: Order[]): Order | null {
  const same = (o: Order) =>
    o.id !== current.id &&
    o.status !== 'Elkészült' &&
    !FINAL_STATUSES.includes(o.status) &&
    (current.productId ? o.productId === current.productId : o.productName === current.productName)
  return (
    orders.filter(same).sort((a, b) => {
      const ra = a.requiredDate || '9999-12-31'
      const rb = b.requiredDate || '9999-12-31'
      return ra < rb ? -1 : ra > rb ? 1 : 0
    })[0] ?? null
  )
}

/**
 * Túltermelés szétosztása: az aktuális műszakot A hiányáig vágja, a maradék
 * lövéseket a következő azonos termékű rendelésre viszi — a számláló (abszolút
 * lövésszám) folytonos marad. null, ha nincs túltermelés vagy nincs hová vinni.
 */
export function splitOverProduction(params: {
  shift: ProductionShift
  order: Order
  producedBefore: number
  nest: number
  nextOrder: Order | null
  newId: string
  nowISO: string
}): { cappedShift: ProductionShift; rolloverShift: ProductionShift } | null {
  const { shift, order, producedBefore, nest, nextOrder, newId, nowISO } = params
  if (!nextOrder || shift.endShotsAbsolute == null || nest <= 0) return null
  const neededDb = order.amountPc - producedBefore
  if (neededDb <= 0) return null                      // A már kész volt a műszak előtt
  if (shift.producedQuantity <= neededDb) return null // nincs túltermelés
  const shotsForA = Math.min(shift.shotsCount, Math.ceil(neededDb / nest))
  const shotsForB = shift.shotsCount - shotsForA
  if (shotsForB <= 0) return null
  const endAbs = shift.endShotsAbsolute
  const startAbs = endAbs - shift.shotsCount
  const splitAbs = startAbs + shotsForA
  const cappedShift: ProductionShift = {
    ...shift,
    shotsCount: shotsForA,
    producedQuantity: shotsForA * nest,
    endShotsAbsolute: splitAbs,
    updatedAt: nowISO,
  }
  const rolloverShift: ProductionShift = {
    ...shift,
    id: newId,
    orderId: nextOrder.id,
    shotsCount: shotsForB,
    producedQuantity: shotsForB * nest,
    endShotsAbsolute: endAbs,
    notes: [shift.notes, `Átvezetve: ${order.ownOrderNumber || order.orderNumber || order.productName} felesleg`]
      .filter(Boolean).join(' · '),
    createdAt: nowISO,
    updatedAt: nowISO,
  }
  return { cappedShift, rolloverShift }
}
