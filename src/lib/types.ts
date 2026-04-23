export type OrderStatus = 
  | 'Felvéve'
  | 'Szünetel'
  | 'Kiszállítva'
  | 'Csomagolás alatt'
  | 'Folyamatban'
  | 'Előkészítve'
  | 'Javítás alatt'

export interface Order {
  id: string
  customer: string
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
  createdAt: string
  updatedAt: string
}

export interface DeliveryNote {
  id: string
  type: 'delivery' | 'cmr'
  sequenceNumber: string
  customer: string
  orderIds: string[]
  fileName: string
  exportDate: string
  exportData?: Record<string, string | number | null | undefined>[]
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
  notes: string
  createdAt: string
}
