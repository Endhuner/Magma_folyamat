/**
 * Alapanyag-gazdálkodás a kliens oldalon (A3+B2+C1 csomag).
 *
 * - ÉLŐ BECSLÉS: becsült készlet = könyvelt készlet (item.quantity)
 *   − a "könyvelt-eddig" dátum UTÁNI műszakok számított fogyása.
 *   A fogyás-képlet a szerverrel közös (@produktivpro/shared materialCalc).
 * - A napi könyvelést a szerver végzi (materialConsolidation) — az writes
 *   out-mozgást és lépteti a 'material-booked-through' beállítást.
 * - BEVÉT / VISSZAOLVASZTÁS: in-mozgás [bevét]/[visszaolvasztás] jelöléssel.
 * - LELTÁR (realizálás): adjustment-mozgás [leltár] jelöléssel — a mért érték
 *   az új viszonyítási pont, a becslés innentől tiszta lappal indul.
 */
import { computeConsumptionKg } from '@produktivpro/shared'
import { generateId } from './generateId'
import type {
  InventoryItem,
  InventoryTransaction,
  Order,
  Product,
  ProductionShift,
} from './types'

/** A napi könyvelés állapota: alapanyag-tétel id → 'YYYY-MM-DD' (eddig könyvelve). */
export type MaterialBookedThroughMap = Record<string, string>

export const MATERIAL_BOOKED_THROUGH_KEY = 'material-booked-through'

/** Megjelenítési mértékegység a tétel típusából (nincs külön mező). */
export function unitOf(item: Pick<InventoryItem, 'itemType'>): 'db' | 'kg' {
  return item.itemType === 'alapanyag' ? 'kg' : 'db'
}

export interface MaterialStatus {
  item: InventoryItem
  /** A könyvelt (raktárkönyvi) mennyiség — item.quantity. */
  bookedKg: number
  /** A könyvelés óta lövésekből számított, még nem könyvelt fogyás. */
  unbookedConsumptionKg: number
  /** Élő becslés: bookedKg − unbookedConsumptionKg. */
  estimatedKg: number
  /** Utolsó leltár időpontja (ISO), ha volt. */
  lastStocktakeAt: string | null
  /** Hány termék párosul ehhez az anyaghoz (név alapján). */
  matchedProductCount: number
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Az összes alapanyag-tétel élő állapota.
 *
 * Ha egy anyaghoz még nincs 'könyvelt-eddig' dátum (új tétel, vagy a napi
 * könyvelés még nem futott rá), a MAI naptól számolunk — így a múltbeli
 * műszakok nem húzzák azonnal mínuszba az újonnan felvett készletet.
 */
export function computeMaterialStatuses(
  inventory: InventoryItem[],
  shifts: ProductionShift[],
  orders: Order[],
  products: Product[],
  transactions: InventoryTransaction[],
  bookedThrough: MaterialBookedThroughMap
): MaterialStatus[] {
  const materials = inventory.filter((i) => i.itemType === 'alapanyag')
  if (materials.length === 0) return []

  const today = todayIso()

  return materials.map((item) => {
    const afterDate = bookedThrough[item.id] || today
    const unbooked = computeConsumptionKg(item.productName, shifts, orders, products, {
      afterDate,
    })

    const lastStocktake = transactions
      .filter((t) => t.inventoryItemId === item.id && t.notes?.startsWith('[leltár]'))
      .reduce<string | null>((max, t) => (!max || t.createdAt > max ? t.createdAt : max), null)

    const matchedProductCount = products.filter((p) =>
      // az anyag-név párosítás a közös calc-ban él; itt csak darabszámhoz kell
      p.material && item.productName &&
      (normalize(p.material).includes(normalize(item.productName)) ||
        normalize(item.productName).includes(normalize(p.material)))
    ).length

    const bookedKg = round1(item.quantity)
    const estimatedKg = round1(bookedKg - unbooked)

    return {
      item,
      bookedKg,
      unbookedConsumptionKg: unbooked,
      estimatedKg,
      lastStocktakeAt: lastStocktake,
      matchedProductCount,
    }
  })
}

/** A becsült anyagkészlet összesen (a Rendelések összesítő sávjához). */
export function totalEstimatedMaterialKg(statuses: MaterialStatus[]): number {
  return round1(statuses.reduce((sum, s) => sum + s.estimatedKg, 0))
}

export type MaterialActionKind = 'bevet' | 'visszaolvasztas' | 'leltar'

export const MATERIAL_ACTION_LABEL: Record<MaterialActionKind, string> = {
  bevet: 'Bevételezés',
  visszaolvasztas: 'Visszaolvasztás',
  leltar: 'Leltár (realizálás)',
}

export interface MaterialActionResult {
  updatedItem: InventoryItem
  transaction: InventoryTransaction
  /** Leltárnál a mért és a könyvelt érték eltérése (mért − könyvelt). */
  diffKg?: number
}

/**
 * Egy anyag-művelet (bevét / visszaolvasztás / leltár) átvezetése:
 * visszaadja az új tételt és a mozgást — a hívó menti a settereivel.
 * A leltár ABSZOLÚT értéket állít (a mért kg lesz a készlet), a másik
 * kettő hozzáad.
 */
export function buildMaterialAction(
  item: InventoryItem,
  kind: MaterialActionKind,
  kg: number,
  userId?: string
): MaterialActionResult {
  const now = new Date().toISOString()
  const qty = round1(kg)

  if (kind === 'leltar') {
    const diffKg = round1(qty - item.quantity)
    return {
      updatedItem: { ...item, quantity: qty, lastUpdated: now },
      transaction: {
        id: generateId(),
        inventoryItemId: item.id,
        type: 'adjustment',
        quantity: qty,
        notes: `[leltár] Mért készlet: ${qty} kg (eltérés a könyvelthez: ${diffKg > 0 ? '+' : ''}${diffKg} kg)`,
        userId,
        createdAt: now,
      },
      diffKg,
    }
  }

  const marker = kind === 'bevet' ? '[bevét]' : '[visszaolvasztás]'
  const label = kind === 'bevet' ? 'Anyag bevételezés' : 'Visszaolvasztás bevét'
  return {
    updatedItem: { ...item, quantity: round1(item.quantity + qty), lastUpdated: now },
    transaction: {
      id: generateId(),
      inventoryItemId: item.id,
      type: 'in',
      quantity: qty,
      notes: `${marker} ${label}: ${qty} kg`,
      userId,
      createdAt: now,
    },
  }
}

function round1(n: number): number {
  return Math.round((n || 0) * 10) / 10
}

function normalize(s: string): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
