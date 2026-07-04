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

// Önellenőrzés: ld. workCalendar.test.ts (a Node-specifikus __main__ blokk
// helyett vitest, mert ez a modul a böngészőbe is bundle-ölődik).
