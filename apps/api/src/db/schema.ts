/**
 * Drizzle ORM schema az összes ProduktívPro entitásra.
 *
 * Tervezési megfontolások:
 * - Minden tábla `id`-ja TEXT (UUID v4). Konzisztens a meglévő frontend-tel,
 *   ami már most is UUID-t generál (`uuid` v11).
 * - Időbélyegek ISO-stringként (`text`), nem unix epoch — egyszerű olvasni,
 *   és a frontend Date-ekkel kompatibilis (ld. `Order.createdAt: string`).
 * - Az enumokat (OrderStatus, AuditEntityType, ...) egyelőre nyers `text`-be
 *   tároljuk runtime-validációval (Zod-sémák a szolgáltatási rétegben).
 *   Drizzle-ben a `text({ enum: [...] })` típushintet ad, de a SQLite-ban
 *   nincs natív enum — mi a Zod-on érvényesítünk.
 * - Foreign key-ek ON DELETE RESTRICT (default) — törléshez tisztítani kell
 *   függő rekordokat, így nem maradnak árvák.
 * - JSON-mezőket (orderIds tömb, exportData, audit changes) `text` módban
 *   tároljuk és a service-rétegben szerializáljuk/deszerializáljuk.
 */
import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

const ORDER_STATUSES = [
  'Felvéve',
  'Szünetel',
  'Kiszállítva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
  'Elkészült',
] as const

const AUDIT_ENTITY_TYPES = [
  'order',
  'customer',
  'product',
  'machine',
  'user',
  'material',
  'shift',
  'defect',
  'inventory',
  'inventoryTransaction',
] as const

const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'status',
  'in',
  'out',
  'adjustment',
  'bulkDelete',
  'bulkImport',
] as const

const SHIFT_PERIODS = ['de', 'du'] as const
const INVENTORY_TX_TYPES = ['in', 'out', 'adjustment'] as const
const DELIVERY_TYPES = ['delivery', 'cmr'] as const

/** Közös default-ok rövidítése. */
const nowDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

// ----------------------------------------------------------------------
// Customers
// ----------------------------------------------------------------------
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  language: text('language').notNull().default(''),
  city: text('city').notNull().default(''),
  postalCode: text('postal_code').notNull().default(''),
  street: text('street').notNull().default(''),
  country: text('country').notNull().default(''),
  fullAddress: text('full_address').notNull().default(''),
  taxNumber: text('tax_number').notNull().default(''),
  deliveryTemplateId: text('delivery_template_id'),
  cmrTemplateId: text('cmr_template_id'),
  labelTemplateId: text('label_template_id'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
}, (t) => ({
  byName: index('customers_name_idx').on(t.name),
}))

// ----------------------------------------------------------------------
// Products
// ----------------------------------------------------------------------
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  // A frontend Product.customer egy név-string (nem id). Megtartjuk a
  // kompatibilitás miatt; később külön referencia lesz.
  customer: text('customer').notNull().default(''),
  drawingNumber: text('drawing_number').notNull().default(''),
  productName: text('product_name').notNull().default(''),
  notes: text('notes').notNull().default(''),
  nestCount: text('nest_count').notNull().default(''),
  weightPerPiece: text('weight_per_piece').notNull().default(''),
  material: text('material').notNull().default(''),
  surfaceTreatment: text('surface_treatment').notNull().default(''),
  cycleTime: text('cycle_time').notNull().default(''),
  postProcessingTime: text('post_processing_time').notNull().default(''),
  postProcessing: text('post_processing').notNull().default(''),
  boxSize: text('box_size').notNull().default(''),
  piecesPerBox: text('pieces_per_box').notNull().default(''),
  boxesPerPallet: text('boxes_per_pallet').notNull().default(''),
  articleNumber: text('article_number').notNull().default(''),
  warehouse: text('warehouse').notNull().default(''),
  spruWeight: text('spru_weight').notNull().default(''),
  autoUpdateInventory: integer('auto_update_inventory', { mode: 'boolean' }).default(true),
  lowStockThreshold: integer('low_stock_threshold'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
}, (t) => ({
  byDrawing: index('products_drawing_idx').on(t.drawingNumber),
  byCustomer: index('products_customer_idx').on(t.customer),
}))

