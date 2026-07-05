export type OrderStatus =
  | 'Felvéve'
  | 'Szünetel'
  | 'Kiszállítva'
  | 'Kiszállítva/Számlázva'
  | 'Csomagolás alatt'
  | 'Folyamatban'
  | 'Előkészítve'
  | 'Javítás alatt'
  | 'Elkészült'

export interface Order {
  id: string
  customer: string
  /**
   * Hivatkozott Product.id — opcionális, mert a régi rendelések még nem
   * tartalmazzák. Ha van, ezt használjuk a gyártáshoz / készlethez tartozó
   * termék párosításához (`findProductForOrder`), és csak fallback-ként
   * vesszük figyelembe a `customer + productName/designation` egyezést.
   */
  productId?: string
  productName: string
  designation: string
  notes: string
  ownOrderNumber: string
  material: string
  orderNumber: string
  amountPc: number
  orderDate: string
  requiredDate: string
  pickupDate: string
  invoiced: string
  ready: string
  surfaceTreatment: string
  boxesCount: number | null
  palletsCount: number | null
  grossWeightKg: string
  requiredMaterialKg: string
  plannedProductionHours: string
  deliveryNote: string
  cmr: string
  status: OrderStatus
  /** Pozíció / prioritás szám — opcionális egész. */
  pos?: number | null
  createdAt: string
  updatedAt: string
}

export interface DashboardMetrics {
  totalOrders: number
  pendingOrders: number
  inProductionOrders: number
  readyForDeliveryOrders: number
  deliveredOrders: number
  invoicedOrders: number
}

export interface DailyProductionData {
  date: string
  label: string
  produced: number
  defects: number
}

export interface ProductionKPIs {
  todayProduced: number
  weekProduced: number
  weekDefects: number
  defectRate: number
  dailyData: DailyProductionData[]
}

