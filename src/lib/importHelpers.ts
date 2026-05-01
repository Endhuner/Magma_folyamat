/**
 * Segédek tömeges Excel importhoz: fejléc-tolerancia + cellaérték normalizálás.
 *
 * A gyakorlatban a felhasználók különbözőképpen írják ugyanazt az oszlopot
 * (pl. "Súly/db", "Súly/db g", "Súly/db (g)", "Tömeg/db"). Ez a modul:
 *   1) tolerálja a kis/nagybetűt és a felesleges szóközöket,
 *   2) levágja a fejléc végéről a mértékegységet (`g`, `kg`, `mm`, `cm`, `db`,
 *      `perc`, `sec`, `s`, `min`, `h`, `óra`, `%`) — zárójeles és csupasz formában is,
 *   3) elfogad explicit alias-listát mezőnként (pl. ['Súly/db', 'Tömeg/db']).
 */

const UNIT_SUFFIX_RE = /\s*(?:\(\s*(?:g|kg|mm|cm|m|db|perc|sec|s|min|h|óra|%)\s*\)|\s+(?:g|kg|mm|cm|m|db|perc|sec|s|min|h|óra|%))\s*$/iu

/** Egységesíti a fejléc-szöveget (kisbetű, kollapszált szóközök, levágott mértékegység). */
export function normalizeHeader(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(UNIT_SUFFIX_RE, '')
    .toLowerCase()
}

/** Egy beolvasott Excel-sor fejléceit normalizálja, megőrzi az eredeti értékeket is. */
export interface NormalizedRow {
  raw: Record<string, unknown>
  normalized: Record<string, unknown>
}

export function normalizeRow(raw: Record<string, unknown>): NormalizedRow {
  const normalized: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    const nk = normalizeHeader(key)
    if (nk && normalized[nk] === undefined) {
      normalized[nk] = raw[key]
    }
  }
  return { raw, normalized }
}

/**
 * Megpróbálja kiolvasni a mezőt a sorból a megadott jelölt fejlécek alapján.
 * Először pontos egyezéssel a `raw`-ben, utána normalizálva.
 * Visszaadott érték mindig string (trim-elve), üres ha nincs találat.
 */
export function getField(row: NormalizedRow, ...candidates: string[]): string {
  // 1) Pontos egyezés a nyers fejlécekkel — ha eltalálták az oszlopnevet, ez a leggyorsabb út.
  for (const c of candidates) {
    const v = row.raw[c]
    if (isFilledCell(v)) return cellToString(v)
  }
  // 2) Normalizált egyezés — itt kezeljük a mértékegység-utótagot, kis/nagybetűt, stb.
  for (const c of candidates) {
    const nk = normalizeHeader(c)
    const v = row.normalized[nk]
    if (isFilledCell(v)) return cellToString(v)
  }
  return ''
}

function isFilledCell(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  // Az ExcelJS sok cellafajtát adhat (Date, hyperlink object stb.) — kezeljük az általánosakat.
  return true
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') {
    // Ne dobjuk a tört részt, de takarítsuk a felesleges 0-kat.
    return Number.isInteger(v) ? String(v) : String(v).replace(/\.0+$/, '')
  }
  if (v instanceof Date) {
    // ISO dátum (yyyy-mm-dd) — kompatibilis a típusrendszerünkkel.
    return v.toISOString().slice(0, 10)
  }
  // ExcelJS rich text / hyperlink: { text: '...', richText: [...] } stb.
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text.trim()
    if (typeof obj.result === 'string') return obj.result.trim()
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((r) => r?.text ?? '')
        .join('')
        .trim()
    }
  }
  return String(v).trim()
}
