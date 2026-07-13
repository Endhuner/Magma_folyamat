/**
 * Anyagfogyás-számítás — a kliens (élő becslés) és a szerver (napi könyvelés)
 * KÖZÖS logikája, hogy a kettő garantáltan ugyanazt számolja.
 *
 * Képlet: fogyás(kg) = lövésszám × (fészekszám × darabsúly[g] + beömlő-súly[g]) / 1000
 *
 * A termék ↔ alapanyag párosítás név-alapú: a termék `material` mezője
 * (pl. "Z410") és az alapanyag készlet-tétel neve (pl. "Z410 tömb") közül
 * az egyik tartalmazza a másikat (ékezet- és kisbetű-érzéketlenül).
 *
 * Függőség-mentes, szűk interfészekkel — a hívó a saját típusait adja át.
 */

export interface ShiftLike {
  orderId: string
  /** YYYY-MM-DD */
  date: string
  shotsCount: number
}

export interface OrderLike {
  id: string
  productId?: string | null
  customer: string
  productName: string
  designation: string
}

export interface ProductLike {
  id: string
  customer: string
  productName: string
  drawingNumber: string
  material: string
  nestCount?: string | null
  weightPerPiece?: string | null
  spruWeight?: string | null
}

/** Magyar tizedesvessző-tűrő szám-parse (a frontend parseFloatSafe portja). */
function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

/** Ékezet-eltávolító normalizálás (a frontend stripDiacritics portja). */
function norm(s: string | undefined | null): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Igaz, ha az alapanyag-tétel neve és a termék anyag-mezője összetartozik.
 * Tartalmazás mindkét irányban ("Z410" ↔ "Z410 tömb"); 2 karakternél rövidebb
 * érték sosem párosul (a "Z" ne találjon mindent).
 */
export function materialNameMatches(materialItemName: string, productMaterial: string): boolean {
  const a = norm(materialItemName)
  const b = norm(productMaterial)
  if (a.length < 2 || b.length < 2) return false
  return a.includes(b) || b.includes(a)
}

/**
 * Egy termék lövésenkénti anyagigénye kg-ban.
 * A darabsúly és a beömlő-súly grammban tárolt; hiányzó fészekszám = 1.
 */
export function shotConsumptionKg(product: ProductLike, shots: number): number {
  if (!shots || shots <= 0) return 0
  const nest = num(product.nestCount, 1) || 1
  const weightG = num(product.weightPerPiece, 0)
  const spruG = num(product.spruWeight, 0)
  return (shots * (nest * weightG + spruG)) / 1000
}

/**
 * A rendeléshez tartozó termék megkeresése (a frontend findProductForOrder
 * hordozható portja): productId az erős hivatkozás, utána vevőn belüli
 * rajzszám/név egyezés.
 */
export function findProductLike<P extends ProductLike>(
  order: OrderLike,
  products: P[]
): P | undefined {
  if (order.productId) {
    const exact = products.find((p) => p.id === order.productId)
    if (exact) return exact
  }
  return products.find(
    (p) =>
      p.customer === order.customer &&
      ((order.productName && p.drawingNumber === order.productName) ||
        (order.designation && p.productName === order.designation) ||
        (order.productName && p.productName === order.productName))
  )
}

export interface ConsumptionOptions {
  /** Csak az ENNÉL KÉSŐBBI (>) dátumú műszakok számítanak (YYYY-MM-DD). */
  afterDate?: string
  /** Csak az ENNÉL KORÁBBI (<) dátumú műszakok számítanak (YYYY-MM-DD). */
  beforeDate?: string
}

/**
 * Egy alapanyag összes fogyása kg-ban a megadott műszakokból.
 * Kihagyja azokat a műszakokat, amelyek rendelése/terméke nem párosítható,
 * vagy a termék anyaga nem ehhez az alapanyaghoz tartozik.
 */
export function computeConsumptionKg(
  materialItemName: string,
  shifts: ShiftLike[],
  orders: OrderLike[],
  products: ProductLike[],
  opts: ConsumptionOptions = {}
): number {
  const orderById = new Map(orders.map((o) => [o.id, o]))
  // rendelés → termék cache, hogy 50+ műszaknál ne fusson újra a párosítás
  const productByOrder = new Map<string, ProductLike | undefined>()

  let totalKg = 0
  for (const shift of shifts) {
    if (opts.afterDate && !(shift.date > opts.afterDate)) continue
    if (opts.beforeDate && !(shift.date < opts.beforeDate)) continue
    const order = orderById.get(shift.orderId)
    if (!order) continue
    let product = productByOrder.get(order.id)
    if (!productByOrder.has(order.id)) {
      product = findProductLike(order, products)
      productByOrder.set(order.id, product)
    }
    if (!product) continue
    if (!materialNameMatches(materialItemName, product.material)) continue
    totalKg += shotConsumptionKg(product, shift.shotsCount)
  }
  return Math.round(totalKg * 10) / 10
}
