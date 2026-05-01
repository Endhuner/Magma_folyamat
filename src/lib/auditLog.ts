/**
 * auditLog.ts — Változásnapló (audit-log) segédfüggvények.
 *
 * Egy bejegyzés a `AuditLogEntry` típusú; ez az állomány csak tiszta
 * függvényeket exportál (összeállítás, mező-diff). A bevitel oldal
 * (App.tsx) feladata a `useKV<AuditLogEntry[]>('audit-log', [])`
 * tárolása és hozzáadása.
 *
 *   - `diffObjects(before, after, ignore)` — visszaadja a változott mezőket.
 *   - `buildAuditEntry({...})` — kényelmi factory egy bejegyzéshez.
 *   - `entityLabelFor(type)` — magyar címke az entitás-típushoz.
 *   - `actionLabelFor(action)` — magyar címke a művelethez.
 *   - `fieldLabelFor(entity, field)` — magyar címke egy entitás mezőjéhez (best-effort).
 */
import type {
  AuditAction,
  AuditEntityType,
  AuditFieldChange,
  AuditLogEntry,
} from '@/lib/types'

/**
 * Két objektum mező-szintű eltéréseit gyűjti listába.
 * Csak a top-level kulcsokat hasonlítja össze. Bonyolult almezőket (objektum,
 * tömb) JSON-szerializálással hasonlít — ez stabil ehhez a használathoz, mert
 * az érintett rekordokban (Order, Product stb.) csak primitív értékek vannak.
 */
export function diffObjects(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  ignore: string[] = ['updatedAt']
): AuditFieldChange[] {
  const a = (before || {}) as Record<string, unknown>
  const b = (after || {}) as Record<string, unknown>
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  const out: AuditFieldChange[] = []
  for (const k of keys) {
    if (ignore.includes(k)) continue
    const va = a[k]
    const vb = b[k]
    if (!isEqualValue(va, vb)) {
      out.push({ field: k, before: va, after: vb })
    }
  }
  return out
}

function isEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // null / undefined egységesítése
  if (a == null && b == null) return true
  if (typeof a !== typeof b) {
    // szám-szöveg fuzziness: pl. "0" és 0 ugyanaz a felhasználó számára
    if (
      (typeof a === 'number' && typeof b === 'string') ||
      (typeof a === 'string' && typeof b === 'number')
    ) {
      return String(a) === String(b)
    }
    return false
  }
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return false
}

/** Magyar címkék az entitás-típushoz. */
export function entityLabelFor(type: AuditEntityType): string {
  switch (type) {
    case 'order':
      return 'Rendelés'
    case 'customer':
      return 'Vevő'
    case 'product':
      return 'Termék'
    case 'machine':
      return 'Gép'
    case 'user':
      return 'Felhasználó'
    case 'material':
      return 'Anyag'
    case 'shift':
      return 'Műszak'
    case 'defect':
      return 'Selejt'
    case 'inventory':
      return 'Készlet'
    case 'inventoryTransaction':
      return 'Készletmozgás'
    default:
      return String(type)
  }
}

/** Magyar címkék a művelethez. */
export function actionLabelFor(action: AuditAction): string {
  switch (action) {
    case 'create':
      return 'Létrehozás'
    case 'update':
      return 'Módosítás'
    case 'delete':
      return 'Törlés'
    case 'status':
      return 'Státusz-váltás'
    case 'in':
      return 'Készlet bevét'
    case 'out':
      return 'Készlet kivét'
    case 'adjustment':
      return 'Készlet korrekció'
    case 'bulkDelete':
      return 'Csoportos törlés'
    case 'bulkImport':
      return 'Tömeges import'
    default:
      return String(action)
  }
}

