/**
 * Zod-sémák az API input-validációjához.
 *
 * Stratégia: kéziműves Zod-sémák, amelyek pontosan tükrözik a `types.ts`
 * interfészeit. NEM használunk drizzle-zod-ot, mert:
 *  - a frontend nem importálja a drizzle-orm-t (felesleges függőség)
 *  - a séma a backend és a frontend között **közös** kell legyen, és
 *    a típus + séma egyszerre él itt
 *
 * Minden create-séma `*CreateSchema`, update-séma `*UpdateSchema` (Partial-on
 * alapulva). A `passthrough()`-ot nem használjuk: az API-n szigorúak vagyunk,
 * ismeretlen mezőket eldobunk.
 *
 * A backupSchema (frontend, src/lib/backupSchema.ts) megtartja a `passthrough`-t
 * mert ott a forward-compat fontosabb.
 */
import { z } from 'zod'

// ----------------------------------------------------------------------
// Order
// ----------------------------------------------------------------------
export const orderStatusSchema = z.enum([
  'Felvéve',
  'Szünetel',
  'Kiszállítva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
]).catch('Felvéve')  // ismeretlen státuszt alapértelmezettre állítja visszautasítás helyett

export const orderCreateSchema = z.object({
  id: z.string().optional(),
  customer: z.string().default(''),
  /** Hivatkozott Product.id — backend kötelezett oldali párosításához. */
  productId: z.string().optional(),
  productName: z.string().default(''),
  designation: z.string().default(''),
  notes: z.string().default(''),
  ownOrderNumber: z.string().default(''),
  material: z.string().default(''),
  orderNumber: z.string().default(''),
  amountPc: z.number().int().min(0).default(0),
  orderDate: z.string().default(''),
  requiredDate: z.string().default(''),
  pickupDate: z.string().default(''),
  invoiced: z.string().default(''),
  ready: z.string().default(''),
  surfaceTreatment: z.string().default(''),
  boxesCount: z.number().int().min(0).nullable().default(null),
  palletsCount: z.number().int().min(0).nullable().default(null),
  grossWeightKg: z.string().default(''),
  requiredMaterialKg: z.string().default(''),
  plannedProductionHours: z.string().default(''),
  deliveryNote: z.string().default(''),
  cmr: z.string().default(''),
  status: orderStatusSchema.default('Felvéve'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const orderUpdateSchema = orderCreateSchema.partial()

// ----------------------------------------------------------------------
// Customer
// ----------------------------------------------------------------------
export const customerCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'A név kötelező'),
  language: z.string().default(''),
  city: z.string().default(''),
  postalCode: z.string().default(''),
  street: z.string().default(''),
  country: z.string().default(''),
  fullAddress: z.string().default(''),
  taxNumber: z.string().default(''),
  deliveryTemplateId: z.string().nullable().optional(),
  cmrTemplateId: z.string().nullable().optional(),
  labelTemplateId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const customerUpdateSchema = customerCreateSchema.partial()

// ----------------------------------------------------------------------
// Product
// ----------------------------------------------------------------------
export const productCreateSchema = z.object({
  id: z.string().optional(),
  customer: z.string().default(''),
  drawingNumber: z.string().default(''),
  productName: z.string().default(''),
  notes: z.string().default(''),
  nestCount: z.string().default(''),
  weightPerPiece: z.string().default(''),
  material: z.string().default(''),
  surfaceTreatment: z.string().default(''),
  cycleTime: z.string().default(''),
  postProcessingTime: z.string().default(''),
  postProcessing: z.string().default(''),
  boxSize: z.string().default(''),
  piecesPerBox: z.string().default(''),
  boxesPerPallet: z.string().default(''),
  articleNumber: z.string().default(''),
  warehouse: z.string().default(''),
  spruWeight: z.string().default(''),
  autoUpdateInventory: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const productUpdateSchema = productCreateSchema.partial()

// ----------------------------------------------------------------------
// Delivery note
// ----------------------------------------------------------------------
export const deliveryNoteCreateSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['delivery', 'cmr']),
  sequenceNumber: z.string().default(''),
  customer: z.string().default(''),
  orderIds: z.array(z.string()).default([]),
  fileName: z.string().default(''),
  exportDate: z.string().default(''),
  exportData: z.array(z.record(z.unknown())).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const deliveryNoteUpdateSchema = deliveryNoteCreateSchema.partial()

// ----------------------------------------------------------------------
// Inventory
// ----------------------------------------------------------------------
export const inventoryItemCreateSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  productName: z.string().default(''),
  drawingNumber: z.string().default(''),
  customer: z.string().default(''),
  quantity: z.number().int().default(0),
  totalShots: z.number().int().min(0).optional(),
  nestCount: z.string().optional(),
  location: z.string().default(''),
  notes: z.string().default(''),
  lastUpdated: z.string().optional(),
  createdAt: z.string().optional(),
})
export const inventoryItemUpdateSchema = inventoryItemCreateSchema.partial()

export const inventoryTransactionCreateSchema = z.object({
  id: z.string().optional(),
  inventoryItemId: z.string(),
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  orderId: z.string().optional(),
  shiftId: z.string().optional(),
  notes: z.string().default(''),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
})
export const inventoryTransactionUpdateSchema = inventoryTransactionCreateSchema.partial()

// ----------------------------------------------------------------------
// Production: shift, defect, log
// ----------------------------------------------------------------------
export const productionShiftCreateSchema = z.object({
  id: z.string().optional(),
  orderId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formátum kötelező'),
  shift: z.enum(['de', 'du']),
  shotsCount: z.number().int().min(0),
  producedQuantity: z.number().int().min(0),
  notes: z.string().default(''),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const productionShiftUpdateSchema = productionShiftCreateSchema.partial()

export const productionDefectCreateSchema = z.object({
  id: z.string().optional(),
  orderId: z.string(),
  shiftId: z.string().optional(),
  quantity: z.number().int().min(0),
  reason: z.string().default(''),
  date: z.string(),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const productionDefectUpdateSchema = productionDefectCreateSchema.partial()

export const productionLogCreateSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  orderId: z.string(),
  action: z.string(),
  notes: z.string().default(''),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
})
export const productionLogUpdateSchema = productionLogCreateSchema.partial()

// ----------------------------------------------------------------------
// Master data
// ----------------------------------------------------------------------
export const machineCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  serialNumber: z.string().default(''),
  type: z.string().default(''),
  capacity: z.string().default(''),
  notes: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const machineUpdateSchema = machineCreateSchema.partial()

export const userRoleSchema = z.enum(['admin', 'operator', 'viewer'])

export const userCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().or(z.literal('')).default(''),
  role: userRoleSchema.default('operator'),
  notes: z.string().default(''),
  /** Cleartext PIN — backend bcrypt-eli. 4–8 számjegy. */
  pin: z.string().regex(/^\d{4,8}$/, '4–8 számjegyű PIN szükséges').optional(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const userUpdateSchema = userCreateSchema.partial()

/** Login-payload — a frontend ezt küldi POST /auth/login-ra. */
export const loginInputSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().regex(/^\d{4,8}$/),
})

/** Az aktuális user nyilvános alakja. */
export const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: userRoleSchema,
})

export const materialCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().default(''),
  supplier: z.string().default(''),
  unitPrice: z.string().default(''),
  unit: z.string().default(''),
  notes: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const materialUpdateSchema = materialCreateSchema.partial()

// ----------------------------------------------------------------------
// Audit log — csak olvasásra/listázásra; írni csak a backend írhat.
// ----------------------------------------------------------------------
export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  // ISO-string vagy YYYY-MM-DD
  since: z.string().optional(),
})
