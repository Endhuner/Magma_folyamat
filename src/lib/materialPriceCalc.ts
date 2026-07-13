/**
 * Mozgó anyagáras árlista-számítás.
 *
 * A képletek a vevős Excelekből származnak (Ela/Seidel/Systec „aktuális árak"):
 * a szerződéses anyagár-bázistól (MPB) való eltérés — leégéssel növelve —
 * súlyarányosan korrigálja a 100 db-os alapárat. A materialPriceCalc.test.ts
 * az Ela-Excel tényleges értékei ellen ellenőrzi.
 */

export interface PriceListParams {
  /** Leégés (Abbrand) — vevőnként eltér (Ela 6%, Systec 5%). */
  burnRate: number
  /** Szerződéses anyagár-bázis €/kg. */
  mpbEurPerKg: number
  /** Aktuális anyagár €/kg (kézzel vagy zamak-átlagból). */
  currentMpEurPerKg: number
}

export interface PriceListItemInput {
  weightG: number
  basePricePer100Eur: number
}

export interface PriceListItemResult {
  /** Diff. durch MP per kg. */
  diffPerKg: number
  /** Diff + Abbrand per kg. */
  diffWithBurnPerKg: number
  /** Preis-Diff. / 100 St. */
  correctionPer100Eur: number
  /** Aktueller Preis / 100 St. */
  currentPricePer100Eur: number
  currentPricePerPieceEur: number
}

export function calcPriceListItem(
  item: PriceListItemInput,
  params: PriceListParams,
): PriceListItemResult {
  const diffPerKg = params.currentMpEurPerKg - params.mpbEurPerKg
  const diffWithBurnPerKg = diffPerKg * (1 + params.burnRate)
  // g → kg/100 db: ×100/1000 = /10
  const correctionPer100Eur = (item.weightG * diffWithBurnPerKg) / 10
  const currentPricePer100Eur = item.basePricePer100Eur + correctionPer100Eur
  return {
    diffPerKg,
    diffWithBurnPerKg,
    correctionPer100Eur,
    currentPricePer100Eur,
    currentPricePerPieceEur: currentPricePer100Eur / 100,
  }
}

export interface ZamakEntry {
  date: string // YYYY-MM-DD
  eurPerKg: number
  note?: string
}

export interface PeriodAverage {
  label: string
  avg: number
  count: number
}

const TWO_MONTH_LABELS = ['Jan–Feb', 'Már–Ápr', 'Máj–Jún', 'Júl–Aug', 'Szep–Okt', 'Nov–Dec']

/**
 * Időszakonkénti számtani átlagok a jegyzésekből, időrendben.
 * `quarter`: 2026 Q1…Q4; `twoMonth`: 2026 Jan–Feb … Nov–Dec.
 */
export function periodAverages(
  entries: ZamakEntry[],
  mode: 'quarter' | 'twoMonth',
): PeriodAverage[] {
  const buckets = new Map<string, { sum: number; count: number; order: number }>()
  for (const e of entries) {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(e.date)
    if (!m) continue
    const year = Number(m[1])
    const month = Number(m[2])
    if (month < 1 || month > 12) continue
    const idx = mode === 'quarter' ? Math.floor((month - 1) / 3) : Math.floor((month - 1) / 2)
    const label =
      mode === 'quarter' ? `${year} Q${idx + 1}` : `${year} ${TWO_MONTH_LABELS[idx]}`
    const order = year * 10 + idx
    const b = buckets.get(label) ?? { sum: 0, count: 0, order }
    b.sum += e.eurPerKg
    b.count += 1
    buckets.set(label, b)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([label, b]) => ({ label, avg: b.sum / b.count, count: b.count }))
}

/** Terméktörzs-kapcsolat: a megnevezés és a súly ÉLŐBEN a termékből jön,
 * ha a cikkszám (rajzszám) egyezik — így a termék-módosítás azonnal
 * átvezet az árlistákra és az Aktuális árak oldalra. */
export interface ResolvedItemSource {
  name: string
  weightG: number | null
  /** true, ha a terméktörzsből jön (van egyező rajzszámú termék). */
  linked: boolean
  productId?: string
}

