/**
 * Megosztott segédfüggvények és típusok a Gyártás-nézet komponenseihez
 * (ProductionView.tsx és MobileProductionView.tsx).
 *
 * Korábban mindkét komponens saját másolatot tartott a következőkről:
 *  - fmtInt (ezres elválasztós formázás)
 *  - findProduct (rendelés→termék párosítás)
 *  - productionOrders szűrés (5 érvényes státusz)
 *  - filterByPriority (prioritás-alapú szűrés)
 *  - sortByDueDate (rendezés szállítási határidő szerint)
 *  - groupByStatus (státusz-csoportosítás)
 *
 * Ezek most egy helyen vannak, így konzisztensek maradnak és a refaktor is olcsóbb.
 */
import type { Order, OrderStatus, Product, ProductionShift } from './types'

/** Egész számok ezres elválasztóval magyar lokalizációban (1500 → "1 500"). */
export function fmtInt(n: number | undefined | null): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Math.round(v).toLocaleString('hu-HU')
}

/**
 * Megkeresi a megadott rendeléshez tartozó terméket.
 *
 * Stratégia:
 *  1. **Erős** referencia: ha az `order.productId` ki van töltve, csak azt
 *     fogadjuk el — egyetlen Product-id egyértelműen meghatározza a terméket.
 *  2. **Fallback** (régi rendelések, vagy ha az erős hivatkozás már törölt
 *     termékre mutatna): visszaesünk a customer + name/drawing egyezésre.
 *     Ez tartja meg a kompatibilitást a productId-előtti rendelésekkel.
 *
 * Megjegyzés: a régi név-alapú párosítás gyengén volt definiálva — a rendelés
 * `productName` mezője a UI-ban *rajzszámot* tárol (ld. OrderDialog), és a
 * `designation` a tényleges nevet. A feltétel-háló mindkét irányt lefedi,
 * de tévesen párosíthat ha két termék hasonló nevű (pl. "T-12" rajzszám
 * találkozik egy "T-12" nevű termékkel egy másik vevőnél). Az 1) ág ezt
 * megszünteti.
 */
export function findProductForOrder(
  order: Order,
  products: Product[]
): Product | undefined {
  if (order.productId) {
    const exact = products.find((p) => p.id === order.productId)
    if (exact) return exact
    // Ha az id már nem létező termékre mutat (pl. törlés után), eshetünk
    // vissza a régi heurisztikára, hogy a UI ne maradjon adat nélkül.
  }
  // Fallback: csak helyes mezőpárosítással keresünk (elkerüljük a cross-field hibát).
  //
  // Az adatmodell:
  //   order.productName  = rajzszám (az OrderDialog a product.drawingNumber-t másolja ide)
  //   order.designation  = termék neve (az OrderDialog a product.productName-t másolja ide)
  //   product.drawingNumber = rajzszám
  //   product.productName   = termék neve
  //
  // Helyes párosítások:
  //   rajzszám ↔ rajzszám: product.drawingNumber === order.productName
  //   terméknév ↔ terméknév: product.productName === order.designation
  //
  // KERÜLENDŐ (cross-field, false positive-ot okoz):
  //   product.productName === order.productName  (terméknév vs rajzszám)
  //   product.drawingNumber === order.designation (rajzszám vs terméknév)

  return products.find(
    (p) =>
      p.customer === order.customer &&
      (
        // Rajzszám egyezés (mindkét oldal rajzszám)
        (order.productName && p.drawingNumber === order.productName) ||
        // Terméknév egyezés (mindkét oldal terméknév)
        (order.designation && p.productName === order.designation)
      )
  )
}

/** A gyártásban "élő" státuszok — a többi (Kiszállítva, Lemondva...) nem jelenik meg. */
export const ACTIVE_PRODUCTION_STATUSES: ReadonlyArray<OrderStatus> = [
  'Felvéve',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
  'Szünetel',
]

/** Csak az aktív gyártási státuszokat tartalmazza. */
export function filterProductionOrders(orders: Order[]): Order[] {
  return orders.filter((o) =>
    (ACTIVE_PRODUCTION_STATUSES as readonly OrderStatus[]).includes(o.status)
  )
}

/**
 * Szövegszűrés rendelési mezők között. Ha üres a query, az eredeti listát adja vissza.
 * NEM ékezet-érzéketlen — a régi viselkedés megőrzése érdekében (toLowerCase only).
 */
export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query) return orders
  const q = query.toLowerCase()
  return orders.filter(
    (o) =>
      o.productName.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.ownOrderNumber.toLowerCase().includes(q)
  )
}

export type PriorityFilter = 'all' | 'urgent' | 'normal'

/**
 * Sürgősség szerinti szűrés (≤7 nap = urgent).
 * Ha nincs határidő → "normal"-nak vesszük.
 */
export function filterByPriority(orders: Order[], filter: PriorityFilter): Order[] {
  if (filter === 'all') return orders
  return orders.filter((o) => {
    if (!o.requiredDate) return filter === 'normal'
    const days = Math.ceil(
      (new Date(o.requiredDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return filter === 'urgent' ? days <= 7 : days > 7
  })
}

/** Növekvő sorrend a szállítási határidő alapján (üres dátum a végére). */
export function sortByDueDate(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const dA = a.requiredDate ? new Date(a.requiredDate).getTime() : Infinity
    const dB = b.requiredDate ? new Date(b.requiredDate).getTime() : Infinity
    return dA - dB
  })
}

/** Műszakok rendelési azonosító szerinti gyors-keresőtérképe. */
export function buildShiftsByOrder(
  shifts: ProductionShift[]
): Map<string, ProductionShift[]> {
  const map = new Map<string, ProductionShift[]>()
  for (const s of shifts) {
    const list = map.get(s.orderId) ?? []
    list.push(s)
    map.set(s.orderId, list)
  }
  return map
}

/** Státusz-csoportokba rendezi a rendeléseket (alapértelmezett kulcsok). */
export function groupOrdersByStatus(orders: Order[]): Record<string, Order[]> {
  return {
    pending: orders.filter((o) => o.status === 'Felvéve'),
    inProgress: orders.filter((o) => o.status === 'Folyamatban'),
    ready: orders.filter((o) => o.status === 'Előkészítve'),
    paused: orders.filter((o) => o.status === 'Szünetel'),
    repair: orders.filter((o) => o.status === 'Javítás alatt'),
    done: orders.filter((o) => o.status === 'Elkészült'),
  }
}
