import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  dayBreakdown,
  monthlySummary,
  usedLeaveWorkdays,
  weightedHours,
  workedHours,
} from './attendanceCalc'

const S = DEFAULT_ATTENDANCE_SETTINGS

describe('workedHours', () => {
  it('sima nap: 6:00–14:00 = 8 óra', () => {
    expect(workedHours('06:00', '14:00')).toBe(8)
  })
  it('éjszakába nyúlás (+24 h): 22:00–06:00 = 8 óra', () => {
    expect(workedHours('22:00', '06:00')).toBe(8)
  })
  it('perc-pontos: 07:30–16:15 = 8,75 óra', () => {
    expect(workedHours('07:30', '16:15')).toBeCloseTo(8.75, 6)
  })
})

describe('dayBreakdown — a spec ellenőrző esetei', () => {
  it('munkanap 6:00–14:00 → 8 normál, 0 délutáni', () => {
    expect(dayBreakdown('06:00', '14:00', true, S)).toEqual({ normal: 8, afternoon: 0, weekend: 0 })
  })
  it('munkanap 10:00–18:00 → 4 normál + 4 délutáni', () => {
    expect(dayBreakdown('10:00', '18:00', true, S)).toEqual({ normal: 4, afternoon: 4, weekend: 0 })
  })
  it('szombat 8 óra → 8 hétvégi', () => {
    expect(dayBreakdown('06:00', '14:00', false, S)).toEqual({ normal: 0, afternoon: 0, weekend: 8 })
  })
  it('éjszakai (22:00–06:00) munkanapon → 8 délutáni (mind 14:00 utáni)', () => {
    expect(dayBreakdown('22:00', '06:00', true, S)).toEqual({ normal: 0, afternoon: 8, weekend: 0 })
  })
})

describe('weightedHours — pótlékolt óraegyenérték', () => {
  it('4 normál + 4 délutáni → 4 + 4×1,15 = 8,6', () => {
    expect(weightedHours({ normal: 4, afternoon: 4, weekend: 0 }, S)).toBeCloseTo(8.6, 6)
  })
  it('8 hétvégi → 8×1,5 = 12', () => {
    expect(weightedHours({ normal: 0, afternoon: 0, weekend: 8 }, S)).toBeCloseTo(12, 6)
  })
})

describe('monthlySummary', () => {
  // 2026-07: 10. péntek (munkanap), 11. szombat
  const isWorkday = (d: string) => d === '2026-07-10'
  const entries = [
    { date: '2026-07-10', inTime: '10:00', outTime: '18:00' },
    { date: '2026-07-11', inTime: '06:00', outTime: '14:00' },
    { date: '2026-07-12', inTime: '', outTime: '' }, // hiányos — kimarad
  ]
  it('összesít: 4 normál, 4 délutáni, 8 hétvégi, egyenérték 20,6, 2 nap', () => {
    const r = monthlySummary(entries, isWorkday, S)
    expect(r.normal).toBeCloseTo(4, 6)
    expect(r.afternoon).toBeCloseTo(4, 6)
    expect(r.weekend).toBeCloseTo(8, 6)
    expect(r.weighted).toBeCloseTo(8.6 + 12, 6)
    expect(r.daysWorked).toBe(2)
  })
})

describe('usedLeaveWorkdays — éves felhasznált szabadság', () => {
  const isWorkday = (d: string) => !['2026-07-11', '2026-07-12'].includes(d) // hétvége
  const leaves = [
    { fromDate: '2026-07-09', toDate: '2026-07-13', status: 'approved' }, // Cs,P,(Szo,V),H = 3 munkanap
    { fromDate: '2026-07-20', toDate: '2026-07-21', status: 'pending' }, // nem számít
    { fromDate: '2025-12-31', toDate: '2026-01-02', status: 'approved' }, // évhatár: csak 2026-os rész
  ]
  it('csak a jóváhagyott, adott évi munkanapokat számolja', () => {
    // 2026-07-09,10,13 (3) + 2026-01-01,02 (2) = 5
    expect(usedLeaveWorkdays(leaves, 2026, isWorkday)).toBe(5)
  })
})
