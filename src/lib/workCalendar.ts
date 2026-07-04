/**
 * Munkanaptár — magyar munkaszüneti napok + heti munkarend.
 *
 * A műszakadat-hiány ellenőrzés (shiftValidation) és a kapacitástervezés közös
 * alapja: mely napok munkanapok. A fix ünnepek mellett a húsvéthoz kötött
 * mozgó ünnepeket (nagypéntek, húsvéthétfő, pünkösdhétfő) is számítjuk.
 *
 * A "áthelyezett munkanapok" (szombati ledolgozás) rendszere évente
 * kormányrendelet-függő és nem számítható — ezeket a beállításban kézzel
 * megadott `extraWorkdays` / `extraOffdays` listával lehet felülbírálni.
 */

export interface WorkCalendarSettings {
  /** Mely hét-napok munkanapok (0 = vasárnap … 6 = szombat). Alap: H–P. */
  workdays: number[]
  /** Figyelembe vegyük-e a magyar ünnepnapokat (alap: igen). */
  observeHolidays: boolean
  /** Kézi kivételek: extra munkanapok (ISO YYYY-MM-DD), pl. ledolgozott szombat. */
  extraWorkdays: string[]
  /** Kézi kivételek: extra pihenőnapok (ISO YYYY-MM-DD), pl. céges leállás. */
  extraOffdays: string[]
}

export const DEFAULT_WORK_CALENDAR: WorkCalendarSettings = {
  workdays: [1, 2, 3, 4, 5], // hétfő–péntek
  observeHolidays: true,
  extraWorkdays: [],
  extraOffdays: [],
}

/** Helyi idő szerinti YYYY-MM-DD. */
function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Húsvétvasárnap dátuma (anonymous Gregorian / Meeus–Jones–Butcher algoritmus).
 * A magyar mozgó ünnepek ehhez képest: nagypéntek −2, húsvéthétfő +1,
 * pünkösdhétfő +50 nap.
 */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = március, 4 = április
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** A magyar munkaszüneti napok halmaza egy adott évre (ISO YYYY-MM-DD). */
export function hungarianHolidays(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`, // Újév
    `${year}-03-15`, // Nemzeti ünnep
    `${year}-05-01`, // A munka ünnepe
    `${year}-08-20`, // Államalapítás
    `${year}-10-23`, // 1956 / köztársaság
    `${year}-11-01`, // Mindenszentek
    `${year}-12-25`, // Karácsony
    `${year}-12-26`, // Karácsony másnap
  ]
  const easter = easterSunday(year)
  const moving = [
    isoDate(addDays(easter, -2)), // nagypéntek
    isoDate(addDays(easter, 1)),  // húsvéthétfő
    isoDate(addDays(easter, 50)), // pünkösdhétfő
  ]
  return new Set([...fixed, ...moving])
}

/** Igaz, ha az adott nap munkanap a megadott naptár szerint. */
export function isWorkday(date: Date | string, cal: WorkCalendarSettings = DEFAULT_WORK_CALENDAR): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return false
  const iso = isoDate(d)

  // Kézi felülbírálások elsőbbsége
  if (cal.extraOffdays.includes(iso)) return false
  if (cal.extraWorkdays.includes(iso)) return true

  if (!cal.workdays.includes(d.getDay())) return false
  if (cal.observeHolidays && hungarianHolidays(d.getFullYear()).has(iso)) return false
  return true
}

// ---- önellenőrzés (ponytail: fut node-dal, nincs framework) ----
// Futtatás: `npx tsx src/lib/workCalendar.ts`
// pathToFileURL a szóközös könyvtárnév (%20) miatt — ld. apps/api/src/index.ts.
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const assert = (c: boolean, m: string) => { if (!c) { throw new Error('FAIL: ' + m) } }
  // 2025 húsvétvasárnap: április 20.
  assert(isoDate(easterSunday(2025)) === '2025-04-20', 'húsvét 2025')
  // 2024 húsvétvasárnap: március 31.
  assert(isoDate(easterSunday(2024)) === '2024-03-31', 'húsvét 2024')
  const h2025 = hungarianHolidays(2025)
  assert(h2025.has('2025-04-18'), 'nagypéntek 2025-04-18')
  assert(h2025.has('2025-04-21'), 'húsvéthétfő 2025-04-21')
  assert(h2025.has('2025-06-09'), 'pünkösdhétfő 2025-06-09')
  assert(h2025.has('2025-08-20'), 'államalapítás')
  // 2025-08-20 szerda, de ünnep → nem munkanap
  assert(!isWorkday('2025-08-20'), 'ünnep nem munkanap')
  // 2025-08-19 kedd, munkanap
  assert(isWorkday('2025-08-19'), 'kedd munkanap')
  // szombat alapból nem munkanap
  assert(!isWorkday('2025-08-23'), 'szombat nem munkanap')
  // de extraWorkdays felülírja
  assert(isWorkday('2025-08-23', { ...DEFAULT_WORK_CALENDAR, extraWorkdays: ['2025-08-23'] }), 'ledolgozott szombat')
  // eslint-disable-next-line no-console
  console.log('workCalendar önellenőrzés OK')
}