// ----------------------------------------------------------------------
// Orders
// ----------------------------------------------------------------------
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  customer: text('customer').notNull().default(''),
  /**
   * Erős hivatkozás a `products.id`-ra. Opcionális, mert a régi rendelések
   * (Phase 1–3) még csak név-alapon kapcsolódnak. Új rendeléseknél a
   * `OrderDialog` automatikusan beállítja, ha a felhasználó terméket választ.
   * A `findProductForOrder` ezt használja először.
   */
  productId: text('product_id'),
  productName: text('product_name').notNull().default(''),
  designation: text('designation').notNull().default(''),
  notes: text('notes').notNull().default(''),
  ownOrderNumber: text('own_order_number').notNull().default(''),
  material: text('material').notNull().default(''),
  orderNumber: text('order_number').notNull().default(''),
  amountPc: integer('amount_pc').notNull().default(0),
  orderDate: text('order_date').notNull().default(''),
  requiredDate: text('required_date').notNull().default(''),
  pickupDate: text('pickup_date').notNull().default(''),
  invoiced: text('invoiced').notNull().default(''),
  ready: text('ready').notNull().default(''),
  surfaceTreatment: text('surface_treatment').notNull().default(''),
  boxesCount: integer('boxes_count'),
  palletsCount: integer('pallets_count'),
  grossWeightKg: text('gross_weight_kg').notNull().default(''),
  requiredMaterialKg: text('required_material_kg').notNull().default(''),
  plannedProductionHours: text('planned_production_hours').notNull().default(''),
  deliveryNote: text('delivery_note').notNull().default(''),
  cmr: text('cmr').notNull().default(''),
  status: text('status', { enum: ORDER_STATUSES }).notNull().default('Felvéve'),
  /** Pozíció / prioritás szám — opcionális egész, a rendelések rendezéséhez. */
  pos: integer('pos'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
}, (t) => ({
  byStatus: index('orders_status_idx').on(t.status),
  byCustomer: index('orders_customer_idx').on(t.customer),
  byOrderNumber: index('orders_order_number_idx').on(t.orderNumber),
  byProduct: index('orders_product_id_idx').on(t.productId),
}))

// ----------------------------------------------------------------------
// Delivery notes
// ----------------------------------------------------------------------
export const deliveryNotes = sqliteTable('delivery_notes', {
  id: text('id').primaryKey(),
  type: text('type', { enum: DELIVERY_TYPES }).notNull(),
  sequenceNumber: text('sequence_number').notNull().default(''),
  customer: text('customer').notNull().default(''),
  // JSON: string[] (rendelés id-k)
  orderIds: text('order_ids').notNull().default('[]'),
  fileName: text('file_name').notNull().default(''),
  exportDate: text('export_date').notNull().default(''),
  // JSON: Record<string, string|number|null|undefined>[]
  exportData: text('export_data'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
}, (t) => ({
  byType: index('delivery_notes_type_idx').on(t.type),
  byCustomer: index('delivery_notes_customer_idx').on(t.customer),
}))

// ----------------------------------------------------------------------
// Inventory items + transactions
// ----------------------------------------------------------------------
export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull().default(''),
  drawingNumber: text('drawing_number').notNull().default(''),
  customer: text('customer').notNull().default(''),
  quantity: integer('quantity').notNull().default(0),
  totalShots: integer('total_shots'),
  nestCount: text('nest_count'),
  location: text('location').notNull().default(''),
  notes: text('notes').notNull().default(''),
  lastUpdated: text('last_updated').notNull().default(nowDefault),
  createdAt: text('created_at').notNull().default(nowDefault),
}, (t) => ({
  byProduct: index('inventory_product_idx').on(t.productId),
}))

export const inventoryTransactions = sqliteTable('inventory_transactions', {
  id: text('id').primaryKey(),
  inventoryItemId: text('inventory_item_id').notNull(),
  type: text('type', { enum: INVENTORY_TX_TYPES }).notNull(),
  quantity: integer('quantity').notNull(),
  orderId: text('order_id'),
  shiftId: text('shift_id'),
  notes: text('notes').notNull().default(''),
  userId: text('user_id'),
  createdAt: text('created_at').notNull().default(nowDefault),
}, (t) => ({
  byItem: index('inv_tx_item_idx').on(t.inventoryItemId),
  byOrder: index('inv_tx_order_idx').on(t.orderId),
  byShift: index('inv_tx_shift_idx').on(t.shiftId),
}))

