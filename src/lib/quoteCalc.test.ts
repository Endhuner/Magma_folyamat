import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUOTE_CALC_SETTINGS,
  calcQuote,
  generateQuoteNumber,
  postProcessPieceEur,
} from './quoteCalc'

/**
 * Ellenőrző értékek az eredeti Excelből
 * („Árajánlat KALKULÁTOR MINTA.xlsx" / db ár kalkulátor):
 * súly 4 g, évi 80 000 db, fészek 8, ciklus 20 s, Idra gép,
 * MPB 3 €/kg, árfolyam 370 HUF/EUR.
 */
const EXCEL_INPUT = {
  weightG: 4,
  yearlyQty: 80000,
  cavityCount: 8,
  cycleTimeS: 20,
  machineName: 'Idra',
  mpbEurPerKg: 3,
}

describe('calcQuote — az Excel értékeivel', () => {
  const r = calcQuote(EXCEL_INPUT, DEFAULT_QUOTE_CALC_SETTINGS)

  it('anyagár (leégéssel): 1,272 €/100 db', () => {
    expect(r.materialPer100Eur).toBeCloseTo(1.272, 4)
    expect(r.materialPerPieceEur).toBeCloseTo(0.01272, 6)
  })
  it('munkadíj (Idra 90 HUF/lövés): 3,0405 €/100 db', () => {
    expect(r.laborPer100Eur).toBeCloseTo(3.040540540540541, 6)
  })
  it('össz darabár: 4,3125 €/100 db', () => {
    expect(r.totalPer100Eur).toBeCloseTo(4.312540540540541, 6)
    expect(r.totalPerPieceEur).toBeCloseTo(0.04312540540540541, 8)
  })
  it('lövés súlya engusszal: 40 g (8×4×1,25)', () => {
    expect(r.shotWeightG).toBeCloseTo(40, 6)
  })
  it('gép óradíja: 16 200 HUF = 43,78 €', () => {
    expect(r.machineHourlyHuf).toBeCloseTo(16200, 3)
    expect(r.machineHourlyEur).toBeCloseTo(43.78378378378378, 6)
  })
  it('kapacitás: 1440 db/óra, 23 040 db/nap (16 h)', () => {
    expect(r.piecesPerHour).toBeCloseTo(1440, 3)
    expect(r.piecesPerDay).toBeCloseTo(23040, 3)
  })
  it('éves mennyiség leöntése: 3,47 nap = 55,56 óra', () => {
    expect(r.daysForYearlyQty).toBeCloseTo(3.4722222, 4)
    expect(r.hoursForYearlyQty).toBeCloseTo(55.5555555, 4)
  })
  it('éves anyagigény: 80000×4 g×1,06 = 339,2 kg', () => {
    expect(r.yearlyMaterialKg).toBeCloseTo(339.2, 3)
  })
  it('figyelmeztet, ha a lövéssúly meghaladja a gép kapacitását', () => {
    const heavy = calcQuote(
      { ...EXCEL_INPUT, weightG: 40, machineName: 'Műanyag' }, // 8×40×1,25 = 400 g > 250 g
      DEFAULT_QUOTE_CALC_SETTINGS,
    )
    expect(heavy.shotWeightExceedsMachine).toBe(true)
    expect(r.shotWeightExceedsMachine).toBe(false)
  })
})

describe('postProcessPieceEur — utómunka kalkulátor', () => {
  it('menet 20 s / 8000 HUF óradíj / 370: 180 db/óra → 0,1170 €/db', () => {
    // Excel: 44,4444 HUF/db → 0,120... — az Excel 380-as árfolyamot használt
    // ennél a lapnál; itt a 370-es standard beállítással számolunk.
    expect(postProcessPieceEur({ cycleTimeS: 20, hourlyRateHuf: 8000 }, 370))
      .toBeCloseTo(8000 / 180 / 370, 8)
  })
  it('az Excel saját árfolyamával (380) az Excel értékét adja', () => {
    expect(postProcessPieceEur({ cycleTimeS: 20, hourlyRateHuf: 8000 }, 380))
      .toBeCloseTo(0.11695906432748537, 8)
  })
})

describe('generateQuoteNumber', () => {
  const q = (number: string) => ({ number })
  it('üres listán: A<év>01', () => {
    expect(generateQuoteNumber([], new Date('2026-07-11'))).toBe('A202601')
  })
  it('a legmagasabb ÉVBELI sorszám után folytat', () => {
    const quotes = [q('A202601'), q('A202614'), q('A202503')]
    expect(generateQuoteNumber(quotes, new Date('2026-07-11'))).toBe('A202615')
  })
  it('évváltásnál újraindul', () => {
    const quotes = [q('A202614')]
    expect(generateQuoteNumber(quotes, new Date('2027-01-02'))).toBe('A202701')
  })
  it('99 felett is növekszik (3 jegy)', () => {
    const quotes = [q('A202699')]
    expect(generateQuoteNumber(quotes, new Date('2026-12-01'))).toBe('A2026100')
  })
})
