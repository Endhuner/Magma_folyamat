import { describe, it, expect } from 'vitest'
import {
  easterSunday,
  hungarianHolidays,
  isWorkday,
  DEFAULT_WORK_CALENDAR,
} from './workCalendar'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('easterSunday', () => {
  it('computes known Easter dates', () => {
    expect(iso(easterSunday(2025))).toBe('2025-04-20')
    expect(iso(easterSunday(2024))).toBe('2024-03-31')
    expect(iso(easterSunday(2026))).toBe('2026-04-05')
  })
})

describe('hungarianHolidays', () => {
  const h = hungarianHolidays(2025)
  it('includes fixed holidays', () => {
    expect(h.has('2025-01-01')).toBe(true)
    expect(h.has('2025-08-20')).toBe(true)
    expect(h.has('2025-12-26')).toBe(true)
  })
  it('includes Easter-based moving holidays', () => {
    expect(h.has('2025-04-18')).toBe(true) // nagypéntek
    expect(h.has('2025-04-21')).toBe(true) // húsvéthétfő
    expect(h.has('2025-06-09')).toBe(true) // pünkösdhétfő
  })
})

describe('isWorkday', () => {
  it('holidays are not workdays', () => {
    expect(isWorkday('2025-08-20')).toBe(false) // szerda, de ünnep
  })
  it('normal weekdays are workdays', () => {
    expect(isWorkday('2025-08-19')).toBe(true) // kedd
  })
  it('weekends are not workdays by default', () => {
    expect(isWorkday('2025-08-23')).toBe(false) // szombat
    expect(isWorkday('2025-08-24')).toBe(false) // vasárnap
  })
  it('extraWorkdays override (worked Saturday)', () => {
    expect(isWorkday('2025-08-23', { ...DEFAULT_WORK_CALENDAR, extraWorkdays: ['2025-08-23'] })).toBe(true)
  })
  it('extraOffdays override (company shutdown on a weekday)', () => {
    expect(isWorkday('2025-08-19', { ...DEFAULT_WORK_CALENDAR, extraOffdays: ['2025-08-19'] })).toBe(false)
  })
})
