/**
 * backupSchema.ts — Zod sémák a `BackupRestore` import / restore folyamathoz.
 *
 * Cél: a felhasználó által megadott JSON fájl tartalma ne tudja sérteni a
 * runtime-ot. A korábbi `if (!data.version || !data.timestamp)` ellenőrzés
 * megengedte, hogy pl. egy `orders: "string"` szétdobja az `setOrders`-t.
 *
 * Filozófia:
 *   - **Lazítás-toleráns**: ismeretlen mezőket nem dobunk ki (`.passthrough()`),
 *     hogy az új sémához tartozó régi mentések is működjenek.
 *   - **Nem ölünk meg jó adatot rossz miatt**: a tömbök elemeit a `safeParse`
 *     után a hívó szűrheti tovább, ha akarja. Mi csak a top-level shape-et
 *     ellenőrizzük szigorúan.
 *   - **Hibák magyarul**: a Zod alap üzenetek angolul jönnek, ezért a hívó
 *     a `formatBackupError` segítségével olvasható magyar üzenetet kap.
 */
import { z } from 'zod'

// --- Alap rekord-sémák -------------------------------------------------------
// `passthrough()` — engedjük az ismeretlen extra mezőket, hogy újabb / régebbi
// schema-verziók közti különbségek ne dobjanak hibát. A kötelező mezőket
// szigorúan típusoljuk, hogy biztosan ne kerüljön be `undefined.foo` típusú
// runtime-baleset.
//
// Az `id` minden rekordnál kötelező, hiszen a kulcs a duplikátum-deduplikáláshoz.

const baseRecord = z.object({
  id: z.string().min(1, 'Hiányzó id'),
})

const OrderSchema = baseRecord.extend({
  customer: z.string().optional().default(''),
  productName: z.string().optional().default(''),
  designation: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  ownOrderNumber: z.string().optional().default(''),
  material: z.string().optional().default(''),
  orderNumber: z.string().optional().default(''),
  amountPc: z.number().optional().default(0),
  orderDate: z.string().optional().default(''),
  requiredDate: z.string().optional().default(''),
  pickupDate: z.string().optional().default(''),
  invoiced: z.string().optional().default(''),
  ready: z.string().optional().default(''),
  surfaceTreatment: z.string().optional().default(''),
  boxesCount: z.union([z.number(), z.null()]).optional().nullable().default(null),
  palletsCount: z.union([z.number(), z.null()]).optional().nullable().default(null),
  grossWeightKg: z.string().optional().default(''),
  requiredMaterialKg: z.string().optional().default(''),
  plannedProductionHours: z.string().optional().default(''),
  deliveryNote: z.string().optional().default(''),
  cmr: z.string().optional().default(''),
  status: z.string().optional().default('Felvéve'),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
}).passthrough()

const CustomerSchema = baseRecord.extend({
  name: z.string().optional().default(''),
  language: z.string().optional().default(''),
  city: z.string().optional().default(''),
  postalCode: z.string().optional().default(''),
  street: z.string().optional().default(''),
  country: z.string().optional().default(''),
  fullAddress: z.string().optional().default(''),
  taxNumber: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
}).passthrough()

const ProductSchema = baseRecord.extend({
  customer: z.string().optional().default(''),
  drawingNumber: z.string().optional().default(''),
  productName: z.string().optional().default(''),
  notes: z.string().optional().default(''),
}).passthrough()

const DeliveryNoteSchema = baseRecord.passthrough()

// --- A teljes backup -----------------------------------------------------

export const BackupSchema = z
  .object({
    version: z.string().min(1, 'Hiányzó verzió mező'),
    timestamp: z.string().min(1, 'Hiányzó időbélyeg'),
    orders: z.array(OrderSchema).default([]),
    customers: z.array(CustomerSchema).default([]),
    products: z.array(ProductSchema).default([]),
    deliveryNotes: z.array(DeliveryNoteSchema).default([]),
    customerSequences: z.record(z.number()).optional(),
    cmrSettings: z.record(z.unknown()).optional(),
  })
  .passthrough()

export type ValidatedBackup = z.infer<typeof BackupSchema>

/**
 * Egy backup-fájl validálása. Visszaadja a típusos eredményt és — ha a
 * tetejét sikerült parse-olni, de elemek bukni fognak — a részletet.
 */
export function validateBackup(input: unknown): {
  success: boolean
  data?: ValidatedBackup
  error?: string
} {
  const result = BackupSchema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: formatBackupError(result.error) }
}

/**
 * A Zod hibafa első néhány sorát alakítja olvasható magyar üzenetté.
 */
export function formatBackupError(err: z.ZodError): string {
  const issues = err.issues.slice(0, 5).map((iss) => {
    const path = iss.path.length ? iss.path.join('.') : '(gyökér)'
    return `• ${path}: ${iss.message}`
  })
  const more = err.issues.length > 5 ? `\n…és további ${err.issues.length - 5} hiba.` : ''
  return `A biztonsági mentés érvénytelen:\n${issues.join('\n')}${more}`
}
