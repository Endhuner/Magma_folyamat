/**
 * Nyomtatási margók — KÖZÖS forrás minden nyomtatható dokumentumhoz.
 *
 * Korábban minden sablon (szállítólevél, CMR, etikett, raklap-címke, alap
 * címke) külön, eltérő módon kezelte a margót, ezért nyomtatáskor mindig
 * kézzel kellett igazítani. Innentől két, egyszer beállítható margó van:
 *  - DOKUMENTUM margó: szállítólevél + CMR
 *  - CÍMKE margó: raklap-címke + alap címke
 * (Az Etikett a saját, sablon-szintű margóit tartja, csak egységesen,
 *  a közös segéddel kibocsátva.)
 *
 * A margók milliméterben, MÉRTÉKEGYSÉG NÉLKÜLI string-ként tárolódnak
 * (pl. "10"), illeszkedve a meglévő sablonok konvenciójához.
 */

export interface PrintMargins {
  /** mm, mértékegység nélkül (pl. "10"). */
  top: string
  right: string
  bottom: string
  left: string
}

export const DEFAULT_DOCUMENT_MARGINS: PrintMargins = {
  top: '10',
  right: '10',
  bottom: '10',
  left: '10',
}

export const DEFAULT_LABEL_MARGINS: PrintMargins = {
  top: '5',
  right: '5',
  bottom: '5',
  left: '5',
}

/** `useAppSetting` kulcsok — a margók globálisan, egyszer állíthatók. */
export const DOCUMENT_MARGINS_SETTING_KEY = 'document-print-margins'
export const LABEL_MARGINS_SETTING_KEY = 'label-print-margins'

export type PageSize = 'A4' | 'A4 portrait' | 'A4 landscape'

/** `{top,right,bottom,left}` → `"10mm 10mm 10mm 10mm"` CSS rövidítés. */
export function marginsToCss(m: PrintMargins): string {
  const v = (s: string) => `${(s ?? '').toString().trim() || '0'}mm`
  return `${v(m.top)} ${v(m.right)} ${v(m.bottom)} ${v(m.left)}`
}

/**
 * Egységes nyomtatási oldal-CSS. MINDEN sablon ezt használja, hogy a margó
 * mindenhol azonos szerkezettel, az `@page`-en keresztül érvényesüljön —
 * így a böngésző nyomtatási ablaka „Default" margón hagyható, és nem kell
 * dokumentumonként állítgatni.
 */
export function buildPrintPageCss(opts: { size?: PageSize; margins: PrintMargins }): string {
  const size = opts.size ?? 'A4'
  return [
    `@page { size: ${size}; margin: ${marginsToCss(opts.margins)}; }`,
    `@media print { html, body { margin: 0 !important; } }`,
  ].join('\n')
}

/**
 * Margó-feloldás: ha az `override` érvényes (van legalább egy megadott
 * érték), azt használjuk, különben a `fallback`-et. A sablon-szintű margó
 * (pl. szállítólevél-sablon) így továbbra is felülírja a globális alapot.
 */
export function resolveMargins(
  override: Partial<PrintMargins> | null | undefined,
  fallback: PrintMargins
): PrintMargins {
  if (!override) return fallback
  const has = (s: unknown) => typeof s === 'string' && s.trim() !== ''
  if (!has(override.top) && !has(override.right) && !has(override.bottom) && !has(override.left)) {
    return fallback
  }
  return {
    top: has(override.top) ? (override.top as string) : fallback.top,
    right: has(override.right) ? (override.right as string) : fallback.right,
    bottom: has(override.bottom) ? (override.bottom as string) : fallback.bottom,
    left: has(override.left) ? (override.left as string) : fallback.left,
  }
}