/** Magyar címkék az ismert mezőkhöz, entitás-típus szerint. */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  order: {
    customer: 'Vevő',
    productName: 'Termék / rajzszám',
    designation: 'Megnevezés',
    notes: 'Megjegyzés',
    ownOrderNumber: 'Saját rendelési szám',
    material: 'Anyag',
    orderNumber: 'Rendelési szám',
    amountPc: 'Mennyiség (db)',
    orderDate: 'Rendelés dátuma',
    requiredDate: 'Igényelt dátum',
    pickupDate: 'Elszállítás dátuma',
    invoiced: 'Számlázva',
    ready: 'Készre jelentve',
    surfaceTreatment: 'Felületkezelés',
    boxesCount: 'Dobozok száma',
    palletsCount: 'Raklapok száma',
    grossWeightKg: 'Bruttó súly (kg)',
    requiredMaterialKg: 'Anyagigény (kg)',
    plannedProductionHours: 'Tervezett óra',
    deliveryNote: 'Szállítólevél',
    cmr: 'CMR',
    status: 'Státusz',
  },
  customer: {
    name: 'Név',
    language: 'Nyelv',
    city: 'Város',
    postalCode: 'Irányítószám',
    street: 'Utca',
    country: 'Ország',
    fullAddress: 'Teljes cím',
    taxNumber: 'Adószám',
  },
  product: {
    customer: 'Vevő',
    drawingNumber: 'Rajzszám',
    productName: 'Termék',
    notes: 'Megjegyzés',
    nestCount: 'Fészekszám',
    weightPerPiece: 'Súly / db',
    material: 'Anyag',
    surfaceTreatment: 'Felületkezelés',
    cycleTime: 'Ciklusidő',
    postProcessingTime: 'Utómunka idő',
    postProcessing: 'Utómunka',
    boxSize: 'Dobozméret',
    piecesPerBox: 'Db / doboz',
    boxesPerPallet: 'Doboz / raklap',
    articleNumber: 'Cikkszám',
    warehouse: 'Raktár',
    spruWeight: 'Fröccsöntési hulladék (g)',
    autoUpdateInventory: 'Automatikus készlet',
    lowStockThreshold: 'Alacsony készlet küszöb',
  },
  shift: {
    date: 'Dátum',
    shift: 'Műszak',
    shotsCount: 'Lövésszám',
    producedQuantity: 'Gyártott db',
    notes: 'Megjegyzés',
  },
  defect: {
    date: 'Dátum',
    quantity: 'Mennyiség (db)',
    reason: 'Indok',
  },
  machine: {
    name: 'Név',
    serialNumber: 'Sorozatszám',
    type: 'Típus',
    capacity: 'Kapacitás',
    notes: 'Megjegyzés',
  },
  user: {
    name: 'Név',
    email: 'Email',
    role: 'Szerep',
    notes: 'Megjegyzés',
  },
  material: {
    name: 'Név',
    type: 'Típus',
    supplier: 'Szállító',
    unitPrice: 'Egységár',
    unit: 'Mértékegység',
    notes: 'Megjegyzés',
  },
  inventory: {
    productName: 'Termék',
    drawingNumber: 'Rajzszám',
    customer: 'Vevő',
    quantity: 'Készlet (db)',
    location: 'Raktár',
    notes: 'Megjegyzés',
  },
}

export function fieldLabelFor(entityType: AuditEntityType, field: string): string {
  return FIELD_LABELS[entityType]?.[field] ?? field
}

/**
 * Kényelmi factory egy bejegyzéshez. A hívó csak az érdemi részt adja meg,
 * az `id` és `createdAt` automatikusan kitöltődik.
 */
export function buildAuditEntry(
  partial: Omit<AuditLogEntry, 'id' | 'createdAt'>
): AuditLogEntry {
  const id = `audit-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  return { id, createdAt: new Date().toISOString(), ...partial }
}

/**
 * Maximum bejegyzésszám az audit log alapértelmezetten. localStorage ~5 MB
 * korlátja miatt körülbelül 10 000 bejegyzés még biztonságosan elfér,
 * miközben több hónapnyi visszamenőleges nyomkövetést tesz lehetővé.
 */
export const AUDIT_LOG_MAX_ENTRIES = 10000

/**
 * Audit log rotáció — a legfrissebb `keepLast` bejegyzést tartja meg.
 * A bejegyzéseket `createdAt` szerint csökkenőbe rendezi, így ha a hívó
 * helyett valahol kézzel append-eltek, akkor is a legújabbak maradnak.
 *
 * Visszatérési érték: ha nincs trim szükséges, az **eredeti** tömböt adja
 * vissza (referencia-azonos), így a React fölösleges re-rendert kerülhet.
 */
export function pruneAuditLog(
  entries: AuditLogEntry[] | null | undefined,
  keepLast: number = AUDIT_LOG_MAX_ENTRIES
): AuditLogEntry[] {
  const list = entries || []
  if (list.length <= keepLast) return list as AuditLogEntry[]
  // createdAt szerinti csökkenő rendezés — legutóbbi elöl
  const sorted = [...list].sort((a, b) => {
    const ta = a.createdAt || ''
    const tb = b.createdAt || ''
    return tb.localeCompare(ta)
  })
  // Csak a `keepLast` legutóbbit tartjuk, és visszafordítjuk az eredeti
  // (ascending) tárolási sorrendre, hogy a megjelenítés stabil maradjon.
  return sorted.slice(0, keepLast).reverse()
}

/** Egy érték "lapított" megjelenítése a táblázatban (rövid). */
export function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Igen' : 'Nem'
  if (typeof v === 'number') return v.toLocaleString('hu-HU')
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 77) + '…' : v
  try {
    const s = JSON.stringify(v)
    return s.length > 80 ? s.slice(0, 77) + '…' : s
  } catch {
    return '—'
  }
}
