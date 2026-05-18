import { Order, DashboardMetrics, ProductionShift, ProductionDefect, ProductionKPIs, DailyProductionData } from './types'
import { format, formatDistanceToNow, isPast, subDays, startOfDay } from 'date-fns'

/**
 * Egységes, ékezet-érzéketlen szöveg-normalizáló keresés/összehasonlítás
 * előtt. NFKD-ra bont, ledobja a kombináló jeleket, kisbetűsít és trim-el.
 *
 * Korábban a App.tsx, OrdersTable.tsx, OrderDialog.tsx mind külön definiálta
 * — most egy közös forrásból érkezik, így a viselkedés konzisztens.
 */
export function stripDiacritics(s: string | undefined | null): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Igaz, ha a státusz „Kiszállítva" (vagy bármi, ami ezt tartalmazza ékezetek
 * nélkül). A magyar elnevezés és az ékezet-tolerancia miatt nem szigorú
 * egyenlőség, hanem `includes`.
 */
export function isDelivered(status: string): boolean {
  const st = stripDiacritics(status)
  return st === 'kiszallitva' || st.includes('kiszallitva')
}

export function calculateDashboardMetrics(
  orders: Order[]
): DashboardMetrics {
  const totalOrders = orders.length
  const pendingOrders = orders.filter(o => o.status === 'Felvéve').length
  const inProductionOrders = orders.filter(o => o.status === 'Folyamatban').length
  const readyForDeliveryOrders = orders.filter(o => o.ready === 'x' || o.ready === 'X').length
  const deliveredOrders = orders.filter(o => isDelivered(o.status)).length
  const invoicedOrders = orders.filter(o => o.invoiced === 'x' || o.invoiced === 'X').length

  return {
    totalOrders,
    pendingOrders,
    inProductionOrders,
    readyForDeliveryOrders,
    deliveredOrders,
    invoicedOrders,
  }
}

export function calculateProductionKPIs(
  shifts: ProductionShift[],
  defects: ProductionDefect[]
): ProductionKPIs {
  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')

  const days: DailyProductionData[] = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i)
    return {
      date: format(d, 'yyyy-MM-dd'),
      label: format(d, 'MM.dd'),
      produced: 0,
      defects: 0,
    }
  })

  const dayMap = new Map(days.map(d => [d.date, d]))

  for (const s of shifts) {
    const d = dayMap.get(s.date)
    if (d) d.produced += s.producedQuantity ?? 0
  }
  for (const def of defects) {
    const d = dayMap.get(def.date)
    if (d) d.defects += def.quantity ?? 0
  }

  const weekProduced = days.reduce((sum, d) => sum + d.produced, 0)
  const weekDefects = days.reduce((sum, d) => sum + d.defects, 0)
  const todayProduced = dayMap.get(todayStr)?.produced ?? 0
  const defectRate = weekProduced > 0 ? Math.round((weekDefects / weekProduced) * 100 * 10) / 10 : 0

  return { todayProduced, weekProduced, weekDefects, defectRate, dailyData: days }
}

export function formatDate(date: string): string {
  if (!date) return ''
  return format(new Date(date), 'yyyy/MM/dd')
}

export function formatDateTime(date: string): string {
  if (!date) return ''
  return format(new Date(date), 'yyyy/MM/dd HH:mm')
}

export function formatTimeAgo(date: string): string {
  if (!date) return ''
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (!dueDate) return false
  return !isDelivered(status) && isPast(new Date(dueDate))
}

/**
 * Biztonságos egész-szám parsing.
 * - Trim, decimális vessző normalizálás (",", "."), ezer-elválasztó eltávolítás (" ", "·").
 * - Üres / NaN / Infinity esetén a fallback értéket adja vissza (default: 0).
 * - Float bemenetnél csonkít (Math.trunc) — pl. "12.7" → 12.
 *
 * Mindenhol használd a `parseInt(...) || 0` minta helyett.
 *
 * @example parseIntSafe('12,5')   // 12
 * @example parseIntSafe('abc', 5) // 5
 * @example parseIntSafe('-10', 0, { allowNegative: false }) // 0
 */
export function parseIntSafe(
  v: unknown,
  fallback: number = 0,
  opts: { allowNegative?: boolean } = {}
): number {
  const { allowNegative = true } = opts
  if (v === null || v === undefined || v === '') return fallback
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.')
  if (!s) return fallback
  const n = Number(s)
  if (!Number.isFinite(n)) return fallback
  const truncated = Math.trunc(n)
  if (!allowNegative && truncated < 0) return fallback
  return truncated
}

/**
 * Biztonságos lebegőpontos parsing.
 * - Hasonló mint parseIntSafe, de nem csonkít.
 * - Decimális vessző normalizálás.
 *
 * @example parseFloatSafe('12,5')   // 12.5
 * @example parseFloatSafe('abc', 0) // 0
 */
export function parseFloatSafe(
  v: unknown,
  fallback: number = 0,
  opts: { allowNegative?: boolean } = {}
): number {
  const { allowNegative = true } = opts
  if (v === null || v === undefined || v === '') return fallback
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.')
  if (!s) return fallback
  const n = Number(s)
  if (!Number.isFinite(n)) return fallback
  if (!allowNegative && n < 0) return fallback
  return n
}

export function generateOwnOrderNumber(existingOrders: { ownOrderNumber: string }[]): string {
  const now = new Date()
  const year = now.getFullYear()
  const yearSuffix = String(year).slice(-2)
  
  const prefix = `M${yearSuffix}1`
  
  const currentYearOrders = existingOrders.filter(o => {
    const orderPrefix = o.ownOrderNumber.substring(0, 4)
    return orderPrefix === prefix
  })
  
  const maxSequence = currentYearOrders.reduce((max, order) => {
    const match = order.ownOrderNumber.match(/^M\d{2}1(\d+)$/)
    if (match) {
      const seq = parseIntSafe(match[1], 0)
      return Math.max(max, seq)
    }
    return max
  }, 0)
  
  const nextSequence = maxSequence + 1
  
  if (nextSequence === 1) {
    return `${prefix}${nextSequence}`
  } else {
    return `${prefix}${String(nextSequence).padStart(3, '0')}`
  }
}



export function parseYear(dateStr: string): number | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return Number(m[3])

  m = s.match(/^(\d{4})([/-]\d{1,2})?([/-]\d{1,2})?$/)
  if (m) return Number(m[1])

  m = s.match(/(20\d{2}|19\d{2})/)
  if (m) return Number(m[1])

  return null
}

export function generateDeliveryNoteSequenceNumber(
  deliveryNotes: { sequenceNumber: string, type: string }[],
  type: 'delivery' | 'cmr'
): string {
  const prefix = type === 'delivery' ? 'SZL' : 'CMR'

  const sameTypeNotes = deliveryNotes.filter(note => note.type === type)
  
  const maxSequence = sameTypeNotes.reduce((max, note) => {
    const match = note.sequenceNumber.match(/^(SZL|CMR)(\d+)$/)
    if (match) {
      const seq = parseIntSafe(match[2], 0)
      return Math.max(max, seq)
    }
    return max
  }, 0)
  
  const nextSequence = maxSequence + 1
  return `${prefix}${String(nextSequence).padStart(4, '0')}`
}
