/**
 * HTML-biztonsági segédek.
 *
 * A sablon-export rendszer (CMR, szállítólevél, címke) szabad-szöveges,
 * felhasználó által megadott mezőket interpolál HTML-be (`${order.productName}`,
 * `${customer.name}`, stb.). Ha egy mező `<script>` vagy `<img onerror=...>`
 * tartalmat hordoz, az XSS-szerű viselkedéshez vezet az exportált fájlban
 * (és nyomtatáskor a böngésző végrehajtja).
 *
 * Az `esc()` és `escAttr()` minimális, függőség-nélküli HTML-escape-elés.
 * Minden felhasználói mezőt ezen keresztül kell átengedni a sablonokban.
 */

/** HTML szövegtartalomba szánt érték escape-elése. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** HTML attribútumba szánt érték escape-elése (idézőjelet is escape-eli). */
export function escAttr(value: unknown): string {
  return esc(value)
}

/**
 * Egy egész objektum primitív string mezőit escape-eli — visszaad egy új
 * objektumot, amelynek string mezői HTML-biztonságosak. A nem-string értékek
 * (number, boolean, null, undefined) változatlanok maradnak.
 */
export function escObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const key in obj) {
    const v = obj[key]
    out[key] = typeof v === 'string' ? esc(v) : v
  }
  return out as T
}
