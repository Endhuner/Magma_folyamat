import { describe, it, expect } from 'vitest'
import { esc, escAttr, escObject } from './htmlSafe'

describe('esc', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(esc('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    )
  })
  it('escapes ampersands first', () => {
    expect(esc('A&B')).toBe('A&amp;B')
  })
  it('escapes single quotes', () => {
    expect(esc("It's")).toBe('It&#39;s')
  })
  it('handles undefined and null safely', () => {
    expect(esc(undefined)).toBe('')
    expect(esc(null)).toBe('')
  })
  it('coerces non-string types', () => {
    expect(esc(42)).toBe('42')
    expect(esc(true)).toBe('true')
  })
})

describe('escAttr', () => {
  it('escapes the same characters as esc (suitable for attribute values)', () => {
    expect(escAttr('"><img src=x onerror=alert(1)>')).not.toContain('<img')
    expect(escAttr('"')).not.toContain('"')
  })
})

describe('escObject', () => {
  it('shallow-escapes string fields of an object', () => {
    const r = escObject({ name: '<b>bold</b>', count: 3 })
    expect(r.name).toBe('&lt;b&gt;bold&lt;/b&gt;')
    expect(r.count).toBe(3)
  })
  it('leaves non-string values untouched', () => {
    const r = escObject({ active: true, n: 1, s: 'a' })
    expect(r.active).toBe(true)
    expect(r.n).toBe(1)
    expect(r.s).toBe('a')
  })
})
