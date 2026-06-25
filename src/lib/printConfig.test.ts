import { describe, it, expect } from 'vitest'
import {
  marginsToCss,
  buildPrintPageCss,
  resolveMargins,
  DEFAULT_DOCUMENT_MARGINS,
  DEFAULT_LABEL_MARGINS,
  type PrintMargins,
} from './printConfig'

describe('marginsToCss', () => {
  it('mm mértékegységgel, top-right-bottom-left sorrendben', () => {
    expect(marginsToCss({ top: '10', right: '8', bottom: '6', left: '4' })).toBe('10mm 8mm 6mm 4mm')
  })
  it('üres értéket 0mm-re tölt', () => {
    expect(marginsToCss({ top: '', right: '5', bottom: '', left: '5' })).toBe('0mm 5mm 0mm 5mm')
  })
})

describe('buildPrintPageCss', () => {
  it('@page-et ad a megadott mérettel és margóval', () => {
    const css = buildPrintPageCss({ size: 'A4 landscape', margins: { top: '5', right: '5', bottom: '5', left: '5' } })
    expect(css).toContain('@page { size: A4 landscape; margin: 5mm 5mm 5mm 5mm; }')
  })
  it('alapértelmezett méret A4', () => {
    expect(buildPrintPageCss({ margins: DEFAULT_DOCUMENT_MARGINS })).toContain('size: A4;')
  })
  it('nyomtatáskor nullázza a html/body margót', () => {
    const css = buildPrintPageCss({ margins: DEFAULT_LABEL_MARGINS })
    expect(css).toContain('@media print')
    expect(css).toContain('margin: 0 !important')
  })
  it('0 margó is érvényes', () => {
    const css = buildPrintPageCss({ margins: { top: '0', right: '0', bottom: '0', left: '0' } })
    expect(css).toContain('margin: 0mm 0mm 0mm 0mm;')
  })
})

describe('resolveMargins', () => {
  const fallback: PrintMargins = { top: '10', right: '10', bottom: '10', left: '10' }

  it('null override esetén a fallback', () => {
    expect(resolveMargins(null, fallback)).toEqual(fallback)
  })
  it('teljesen üres override esetén a fallback', () => {
    expect(resolveMargins({ top: '', right: '', bottom: '', left: '' }, fallback)).toEqual(fallback)
  })
  it('részleges override: a megadott mezők nyernek, a többi fallback', () => {
    expect(resolveMargins({ top: '3' }, fallback)).toEqual({ top: '3', right: '10', bottom: '10', left: '10' })
  })
  it('teljes override mindent felülír', () => {
    const o = { top: '2', right: '2', bottom: '2', left: '2' }
    expect(resolveMargins(o, fallback)).toEqual(o)
  })
})