// ----------------------------------------------------------------------
// Production: shifts + defects + log
// ----------------------------------------------------------------------
export const productionShifts = sqliteTable('production_shifts', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  date: text('date').notNull(),
  shift: text('shift', { enum: SHIFT_PERIODS }).notNull(),
  shotsCount: integer('shots_count').notNull().default(0),
  producedQuantity: integer('produced_quantity').notNull().default(0),
  notes: text('notes').notNull().default(''),
  userId: text('user_id'),
  endShotsAbsolute: integer('end_shots_absolute'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').default(nowDefault),
}, (t) => ({
  byOrder: index('shifts_order_idx').on(t.orderId),
  byDate: index('shifts_date_idx').on(t.date),
}))

export const productionDefects = sqliteTable('production_defects', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  shiftId: text('shift_id'),
  quantity: integer('quantity').notNull().default(0),
  reason: text('reason').notNull().default(''),
  date: text('date').notNull(),
  userId: text('user_id'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
}, (t) => ({
  byOrder: index('defects_order_idx').on(t.orderId),
  byShift: index('defects_shift_idx').on(t.shiftId),
}))

export const productionLogs = sqliteTable('production_logs', {
  id: text('id').primaryKey(),
  productId: text('product_id'),
  orderId: text('order_id').notNull(),
  action: text('action').notNull(),
  notes: text('notes').notNull().default(''),
  userId: text('user_id'),
  createdAt: text('created_at').notNull().default(nowDefault),
}, (t) => ({
  byOrder: index('plog_order_idx').on(t.orderId),
}))