const normKey = (v: string | null | undefined) =>
  (v || '').toUpperCase().replace(/\s+/g, '')

interface ProductLike {
  id: string
  customer?: string
  drawingNumber?: string
  productName?: string
  weightPerPiece?: string | number | null
}

/** Rajzszám szerinti kereső-index a termékekhez (hívásonként egyszer építsd). */
export function buildProductIndex(products: ProductLike[]): Map<string, ProductLike[]> {
  const map = new Map<string, ProductLike[]>()
  for (const pr of products) {
    const key = normKey(pr.drawingNumber)
    if (!key) continue
    const list = map.get(key)
    if (list) list.push(pr)
    else map.set(key, [pr])
  }
  return map
}

export function resolveItemSource(
  item: { partNumber: string; name?: string; weightG?: number | null },
  customerName: string,
  productIndex: Map<string, ProductLike[]>,
): ResolvedItemSource {
  const fallback: ResolvedItemSource = {
    name: item.name || '',
    weightG: item.weightG ?? null,
    linked: false,
  }
  const candidates = productIndex.get(normKey(item.partNumber))
  if (!candidates || candidates.length === 0) return fallback
  // Több jelöltnél a vevő-név egyezés dönt (a törzsben hosszabb a név,
  // pl. "Ela Solutions Kft." ↔ árlista: "Ela").
  const cust = normKey(customerName)
  const product =
    candidates.length === 1
      ? candidates[0]
      : candidates.find((c) => normKey(c.customer).includes(cust)) ?? candidates[0]
  const w = typeof product.weightPerPiece === 'number'
    ? product.weightPerPiece
    : Number.parseFloat(String(product.weightPerPiece ?? '').replace(',', '.'))
  return {
    name: product.productName || fallback.name,
    weightG: Number.isFinite(w) && w > 0 ? w : fallback.weightG,
    linked: true,
    productId: product.id,
  }
}

/** Rendeléshez tartozó darabárak a vevői árlistákból. */
export interface OrderPiecePrices {
  /** Aktuális darabár €/db (élő anyagárral, MP). */
  currentPerPiece: number
  /** Munkadíj €/db (anyagár nélkül — a képlet MP=0-val). */
  laborPerPiece: number
}

/** Rendelés darabárai a vevői árlistákból:
 *  - árlista: a rendelés vevő-neve tartalmazza az árlista rövid nevét
 *    (pl. "Ela Solutions Kft." ↔ "Ela")
 *  - tétel: a rendelés termékneve (rajzszám) egyezik a tétel cikkszámával
 *  - súly élőben a terméktörzsből (resolveItemSource)
 * null, ha nincs egyezés. */
export function pricesForOrder(
  order: { customer?: string; productName?: string },
  priceLists: Array<{
    customerName: string
    burnRate: number
    mpbEurPerKg: number
    currentMpEurPerKg: number
    items: Array<{ partNumber: string; name?: string; weightG?: number | null; basePricePer100Eur?: number | null }>
  }>,
  productIndex: Map<string, { id: string; customer?: string; drawingNumber?: string; productName?: string; weightPerPiece?: string | number | null }[]>,
): OrderPiecePrices | null {
  const orderCust = normKey(order.customer)
  const drawing = normKey(order.productName)
  if (!drawing) return null
  for (const pl of priceLists) {
    const listCust = normKey(pl.customerName)
    if (!listCust || !orderCust.includes(listCust)) continue
    const item = pl.items.find((i) => normKey(i.partNumber) === drawing)
    if (!item || item.basePricePer100Eur == null) continue
    const src = resolveItemSource(item, pl.customerName, productIndex)
    const weightG = src.weightG ?? 0
    if (!weightG) continue
    const input = { weightG, basePricePer100Eur: item.basePricePer100Eur }
    return {
      currentPerPiece: calcPriceListItem(input, pl).currentPricePerPieceEur,
      // Munkadíj = anyagár nélküli ár: ugyanez a képlet MP=0-val.
      laborPerPiece: calcPriceListItem(input, { ...pl, currentMpEurPerKg: 0 }).currentPricePerPieceEur,
    }
  }
  return null
}
