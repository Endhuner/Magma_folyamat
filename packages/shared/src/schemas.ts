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
  'Kiszállítva/Számlázva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
  'Elkészült',
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
  labelDoneAt: z.string().default(''),
  palletLabelDoneAt: z.string().default(''),
  status: orderStatusSchema.default('Felvéve'),
  /** Pozíció / prioritás szám — opcionális egész. */
  pos: z.number().int().nullable().optional(),
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
  email: z.string().email().or(z.literal('')).default(''),
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
  autoUpdateInventory: z.boolean().nullish(),
  lowStockThreshold: z.number().int().min(0).nullish(),
  labelTemplateId: z.string().nullable().optional(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
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
  issueDate: z.string().optional(),
  exportData: z.array(z.record(z.unknown())).optional(),
  extraItems: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number(),
        unit: z.enum(['db', 'kg']).default('db'),
        notes: z.string().optional(),
      })
    )
    .optional(),
  recipient: z
    .object({
      name: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      taxNumber: z.string().optional(),
    })
    .optional(),
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
  itemType: z.enum(['termek', 'szerszam', 'alapanyag']).default('termek'),
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
  endShotsAbsolute: z.number().int().optional(),
  machineId: z.string().optional(),
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
  /** Base64 data URI vagy üres string — a frontend canvas-on kicsinyíti feltöltés előtt. */
  photoUrl: z.string().default(''),
  oils: z.array(z.any()).optional(),
  accessories: z.array(z.any()).optional(),
  repairs: z.array(z.any()).optional(),
  createdBy: z.string().optional(),
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
  /** Felhasználónkénti megjelenés (skin) — '' = alap. */
  skin: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const userUpdateSchema = userCreateSchema.partial()

/** Az aktuális user saját skin-módosítása (POST /auth/me/skin). */
export const skinUpdateSchema = z.object({ skin: z.string().max(32) })

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
  skin: z.string().default(''),
})

export const materialCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().default(''),
  supplier: z.string().default(''),
  unitPrice: z.string().default(''),
  unit: z.string().default(''),
  notes: z.string().default(''),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const materialUpdateSchema = materialCreateSchema.partial()

// ----------------------------------------------------------------------
// App settings — kulcs-érték beállítások (cmrSettings, deliveryStyles, stb.)
// ----------------------------------------------------------------------
export const appSettingUpsertSchema = z.object({
  /** JSON-szerializált érték — bármilyen JSON-kompatibilis objektum. */
  value: z.unknown(),
})

// ----------------------------------------------------------------------
// Label templates
// ----------------------------------------------------------------------
export const labelTemplateCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().default('label'),
  html: z.string().default(''),
  css: z.string().default(''),
  timestamp: z.string().default(''),
  description: z.string().optional(),
  margins: z.record(z.string()).optional(),
  labelsPerPage: z.number().int().optional(),
  labelsPerRow: z.number().int().optional(),
  labelsPerColumn: z.number().int().optional(),
  cellSettings: z.record(z.unknown()).optional(),
  fontSettings: z.record(z.unknown()).optional(),
  alignmentSettings: z.record(z.unknown()).optional(),
  printSettings: z.record(z.unknown()).optional(),
  paddingSettings: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const labelTemplateUpdateSchema = labelTemplateCreateSchema.partial()

// ----------------------------------------------------------------------
// Customer sequences — vevőnkénti sorszámok
// ----------------------------------------------------------------------
export const customerSequenceUpsertSchema = z.object({
  sequence: z.number().int().min(0),
})

// ----------------------------------------------------------------------
// Saved document templates — HTML/CSS szállítólevél + CMR sablonok
// ----------------------------------------------------------------------
export const savedTemplateCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().default('delivery'),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string().default(''),
  size: z.number().int().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const savedTemplateUpdateSchema = savedTemplateCreateSchema.partial()

