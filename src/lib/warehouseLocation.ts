/**
 * Raktári helykód-kezelés a polc-nézethez.
 *
 * A helykód a meglévő `InventoryItem.location` szabad-szöveges mezőjére épül:
 * ha a mező a strukturált `ÁLLVÁNY-SZINT-REKESZ` formátumot követi (pl. "A-2-3"),
 * a polc-nézet vizuálisan elhelyezi; minden más érték (szabad szöveg, üres)
 * a "hely nélküli" listába kerül — visszafelé teljesen kompatibilis.
 *
 * Az állvány-kiosztás (hány szint, hány rekesz) a szerveren tárolt
 * 'warehouse-racks' beállításból jön (useAppSetting), így minden felhasználó
 * ugyanazt a raktárt látja.
 */
import type { InventoryItem } from './types'

export interface RackConfig {
  /** Rövid azonosító, a helykód első tagja (pl. 'A', 'SZ'). */
  id: string
  /** Megjelenített név (pl. 'A állvány', 'Szerszámszekrény'). */
  name: string
  /** Szintek (polcok) száma — 1 = legalsó. */
  levels: number
  /** Rekeszek száma szintenként. */
  binsPerLevel: number
}

export const DEFAULT_RACKS: RackConfig[] = [
  { id: 'A', name: 'A állvány', levels: 4, binsPerLevel: 5 },
  { id: 'B', name: 'B állvány', levels: 4, binsPerLevel: 5 },
  { id: 'C', name: 'C állvány', levels: 4, binsPerLevel: 5 },
]

export interface ParsedLocation {
  rackId: string
  level: number
  bin: number
}

const LOCATION_RE = /^\s*([A-Za-z][A-Za-z0-9]{0,5})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/

/**
 * Helykód értelmezése. `null`, ha a mező nem strukturált helykód
 * (szabad szöveg, üres, vagy 0 értékű szint/rekesz).
 */
export function parseLocationCode(location: string | undefined | null): ParsedLocation | null {
  if (!location) return null
  const m = String(location).match(LOCATION_RE)
  if (!m) return null
  const level = Number.parseInt(m[2], 10)
  const bin = Number.parseInt(m[3], 10)
  if (level < 1 || bin < 1) return null
  return { rackId: m[1].toUpperCase(), level, bin }
}

/** Helykód összeállítása kanonikus formában (nagybetűs állvány-id). */
export function formatLocationCode(rackId: string, level: number, bin: number): string {
  return `${rackId.toUpperCase()}-${level}-${bin}`
}

/** Igaz, ha a helykód a megadott állvány-kiosztáson belülre esik. */
export function isWithinRack(loc: ParsedLocation, rack: RackConfig): boolean {
  return (
    loc.rackId === rack.id.toUpperCase() &&
    loc.level >= 1 && loc.level <= rack.levels &&
    loc.bin >= 1 && loc.bin <= rack.binsPerLevel
  )
}

export interface PlacedItem {
  item: InventoryItem
  loc: ParsedLocation
}

export interface WarehouseIndex {
  /** rackId (nagybetűs) → elhelyezett tételek. */
  byRack: Map<string, PlacedItem[]>
  /** Hely nélküli tételek: üres vagy nem értelmezhető location. */
  unplaced: InventoryItem[]
  /** Értelmezhető helykódú, de a kiosztásban nem létező állványra mutató tételek. */
  orphaned: PlacedItem[]
}

/**
 * A teljes készlet szétosztása állványokra egyetlen menetben.
 * A `racks` kiosztáson kívüli (pl. törölt állványra mutató) kódok az
 * `orphaned` listába kerülnek, hogy ne tűnjenek el csendben.
 */
export function buildWarehouseIndex(
  inventory: InventoryItem[],
  racks: RackConfig[]
): WarehouseIndex {
  const rackIds = new Set(racks.map((r) => r.id.toUpperCase()))
  const byRack = new Map<string, PlacedItem[]>()
  for (const id of rackIds) byRack.set(id, [])
  const unplaced: InventoryItem[] = []
  const orphaned: PlacedItem[] = []

  for (const item of inventory) {
    const loc = parseLocationCode(item.location)
    if (!loc) {
      unplaced.push(item)
      continue
    }
    const rack = racks.find((r) => r.id.toUpperCase() === loc.rackId)
    if (!rack || loc.level > rack.levels || loc.bin > rack.binsPerLevel) {
      orphaned.push({ item, loc })
      continue
    }
    byRack.get(loc.rackId)!.push({ item, loc })
  }

  // Szint (fentről lefelé rendereljük, itt csak stabil sorrend) + rekesz szerint
  for (const list of byRack.values()) {
    list.sort((a, b) => a.loc.level - b.loc.level || a.loc.bin - b.loc.bin)
  }

  return { byRack, unplaced, orphaned }
}

/** Foglalt rekeszek száma egy állványon (egy rekeszben több tétel is lehet). */
export function occupiedBinCount(placed: PlacedItem[]): number {
  const bins = new Set(placed.map((p) => `${p.loc.level}-${p.loc.bin}`))
  return bins.size
}

/**
 * Doboz-szélesség a polc-nézethez: a mennyiséggel nő, de korlátok közt marad
 * (gyök-skála, hogy az 1200 db ne nyomja ki a 3 db-ot a képből).
 */
export function boxWidthPx(quantity: number): number {
  const q = Math.max(0, quantity || 0)
  return Math.round(Math.min(260, 96 + Math.sqrt(q) * 4.5))
}