// ----------------------------------------------------------------------
// Master data: machines, users, materials
// ----------------------------------------------------------------------
export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  serialNumber: text('serial_number').notNull().default(''),
  type: text('type').notNull().default(''),
  capacity: text('capacity').notNull().default(''),
  notes: text('notes').notNull().default(''),
  /** Kép URL (opcionális) — külső link vagy feltöltött kép base64 */
  photoUrl: text('photo_url').notNull().default(''),
  /** JSON tömb: MachineItem[] */
  oils: text('oils').notNull().default('[]'),
  /** JSON tömb: MachineItem[] */
  accessories: text('accessories').notNull().default('[]'),
  /** JSON tömb: MachineRepair[] */
  repairs: text('repairs').notNull().default('[]'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

/**
 * Felhasználó-tábla.
 *
 * Phase 3 bővítés:
 *  - `pinHash`: bcrypt hash (4–8 számjegy PIN-ből). NEVER plaintext.
 *  - `role`: jogosultsági osztály — `admin` | `operator` | `viewer`.
 *  - `active`: ha false, nem tud belépni. Lemondás helyett tiltást használunk,
 *    hogy az audit-logban a userName még rekonstruálható legyen.
 *  - `lastLoginAt`: utolsó sikeres login időbélyege — adminoknak hasznos.
 *
 * Megj.: a régi mezőket (`email`, `notes`) megtartjuk a frontend-szerződés
 * miatt; később ki lehet vonni, ha sehol nem használt.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  email: text('email').notNull().default(''),
  role: text('role', { enum: ['admin', 'operator', 'viewer'] }).notNull().default('operator'),
  notes: text('notes').notNull().default(''),
  pinHash: text('pin_hash'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
}, (t) => ({
  byActive: index('users_active_idx').on(t.active),
}))

export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  type: text('type').notNull().default(''),
  supplier: text('supplier').notNull().default(''),
  unitPrice: text('unit_price').notNull().default(''),
  unit: text('unit').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

// ----------------------------------------------------------------------
// Audit log
// ----------------------------------------------------------------------
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  entityType: text('entity_type', { enum: AUDIT_ENTITY_TYPES }).notNull(),
  entityLabel: text('entity_label').notNull().default(''),
  entityId: text('entity_id').notNull(),
  entityName: text('entity_name').notNull().default(''),
  action: text('action', { enum: AUDIT_ACTIONS }).notNull(),
  // JSON: AuditFieldChange[]
  changes: text('changes'),
  notes: text('notes'),
  userId: text('user_id'),
  userName: text('user_name'),
  createdAt: text('created_at').notNull().default(nowDefault),
}, (t) => ({
  byEntity: index('audit_entity_idx').on(t.entityType, t.entityId),
  byCreated: index('audit_created_idx').on(t.createdAt),
}))

// ----------------------------------------------------------------------
// App settings — általános kulcs-érték tároló alkalmazás-szintű beállításokhoz.
// Pl. cmr-layout-settings, delivery-html-styles, delivery-settings, stb.
// Mindenki ugyanazt látja (shared config).
// ----------------------------------------------------------------------
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  /** JSON-szerializált érték — bármilyen objektum tárolható. */
  value: text('value').notNull().default('{}'),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

// ----------------------------------------------------------------------
// Label templates — cimkenyomtatás sablonjainak tárolása.
// A LabelTemplate interfésznek megfelelő mezők JSON-ben a komplex struktúráknál.
// ----------------------------------------------------------------------
export const labelTemplates = sqliteTable('label_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  type: text('type').notNull().default('label'),
  html: text('html').notNull().default(''),
  css: text('css').notNull().default(''),
  timestamp: text('timestamp').notNull().default(''),
  description: text('description'),
  /** JSON: { top, right, bottom, left } */
  margins: text('margins').notNull().default('{}'),
  labelsPerPage: integer('labels_per_page'),
  labelsPerRow: integer('labels_per_row'),
  labelsPerColumn: integer('labels_per_column'),
  /** JSON: CellSettings objektum */
  cellSettings: text('cell_settings'),
  /** JSON: FontSettings objektum */
  fontSettings: text('font_settings'),
  /** JSON: AlignmentSettings objektum */
  alignmentSettings: text('alignment_settings'),
  /** JSON: PrintSettings objektum */
  printSettings: text('print_settings'),
  /** JSON: PaddingSettings objektum */
  paddingSettings: text('padding_settings'),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

// ----------------------------------------------------------------------
// Customer sequences — szállítólevél sorszámok vevőnként.
// Kulcs: vevőnév (string), érték: aktuális sorszám (egész).
// ----------------------------------------------------------------------
export const customerSequences = sqliteTable('customer_sequences', {
  customerId: text('customer_id').primaryKey(),
  sequence: integer('sequence').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

// ----------------------------------------------------------------------
// Saved document templates — HTML/CSS sablonok szállítólevélhez és CMR-hez.
// App.tsx + GithubStyleTemplateEditor + TemplateBackupRestore használja.
// ----------------------------------------------------------------------
export const savedTemplates = sqliteTable('saved_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  type: text('type').notNull().default('delivery'),
  /** JSON: teljes sablon adat (html, css, margins, stb.) */
  data: text('data').notNull().default('{}'),
  timestamp: text('timestamp').notNull().default(''),
  size: integer('size').notNull().default(0),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

// ----------------------------------------------------------------------
// Gyártástervező — gép-rendelés hozzárendelések (aktuális állapot)
// Minden hozzárendelés exkluzív: egy rendelés egyszerre csak egy gépen lehet.
// ----------------------------------------------------------------------
export const machinePlanningAssignments = sqliteTable('machine_planning_assignments', {
  id: text('id').primaryKey(),
  /** Gép ID (machines.id) */
  machineId: text('machine_id').notNull(),
  /** Rendelés ID (orders.id) */
  orderId: text('order_id').notNull(),
  /** Sorrend a gépen belül (kisebb = előrébb) */
  position: integer('position').notNull().default(0),
  /** Felülírható tervezett gyártási idő (ha eltér a rendelés alapértékétől) */
  plannedHoursOverride: text('planned_hours_override').notNull().default(''),
  assignedAt: text('assigned_at').notNull(),
  createdAt: text('created_at').notNull().default(nowDefault),
  updatedAt: text('updated_at').notNull().default(nowDefault),
})

// ----------------------------------------------------------------------
// Gépalap — audit log: mikor, melyik termék melyik gépre lett rendelve/mozgatva
// Append-only tábla, soha nem törlünk belőle.
// ----------------------------------------------------------------------
export const machinePlanningLog = sqliteTable('machine_planning_log', {
  id: text('id').primaryKey(),
  machineId: text('machine_id').notNull(),
  orderId: text('order_id').notNull(),
  /** 'assigned' | 'removed' | 'moved' */
  action: text('action').notNull(),
  productName: text('product_name').notNull().default(''),
  designation: text('designation').notNull().default(''),
  ownOrderNumber: text('own_order_number').notNull().default(''),
  customer: text('customer').notNull().default(''),
  /** Mozgatásnál: az előző gép ID-je */
  fromMachineId: text('from_machine_id').notNull().default(''),
  userId: text('user_id').notNull().default(''),
  userName: text('user_name').notNull().default(''),
  /** ISO timestamp a log bejegyzéshez */
  timestamp: text('timestamp').notNull(),
  createdAt: text('created_at').notNull().default(nowDefault),
})

// Hagyományos numerikus mezőkhöz, ha valaha kellene `real`-t használni
// (pl. súlyok), itt egy hint:
// example: weightKg: real('weight_kg').notNull().default(0),
export const _realPlaceholder = real // re-export, hogy a tooling ne ráncigálja ki