// ----------------------------------------------------------------------
// Gyártástervező — gép-rendelés hozzárendelések
// ----------------------------------------------------------------------
export const machinePlanningAssignmentCreateSchema = z.object({
  id: z.string().optional(),
  machineId: z.string().min(1),
  orderId: z.string().min(1),
  position: z.number().int().default(0),
  plannedHoursOverride: z.string().default(''),
  assignedAt: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const machinePlanningAssignmentUpdateSchema = machinePlanningAssignmentCreateSchema.partial()

export const machinePlanningReorderSchema = z.object({
  /** Rendezett ID-lista az adott gépen (position = tömb index) */
  orderedIds: z.array(z.string()),
})

// ----------------------------------------------------------------------
// Gép-karbantartási napló
// ----------------------------------------------------------------------
export const machineMaintenanceCreateSchema = z.object({
  id: z.string().optional(),
  machineId: z.string().min(1),
  type: z.enum(['scheduled', 'repair', 'inspection']).default('scheduled'),
  description: z.string().default(''),
  performedAt: z.string().default(''),
  nextDueAt: z.string().default(''),
  cost: z.string().default(''),
  performedBy: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const machineMaintenanceUpdateSchema = machineMaintenanceCreateSchema.partial()

// ----------------------------------------------------------------------
// Üzenetek / feladatok
// ----------------------------------------------------------------------
export const messageCreateSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['uzenet', 'feladat']).default('uzenet'),
  body: z.string().min(1, 'Az üzenet nem lehet üres').max(2000),
  fromUserId: z.string().default(''),
  fromUserName: z.string().default(''),
  /** Felhasználó id vagy 'all' (mindenki) */
  toUserId: z.string().min(1),
  toUserName: z.string().default(''),
  orderId: z.string().default(''),
  orderLabel: z.string().default(''),
  readAt: z.string().default(''),
  doneAt: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export const messageUpdateSchema = messageCreateSchema.partial()

// ----------------------------------------------------------------------
// Gépalap log
// ----------------------------------------------------------------------
export const machinePlanningLogCreateSchema = z.object({
  id: z.string().optional(),
  machineId: z.string().min(1),
  orderId: z.string().min(1),
  action: z.enum(['assigned', 'removed', 'moved']),
  productName: z.string().default(''),
  designation: z.string().default(''),
  ownOrderNumber: z.string().default(''),
  customer: z.string().default(''),
  fromMachineId: z.string().default(''),
  userId: z.string().default(''),
  userName: z.string().default(''),
  timestamp: z.string(),
  createdAt: z.string().optional(),
})

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

/** Árajánlat tételsor — a Quotation táblázat egy sora. */
export const quoteItemSchema = z.object({
  drawingNumber: z.string().default(''),
  cavityCount: z.number().nullable().optional(),
  weightG: z.number().nullable().optional(),
  dieCastingFeeEur: z.number().nullable().optional(),
  materialCostEur: z.number().nullable().optional(),
  totalPieceEur: z.number().nullable().optional(),
  mouldPriceEur: z.number().nullable().optional(),
})

export const quoteCreateSchema = z.object({
  id: z.string().optional(),
  number: z.string().default(''),
  customerName: z.string().default(''),
  customerId: z.string().default(''),
  contactName: z.string().default(''),
  rfqNumber: z.string().default(''),
  emailDate: z.string().default(''),
  deadline: z.string().default(''),
  quantityNote: z.string().default(''),
  notes: z.string().default(''),
  doneAt: z.string().default(''),
  sentAt: z.string().default(''),
  orderedAt: z.string().default(''),
  material: z.string().default(''),
  yearlyAmount: z.string().default(''),
  moq: z.string().default(''),
  mouldLeadtimeWeeks: z.string().default(''),
  mpb: z.string().default(''),
  paymentTerms: z.string().default(''),
  incoterms: z.string().default(''),
  additionalNotes: z.string().default(''),
  validityDays: z.number().default(30),
  items: z.array(quoteItemSchema).optional(),
  calc: z.any().optional(),
  pdfFileName: z.string().default(''),
})
export const quoteUpdateSchema = quoteCreateSchema.partial()

export const priceListItemSchema = z.object({
  partNumber: z.string().default(''),
  name: z.string().default(''),
  lotSize: z.string().default(''),
  weightG: z.number().nullable().optional(),
  basePricePer100Eur: z.number().nullable().optional(),
})

export const priceListCreateSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().default(''),
  customerId: z.string().default(''),
  burnRate: z.number().default(0.06),
  mpbEurPerKg: z.number().default(0),
  currentMpEurPerKg: z.number().default(0),
  mpHistory: z.array(z.object({
    label: z.string(),
    mp: z.number(),
    setAt: z.string(),
  })).optional(),
  items: z.array(priceListItemSchema).optional(),
  notes: z.string().default(''),
})
export const priceListUpdateSchema = priceListCreateSchema.partial()

export const employeeCreateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  active: z.number().default(1),
})
export const employeeUpdateSchema = employeeCreateSchema.partial()

export const attendanceEntryCreateSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1),
  date: z.string().min(1),
  inTime: z.string().default(''),
  outTime: z.string().default(''),
  note: z.string().default(''),
})
export const attendanceEntryUpdateSchema = attendanceEntryCreateSchema.partial()

export const leaveRequestCreateSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  note: z.string().default(''),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  requestedAt: z.string().default(''),
  decidedAt: z.string().default(''),
})
export const leaveRequestUpdateSchema = leaveRequestCreateSchema.partial()

export const datasheetCreateSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  docId: z.string().default(''),
  effectiveDate: z.string().default(''),
  preparedBy: z.string().default(''),
  checkedBy: z.string().default(''),
  approvedBy: z.string().default(''),
  photoUrl: z.string().default(''),
  machineSettings: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  castingChecks: z.array(z.object({ operation: z.string(), responsible: z.string(), tool: z.string() })).optional(),
  postOperations: z.array(z.object({ operation: z.string(), place: z.string(), time: z.string() })).optional(),
  finalInspection: z.string().default(''),
  packagingInstructions: z.string().default(''),
})
export const datasheetUpdateSchema = datasheetCreateSchema.partial()

export const filledFormCreateSchema = z.object({
  id: z.string().optional(),
  formType: z.enum(['mohu', 'intermetal']),
  title: z.string().default(''),
  data: z.any().optional(),
})
export const filledFormUpdateSchema = filledFormCreateSchema.partial()

// ----------------------------------------------------------------------
// Tool (Eszközlista)
// ----------------------------------------------------------------------
/** Egy beszerzési hely — eszközönként több is lehet. */
export const toolSupplierSchema = z.object({
  name: z.string().default(''),
  website: z.string().default(''),
  email: z.string().default(''),
  contact: z.string().default(''),
})

export const toolUnitSchema = z.enum(['db', 'kg'])
export const toolCurrencySchema = z.enum(['HUF', 'EUR'])

export const toolCreateSchema = z.object({
  id: z.string().optional(),
  partNumber: z.string().default(''),
  // A megnevezés azonosít (audit-log, lomtár neve) — a materials/machines mintája szerint kötelező.
  name: z.string().min(1),
  manufacturer: z.string().default(''),
  size: z.string().default(''),
  location: z.string().default(''),
  stock: z.number().default(0),
  unit: toolUnitSchema.default('db'),
  price: z.number().default(0),
  currency: toolCurrencySchema.default('HUF'),
  /** ISO dátum (YYYY-MM-DD) vagy üres. */
  purchasedAt: z.string().default(''),
  suppliers: z.array(toolSupplierSchema).optional(),
})
export const toolUpdateSchema = toolCreateSchema.partial()