export interface Customer {
  id: string
  name: string
  language: string
  city: string
  postalCode: string
  street: string
  country: string
  fullAddress: string
  taxNumber: string
  email?: string
  deliveryTemplateId?: string | null
  cmrTemplateId?: string | null
  labelTemplateId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  customer: string
  drawingNumber: string
  productName: string
  notes: string
  nestCount: string
  weightPerPiece: string
  material: string
  surfaceTreatment: string
  cycleTime: string
  postProcessingTime: string
  postProcessing: string
  boxSize: string
  piecesPerBox: string
  boxesPerPallet: string
  articleNumber: string
  warehouse: string
  spruWeight: string
  /** Automatikus készletfrissítés műszakrögzítéskor (lövésszám × fészekszám). */
  autoUpdateInventory?: boolean
  /** Alacsony készlet küszöb (db). A figyelmeztető banner ennél kevesebb darabszámot jelez. */
  lowStockThreshold?: number
  /** Termékhez rendelt egyedi etiketta sablon ID (saved-templates). Ha null, az aktív sablon érvényes. */
  labelTemplateId?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Kiegészítő tétel a szállítólevélen — rendszerben nem lévő szabad sor,
 * vagy készletből (szerszám / alapanyag / termék) felvett tétel.
 */
export interface ExtraDeliveryItem {
  name: string
  quantity: number
  unit: 'db' | 'kg'
  notes?: string
}

export interface DeliveryNote {
  id: string
  type: 'delivery' | 'cmr'
  sequenceNumber: string
  customer: string
  orderIds: string[]
  fileName: string
  exportDate: string
  issueDate?: string
  exportData?: Record<string, string | number | null | undefined>[]
  /** Kiegészítő tételek — a nyomtatott dokumentumon a rendelés-sorok után. */
  extraItems?: ExtraDeliveryItem[]
  createdAt: string
  updatedAt: string
}

export interface CustomerSequenceCounter {
  [customerId: string]: number
}

export interface ColumnFilter {
  id: string
  name: string
  columns: string[]
  createdAt: string
}

export interface InventoryItem {
  id: string
  productId: string
  productName: string
  drawingNumber: string
  customer: string
  quantity: number
  /** Összes rögzített lövés a termék teljes élettartama alatt (gyártási kumulatív). */
  totalShots?: number
  /** Termékhez tartozó fészekszám, cache-elve. Üres ha a termékről nem érkezett adat. */
  nestCount?: string
  /** 'termek' (kész termék) | 'szerszam' | 'alapanyag' — a polc-nézet színkódjához. */
  itemType?: 'termek' | 'szerszam' | 'alapanyag'
  location: string
  notes: string
  lastUpdated: string
  createdAt: string
}

export interface InventoryTransaction {
  id: string
  inventoryItemId: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  orderId?: string
  /** Ha a bevét műszakból származik, ide mentjük a hivatkozott ProductionShift.id-t. */
  shiftId?: string
  notes: string
  userId?: string
  createdAt: string
}

/**
 * Gyártási műszak rögzítés (PRD §3.5 / §4.4).
 * Egy nap – egy műszak – egy rendelés kombinációra.
 * A darabszám a `shotsCount × nestCount` képlet szerint automatikusan kiszámítódik
 * a műszakrögzítés pillanatában és a készletbe (ha a termék `autoUpdateInventory`-ja be van kapcsolva) bevétként átvezetődik.
 */
export interface ProductionShift {
  id: string
  orderId: string
  /** YYYY-MM-DD formátum. */
  date: string
  /** de = délelőtt, du = délután. */
  shift: 'de' | 'du'
  shotsCount: number
  /** Kalkulált gyártott darabszám a rögzítés pillanatában: shotsCount × (Product.nestCount). */
  producedQuantity: number
  notes: string
  userId?: string
  /** Abszolút vég lövésszám (a számlálón lévő érték a műszak végén). A következő műszak kezdő értékének auto-kitöltéséhez. */
  endShotsAbsolute?: number
  /** Opcionális gép-hivatkozás (Machine.id). */
  machineId?: string
  createdAt: string
  updatedAt?: string
}

/**
 * Selejt rögzítés egy rendeléshez. Külön entitás a műszaktól, mert
 *  - lehet műszakhoz nem köthető (pl. utólagos minőségi ellenőrzés)
 *  - mennyisége db-ban van (a műszaknál lövés × fészek alapján számolódik a darabszám)
 *  - külön kell jelenteni / összesíteni
 */
export interface ProductionDefect {
  id: string
  orderId: string
  /** Opcionális hivatkozás a műszakra, amelyhez tartozik. */
  shiftId?: string
  /** Selejt mennyiség darabban. */
  quantity: number
  /** Indok / megjegyzés. */
  reason: string
  /** YYYY-MM-DD. */
  date: string
  userId?: string
  createdAt: string
  updatedAt: string
}

/**
 * Naplóbejegyzés — minden jelentős gyártási eseményt (státuszváltás, műszak rögzítés, javítás)
 * auditálható sorban tart.
 */
export interface ProductionLog {
  id: string
  productId?: string
  orderId: string
  action: string
  notes: string
  userId?: string
  createdAt: string
}

/**
 * Gép karbantartási tétel (olaj, kiegészítő).
 */
export interface MachineItem {
  id: string
  name: string
  drawingNumber: string
  quantity: number
  unit: string
  source: string
  notes: string
  createdAt: string
}

/**
 * Gép javítási tétel — dátummal és állapottal.
 */
export interface MachineRepair {
  id: string
  name: string
  drawingNumber: string
  quantity: number
  unit: string
  source: string
  date: string
  status: 'tervezett' | 'elvégzett'
  notes: string
  createdAt: string
}

/**
 * Felhasználók közti üzenet vagy feladat.
 * toUserId = 'all' → mindenkinek szól. readAt/doneAt üres = még nem történt meg.
 */
export interface AppMessage {
  id: string
  kind: 'uzenet' | 'feladat'
  body: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  readAt: string
  doneAt: string
  createdAt: string
  updatedAt: string
}

/**
 * Gép-karbantartási bejegyzés — a MachineRepair (ad-hoc javítás) mellett ez
 * az ütemezett/esedékes karbantartásokat követi (nextDueAt = következő
 * esedékesség), külön szerver-táblában, hogy lekérdezhető és riasztható legyen.
 */
export interface MachineMaintenance {
  id: string
  machineId: string
  type: 'scheduled' | 'repair' | 'inspection'
  description: string
  /** Elvégzés dátuma (ISO YYYY-MM-DD), üres ha még nem történt meg. */
  performedAt: string
  /** Következő esedékesség (ISO YYYY-MM-DD), üres ha nem ismétlődő. */
  nextDueAt: string
  cost: string
  performedBy: string
  createdAt: string
  updatedAt: string
}

/**
 * Gép — egyszerű lista a műhely gépeiről.
 */
export interface Machine {
  id: string
  name: string
  serialNumber: string
  type: string
  capacity: string
  notes: string
  photoUrl?: string
  oils?: MachineItem[]
  accessories?: MachineItem[]
  repairs?: MachineRepair[]
  /** A tételt létrehozó felhasználó ID-ja — jogosultság-ellenőrzéshez. */
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface MachinePlanningAssignment {
  id: string
  machineId: string
  orderId: string
  position: number
  plannedHoursOverride: string
  assignedAt: string
  createdAt: string
  updatedAt: string
}

export interface MachinePlanningLogEntry {
  id: string
  machineId: string
  orderId: string
  action: 'assigned' | 'removed' | 'moved'
  productName: string
  designation: string
  ownOrderNumber: string
  customer: string
  fromMachineId: string
  userId: string
  userName: string
  timestamp: string
  createdAt: string
}

/**
 * Felhasználó — a rendszer használói. A backend `users` tábla 1:1
 * megfelelője. Phase 3-tól PIN-nel jelentkezik be (a `pinHash` mezőt
 * a backend SOHA nem küldi vissza — csak a típus tartalmazza, hogy a
 * Drizzle-row típusa egyezzen).
 */
export interface User {
  id: string
  name: string
  email: string
  /** 'admin' | 'operator' | 'viewer' — a backend Zod-enum elfogadott értékei. */
  role: string
  notes: string
  /** Csak backend-belső; a /me / /users válaszokból kihagyjuk. */
  pinHash?: string | null
  /** false esetén a user nem tud belépni (zárolt). Default: true. */
  active?: boolean
  /** Utolsó sikeres belépés ISO timestamp-je, ha volt. */
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Anyag — egyszerű lista a felhasznált alapanyagokról.
 */
export interface Material {
  id: string
  name: string
  type: string
  supplier: string
  unitPrice: string
  unit: string
  notes: string
  /** A tételt létrehozó felhasználó ID-ja — jogosultság-ellenőrzéshez. */
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * Egy mező-szintű változás a változásnaplóban.
 * Csak akkor mentjük, ha a mező értéke ténylegesen különbözik
 * (mély-egyenlőséggel detektálva). Az érték-mezők bármilyen
 * serializable JSON-érték lehetnek.
 */
export interface AuditFieldChange {
  field: string
  /** Felhasználó-barát mező-felirat (opcionális, pl. "Mennyiség (db)"). */
  label?: string
  before: unknown
  after: unknown
}

/** Az audit-log által követett entitás-típusok. */
export type AuditEntityType =
  | 'order'
  | 'customer'
  | 'product'
  | 'machine'
  | 'user'
  | 'material'
  | 'shift'
  | 'defect'
  | 'inventory'
  | 'inventoryTransaction'

/** Az audit-log műveletek. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status'
  | 'in'
  | 'out'
  | 'adjustment'
  | 'bulkDelete'
  | 'bulkImport'

/**
 * A változásnapló (audit-log) egységes bejegyzése.
 * Minden jelentős entitás-művelet egy ilyen sort generál a nyomonkövetéshez.
 *  - `changes`: 'update' esetén kötelező; egyéb műveleteknél opcionális.
 *  - 'status': rendelési státusz-váltás (ld. order entitás).
 *  - 'in' / 'out' / 'adjustment': készletmozgások.
 */
export interface AuditLogEntry {
  id: string
  entityType: AuditEntityType
  /** Felhasználó-barát entitásnév magyarul (pl. "Rendelés", "Termék"). */
  entityLabel: string
  entityId: string
  /** Olvasható megnevezés (pl. rendelésszám / vevő / név). */
  entityName: string
  action: AuditAction
  changes?: AuditFieldChange[]
  /** Szabadszöveges összegzés / megjegyzés. */
  notes?: string
  userId?: string
  userName?: string
  createdAt: string
}
