/**
 * Repo barrel — egyetlen importtal elérhető mind a 9 repo.
 *
 * Használat:
 *   import { ordersRepo, inventoryRepo } from '@/lib/db/repos'
 *
 * Az UI / hook réteg KIZÁRÓLAG ezeken keresztül érje el az IndexedDB-t.
 * A `getDb()` direkt használata kerülendő — ami a sorok és indexek
 * tudását egyetlen helyen tartja, ezzel a refaktorálást és tesztelést
 * is leegyszerűsítve.
 */
export { ordersRepo } from './orders'
export { productsRepo } from './products'
export { customersRepo } from './customers'
export { inventoryRepo } from './inventory'
export type { DeductInput, DeductResult } from './inventory'
export { inventoryTransactionsRepo } from './inventoryTransactions'
export { shiftsRepo } from './shifts'
export { defectsRepo } from './defects'
export { deliveryNotesRepo } from './deliveryNotes'
export { auditLogRepo } from './auditLog'
export type { PagedAuditOpts } from './auditLog'
