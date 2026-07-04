/**
 * Műszakadat-hiány detektálás (PRD §4.4).
 *
 * A modul az elmúlt 7 napot (nem beleértve a mai napot) visszamenőleg vizsgálja minden
 * olyan rendelésre, amelyik `Folyamatban` státuszú, és ellenőrzi, hogy minden nap
 * mindkét műszakához (de / du) van-e rögzítve `ProductionShift`.
 *
 * Kivételek (nem jelez hiányt):
 *   - `Szünetel` vagy `Kiszállítva` státusz
 *   - A rendelés `orderDate` vagy `createdAt` előtti napok
 *   - A mai nap és a jövő (csak múltbeli, lezárt napokra érvényes)
 */
import type { Order, ProductionShift } from '@/lib/types'

export interface MissingShift {
  orderId: string
  customer: string
  productName: string
  date: string // YYYY-MM-DD
  shift: 'de' | 'du'
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const LOOKBACK_DAYS = 7

/** Segédfüggvény: egy Date-ből YYYY-MM-DD stringet készít helyi idő szerint. */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Adott napon éjfélre igazított Date létrehozása. */
function atMidnight(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Rendelésenként a legkorábbi műszak-dátum (= a gyártás indulása) egyetlen
 * végigolvasással. Ha egy rendeléshez nincs műszak, nem kerül a map-be —
 * ilyenkor nem jelzünk hiányt: a gyártás még nem indult el.
 */
function buildProductionStartDates(shifts: ProductionShift[]): Map<string, Date> {
  const earliest = new Map<string, string>()
  for (const s of shifts) {
    const cur = earliest.get(s.orderId)
    if (cur === undefined || s.date < cur) earliest.set(s.orderId, s.date)
  }
  const result = new Map<string, Date>()
  for (const [orderId, date] of earliest) {
    const d = new Date(date)
    if (!Number.isNaN(d.getTime())) result.set(orderId, atMidnight(d))
  }
  return result
}

/**
 * Visszaadja a hiányzó műszakok listáját.
 * Rendezés: legfrissebb dátum → legrégebbi, egy napon belül de → du.
 */
export function detectMissingShifts(
  orders: Order[],
  shifts: ProductionShift[]
): MissingShift[] {
  const today = atMidnight(new Date())
  const lookback: Date[] = []
  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    lookback.push(new Date(today.getTime() - i * MS_PER_DAY))
  }

  // Indexeljük a meglévő műszakokat (orderId|date|shift → ProductionShift)
  const shiftIndex = new Set<string>()
  for (const s of shifts) {
    shiftIndex.add(`${s.orderId}|${s.date}|${s.shift}`)
  }

  // Csak `Folyamatban` rendelésekre nézzük — a PRD erről konkrétan rendelkezik.
  const trackedOrders = orders.filter((o) => o.status === 'Folyamatban')

  const startDates = buildProductionStartDates(shifts)

  const missing: MissingShift[] = []
  for (const order of trackedOrders) {
    const startDate = startDates.get(order.id)
    // Ha még egyetlen műszak sincs rögzítve, a gyártás nem kezdődött el → nincs hiány
    if (!startDate) continue
    for (const day of lookback) {
      if (day.getTime() < startDate.getTime()) continue
      const iso = toISODate(day)
      for (const shift of ['de', 'du'] as const) {
        const key = `${order.id}|${iso}|${shift}`
        if (!shiftIndex.has(key)) {
          missing.push({
            orderId: order.id,
            customer: order.customer,
            productName: order.productName,
            date: iso,
            shift,
          })
        }
      }
    }
  }

  // Rendezés: legújabb dátum előre, azon belül de → du.
  missing.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    if (a.shift !== b.shift) return a.shift === 'de' ? -1 : 1
    return a.customer.localeCompare(b.customer, 'hu')
  })

  return missing
}

/**
 * Egyedi rendelésre nézve: van-e hiányzó műszak.
 * Hasznos WorkOrderCard-on a warning badge megjelenítéséhez.
 */
export function orderHasMissingShifts(
  orderId: string,
  missing: MissingShift[]
): boolean {
  return missing.some((m) => m.orderId === orderId)
}

/** Adott rendelés hiányzó műszakainak száma. */
export function countMissingShiftsForOrder(
  orderId: string,
  missing: MissingShift[]
): number {
  return missing.filter((m) => m.orderId === orderId).length
}

/** Emberi olvasású műszakcímke. */
export function shiftLabel(shift: 'de' | 'du'): string {
  return shift === 'de' ? 'Délelőtt' : 'Délután'
}
