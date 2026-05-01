/**
 * Dexie singleton + típusos tábla-mapping.
 *
 * A teljes alkalmazás egyetlen Dexie-példányt használ. A táblák tipizált
 * `Table<T, string>` formában jelennek meg, így a repo réteg
 * (orders.ts, products.ts, ...) közvetlenül `db.orders.put(order)`
 * formában dolgozhat — TypeScript ellenőrzéssel.
 *
 * Verzió-frissítés folyamata:
 *   1. Növeld a DB_VERSION-t a schema.ts-ben.
 *   2. Add hozzá a `DB_VERSIONS` map-hez az új sémát.
 *   3. Ha adat-átalakítás kell egy meglévő mezőről, írj egy
 *      `.upgrade(tx => ...)` callbacket az új verzióhoz.
 */
import Dexie, { type Table } from 'dexie'
import {
  DB_NAME,
  DB_VERSIONS,
  type EntityTable,
} from './schema'
import type {
  Order,
  Product,
  Customer,
  InventoryItem,
  InventoryTransaction,
  ProductionShift,
  ProductionDefect,
  DeliveryNote,
  AuditLogEntry,
} from '@/lib/types'

export class TIRDatabase extends Dexie {
  // A `!` azt jelzi a TS-nek, hogy a Dexie konstruktor inicializálja.
  orders!: Table<Order, string>
  products!: Table<Product, string>
  customers!: Table<Customer, string>
  inventory!: Table<InventoryItem, string>
  inventoryTransactions!: Table<InventoryTransaction, string>
  productionShifts!: Table<ProductionShift, string>
  productionDefects!: Table<ProductionDefect, string>
  deliveryNotes!: Table<DeliveryNote, string>
  auditLog!: Table<AuditLogEntry, string>

  constructor() {
    super(DB_NAME)
    // Minden verziót regisztráljuk — Dexie kumulatívan kezeli.
    for (const [versionStr, schema] of Object.entries(DB_VERSIONS)) {
      const version = Number(versionStr)
      this.version(version).stores(schema)
    }
  }

  /** Az összes adat törlése — pl. backup-restore előtti tisztításra. */
  async clearAllTables(): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.orders,
        this.products,
        this.customers,
        this.inventory,
        this.inventoryTransactions,
        this.productionShifts,
        this.productionDefects,
        this.deliveryNotes,
        this.auditLog,
      ],
      async () => {
        await Promise.all([
          this.orders.clear(),
          this.products.clear(),
          this.customers.clear(),
          this.inventory.clear(),
          this.inventoryTransactions.clear(),
          this.productionShifts.clear(),
          this.productionDefects.clear(),
          this.deliveryNotes.clear(),
          this.auditLog.clear(),
        ])
      }
    )
  }

  /** Egy táblát névvel ér el. Migrációs/backup eszközöknek kényelmes. */
  tableByName(name: EntityTable): Table<unknown, string> {
    return this.table(name) as Table<unknown, string>
  }
}

/**
 * Lazy singleton — csak akkor jön létre, ha valóban használjuk
 * (pl. tesztben fake-indexeddb-t cserélünk be előtte).
 */
let _instance: TIRDatabase | null = null

export function getDb(): TIRDatabase {
  if (!_instance) {
    _instance = new TIRDatabase()
  }
  return _instance
}

/** Tesztcélra: új példánnyal felülírjuk az aktuálisat. */
export function _resetDbForTests(): void {
  if (_instance) {
    _instance.close()
    _instance = null
  }
}
