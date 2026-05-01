/**
 * IndexedDB séma — Dexie verzió-kezeléssel.
 *
 * Minden táblához:
 *   - Elsődleges kulcs: `id` (string, UUID-szerű)
 *   - Indexek: csak azok a mezők, amelyekre a UI ténylegesen szűr/keres
 *
 * A `++` prefix Dexie auto-increment, mi viszont saját UUID-okat
 * használunk (megőrizve a meglévő `id`-ket a localStorage-ból),
 * ezért NINCS auto-increment — `id` lesz az index első tagja.
 *
 * Új index hozzáadásakor:
 *   1. Növeld a DB_VERSION-t.
 *   2. Add hozzá a `versions` map-hez az új .stores() definíciót.
 *   3. Ha adat-átalakítás kell, a database.ts-ben írj `upgrade()` callbacket.
 */

export const DB_NAME = 'tir_db'

/**
 * Sématörténelem. Minden új verzió kumulatívan írja le a sémát
 * (Dexie elvárás).
 *
 * Indexek konvenciói:
 *   - `&` = uniqe (egyedi kulcs az `id` mellett)
 *   - `*` = multi-entry (tömb értékre indexel — pl. orderIds)
 *   - vessző-elválasztott listák = több külön index
 */
export const DB_VERSIONS: Record<number, Record<string, string>> = {
  1: {
    orders:
      'id, customer, productName, status, ownOrderNumber, orderNumber, requiredDate, [customer+productName]',
    products: 'id, customer, drawingNumber, productName, [customer+drawingNumber]',
    customers: 'id, name',
    inventory: 'id, productId, customer, drawingNumber, [customer+drawingNumber]',
    inventoryTransactions: 'id, inventoryItemId, type, orderId, createdAt',
    productionShifts: 'id, orderId, date, [orderId+date+shift]',
    productionDefects: 'id, orderId, date',
    deliveryNotes: 'id, type, sequenceNumber, customer, exportDate, *orderIds',
    auditLog: 'id, entityType, entityId, action, createdAt, [entityType+entityId]',
  },
}

/** Aktuális (legutolsó) séma-verzió. */
export const DB_VERSION = Math.max(...Object.keys(DB_VERSIONS).map(Number))

/** A séma által érintett táblák névlistája. Migrációhoz hasznos. */
export const ENTITY_TABLES = [
  'orders',
  'products',
  'customers',
  'inventory',
  'inventoryTransactions',
  'productionShifts',
  'productionDefects',
  'deliveryNotes',
  'auditLog',
] as const

export type EntityTable = (typeof ENTITY_TABLES)[number]

/**
 * Mely localStorage useKV kulcsról melyik IndexedDB táblára kerül
 * az adat egyszeri migrációkor.
 */
export const KV_TO_TABLE: Record<string, EntityTable> = {
  orders: 'orders',
  products: 'products',
  customers: 'customers',
  inventory: 'inventory',
  'inventory-transactions': 'inventoryTransactions',
  'production-shifts': 'productionShifts',
  'production-defects': 'productionDefects',
  'delivery-notes': 'deliveryNotes',
  'audit-log': 'auditLog',
}
