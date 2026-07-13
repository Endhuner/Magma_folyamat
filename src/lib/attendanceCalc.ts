/**
 * Jelenléti óra- és pótlékszámítás (4. alprojekt).
 *
 * Szabályok (a Jelenléti-Excel Pótlékok lapja + a jóváhagyott spec-defaultok):
 *  - napi munkaóra = távozás − érkezés; éjszakába nyúlásnál +24 h
 *  - hétvégén/ünnepnapon minden óra „hétvégi" (×1,5)
 *  - munkanapon a 14:00 utáni órák „délutániak" (×1,15), a többi normál
 *  - pótlékolt óraegyenérték = normál + délutáni×1,15 + hétvégi×1,5
 * Szünet-levonás nincs. A munkanap-fogalmat a hívó adja (Munkanaptár beállítás).
 */

export interface AttendanceSettings {
  /** Délutáni pótlék kezdete (óra, 0–23). */
  afternoonStartHour: number
  afternoonMultiplier: number
  weekendMultiplier: number
  /** Éves szabadságkeret (nap/dolgozó). */
  yearlyLeaveDays: number
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  afternoonStartHour: 14,
  afternoonMultiplier: 1.15,
  weekendMultiplier: 1.5,
  yearlyLeaveDays: 25,
}

const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Ledolgozott órák; ha a távozás korábbi az érkezésnél, másnapba nyúlik (+24 h). */
export function workedHours(inTime: string, outTime: string): number {
  const start = toMinutes(inTime)
  let end = toMinutes(outTime)
  if (end < start) end += 24 * 60
  return (end - start) / 60
}

export interface DayBreakdown {
  normal: number
  afternoon: number
  weekend: number
}

export function dayBreakdown(
  inTime: string,
  outTime: string,
  isWorkday: boolean,
  settings: AttendanceSettings,
): DayBreakdown {
  const total = workedHours(inTime, outTime)
  if (!isWorkday) return { normal: 0, afternoon: 0, weekend: total }
  // Normál = a délutáni határ ELŐTTI rész; minden más (a határ után, illetve
  // az éjfélen túlnyúló rész is) délutáni.
  const start = toMinutes(inTime)
  let end = toMinutes(outTime)
  if (end < start) end += 24 * 60
  const boundary = settings.afternoonStartHour * 60
  const normal = Math.max(0, Math.min(end, boundary) - start) / 60
  return { normal, afternoon: total - normal, weekend: 0 }
}

export function weightedHours(b: DayBreakdown, settings: AttendanceSettings): number {
  return (
    b.normal +
    b.afternoon * settings.afternoonMultiplier +
    b.weekend * settings.weekendMultiplier
  )
}

export interface MonthlySummary extends DayBreakdown {
  weighted: number
  daysWorked: number
}

/** Havi összesítő — a hiányos (in vagy out nélküli) napok kimaradnak. */
export function monthlySummary(
  entries: Array<{ date: string; inTime: string; outTime: string }>,
  isWorkday: (date: string) => boolean,
  settings: AttendanceSettings,
): MonthlySummary {
  const sum: MonthlySummary = { normal: 0, afternoon: 0, weekend: 0, weighted: 0, daysWorked: 0 }
  for (const e of entries) {
    if (!e.inTime || !e.outTime) continue
    const b = dayBreakdown(e.inTime, e.outTime, isWorkday(e.date), settings)
    sum.normal += b.normal
    sum.afternoon += b.afternoon
    sum.weekend += b.weekend
    sum.weighted += weightedHours(b, settings)
    sum.daysWorked += 1
  }
  return sum
}

/** Naponként lépkedő iterátor YYYY-MM-DD stringeken (időzóna-biztos). */
function* eachDay(from: string, to: string): Generator<string> {
  const [y, m, d] = from.split('-').map(Number)
  const cur = new Date(Date.UTC(y, m - 1, d))
  for (;;) {
    const iso = cur.toISOString().slice(0, 10)
    if (iso > to) return
    yield iso
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
}

/** Jóváhagyott szabadság-munkanapok az adott évben (évhatárnál vágva). */
export function usedLeaveWorkdays(
  leaves: Array<{ fromDate: string; toDate: string; status: string }>,
  year: number,
  isWorkday: (date: string) => boolean,
): number {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  let n = 0
  for (const l of leaves) {
    if (l.status !== 'approved') continue
    const from = l.fromDate > yearStart ? l.fromDate : yearStart
    const to = l.toDate < yearEnd ? l.toDate : yearEnd
    if (from > to) continue
    for (const day of eachDay(from, to)) {
      if (isWorkday(day)) n++
    }
  }
  return n
}

/** Munkanapok száma egy időszakban — a kérelem-űrlap előnézetéhez. */
export function workdaysBetween(
  from: string,
  to: string,
  isWorkday: (date: string) => boolean,
): number {
  if (!from || !to || from > to) return 0
  let n = 0
  for (const day of eachDay(from, to)) {
    if (isWorkday(day)) n++
  }
  return n
}
