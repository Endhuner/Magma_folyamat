/**
 * Darabár-kalkulátor az árajánlat-modulhoz.
 *
 * A képletek az eredeti Excelből származnak („Árajánlat KALKULÁTOR MINTA.xlsx"),
 * cellahivatkozásokkal jelölve — a quoteCalc.test.ts az Excel tényleges
 * értékei ellen ellenőrzi őket. Ha az app mást számol, mint az Excel, a teszt
 * elbukik.
 */

export interface QuoteMachine {
  name: string
  /** Lövésár (HUF/lövés) — ebből származik az óradíj és a munkadíj. */
  shotFeeHuf: number
  /** Kiönthető mennyiség (g/lövés) — e fölött figyelmeztetünk. */
  maxShotWeightG: number
}

export interface QuoteCalcSettings {
  /** HUF/EUR árfolyam. */
  eurHuf: number
  machines: QuoteMachine[]
  /** Leégés (Abbrand) — az anyagigényt növeli. Excel: ×1,06. */
  burnRate: number
  /** Engusz-arány a lövéssúlyban. Excel: ×1,25 (C11 = C10×0,25). */
  sprueRate: number
  /** Műszak-órák naponta (Excel B27 = 16). */
  workHoursPerDay: number
  /** Munkanapok havonta (Excel C5 = C4/21). */
  workdaysPerMonth: number
  /** Default anyagár-bázis (MPB, €/kg). */
  defaultMpbEurPerKg: number
}

export const DEFAULT_QUOTE_CALC_SETTINGS: QuoteCalcSettings = {
  eurHuf: 370,
  machines: [
    { name: 'Műanyag', shotFeeHuf: 130, maxShotWeightG: 250 },
    { name: 'Idra', shotFeeHuf: 90, maxShotWeightG: 1000 },
    { name: 'Agrati', shotFeeHuf: 110, maxShotWeightG: 1000 },
  ],
  burnRate: 0.06,
  sprueRate: 0.25,
  workHoursPerDay: 16,
  workdaysPerMonth: 21,
  defaultMpbEurPerKg: 3,
}

export interface QuoteCalcInput {
  /** 1 db nettó súlya grammban. */
  weightG: number
  yearlyQty: number
  cavityCount: number
  cycleTimeS: number
  /** A beállításokban szereplő gép neve. */
  machineName: string
  /** Anyagár-bázis €/kg (MPB). */
  mpbEurPerKg: number
}

export interface QuoteCalcResult {
  /** Anyagár leégéssel — Excel H2: súly × MPB × (1+leégés) / 10. */
  materialPer100Eur: number
  materialPerPieceEur: number
  /** Munkadíj — Excel C23: lövésár / fészek / árfolyam × 100. */
  laborPer100Eur: number
  laborPerPieceEur: number
  totalPer100Eur: number
  totalPerPieceEur: number
  /** Lövés súlya engusszal — Excel C12: fészek × súly × (1+engusz). */
  shotWeightG: number
  shotWeightExceedsMachine: boolean
  /** Gép óradíja — Excel O/P oszlop: lövésár × lövés/óra. */
  machineHourlyHuf: number
  machineHourlyEur: number
  shotsPerHour: number
  piecesPerHour: number
  piecesPerDay: number
  daysForYearlyQty: number
  hoursForYearlyQty: number
  /** Éves anyagigény kg leégéssel — Excel D3. */
  yearlyMaterialKg: number
}

export function calcQuote(input: QuoteCalcInput, settings: QuoteCalcSettings): QuoteCalcResult {
  const machine =
    settings.machines.find((m) => m.name === input.machineName) ?? settings.machines[0]
  const burn = 1 + settings.burnRate

  const materialPer100Eur = (input.weightG * input.mpbEurPerKg * burn) / 10
  const laborPer100Eur = (machine.shotFeeHuf / input.cavityCount / settings.eurHuf) * 100

  const shotsPerHour = 3600 / input.cycleTimeS
  const piecesPerHour = shotsPerHour * input.cavityCount
  const piecesPerDay = piecesPerHour * settings.workHoursPerDay
  const shotWeightG = input.cavityCount * input.weightG * (1 + settings.sprueRate)
  const machineHourlyHuf = machine.shotFeeHuf * shotsPerHour

  return {
    materialPer100Eur,
    materialPerPieceEur: materialPer100Eur / 100,
    laborPer100Eur,
    laborPerPieceEur: laborPer100Eur / 100,
    totalPer100Eur: materialPer100Eur + laborPer100Eur,
    totalPerPieceEur: (materialPer100Eur + laborPer100Eur) / 100,
    shotWeightG,
    shotWeightExceedsMachine: shotWeightG > machine.maxShotWeightG,
    machineHourlyHuf,
    machineHourlyEur: machineHourlyHuf / settings.eurHuf,
    shotsPerHour,
    piecesPerHour,
    piecesPerDay,
    daysForYearlyQty: input.yearlyQty / piecesPerDay,
    hoursForYearlyQty: input.yearlyQty / piecesPerHour,
    yearlyMaterialKg: (input.yearlyQty * input.weightG * burn) / 1000,
  }
}

export interface PostProcessInput {
  /** Egy darab művelet-ideje másodpercben (Excel B oszlop). */
  cycleTimeS: number
  /** A művelet óradíja HUF-ban (Excel C oszlop). */
  hourlyRateHuf: number
}

/** Utómunka darabár €-ban — Excel D–F: db/óra = 3600/idő; db ár = óradíj/db-óra/árfolyam. */
export function postProcessPieceEur(input: PostProcessInput, eurHuf: number): number {
  const piecesPerHour = 3600 / input.cycleTimeS
  return input.hourlyRateHuf / piecesPerHour / eurHuf
}

/**
 * Ajánlat-sorszám: A<év><sorszám>, évenként újrainduló, minimum 2 jegyű
 * (A202601 … A202699, utána A2026100).
 */
export function generateQuoteNumber(
  quotes: Array<{ number?: string | null }>,
  today: Date = new Date(),
): string {
  const year = today.getFullYear()
  const prefix = `A${year}`
  let max = 0
  for (const q of quotes) {
    const n = q.number || ''
    if (!n.startsWith(prefix)) continue
    const seq = Number.parseInt(n.slice(prefix.length), 10)
    if (Number.isFinite(seq) && seq > max) max = seq
  }
  const next = max + 1
  return `${prefix}${String(next).padStart(2, '0')}`
}
