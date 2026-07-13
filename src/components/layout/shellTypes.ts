import type { Dispatch, SetStateAction } from 'react'
import type { useAuth } from '@/lib/auth'
import type { MaterialActionKind } from '@/lib/materialService'
import type { CustomersPanelProps } from '@/components/panels/CustomersPanel'
import type { InventoryPanelProps } from '@/components/panels/InventoryPanel'
import type { DocumentsPanelProps } from '@/components/panels/DocumentsPanel'
import type { LabelTemplatesPanelProps } from '@/components/panels/LabelTemplatesPanel'
import type { OrdersPanelProps } from '@/components/panels/OrdersPanel'
import type { ProductsPanelProps } from '@/components/panels/ProductsPanel'
import type {
  DashboardMetrics, InventoryItem, InventoryTransaction, Machine,
  MachineMaintenance, Order, OrderStatus, Product, ProductionDefect,
  ProductionKPIs, ProductionShift,
} from '@/lib/types'
import type { AttendanceEntry, DeliveryNote, LeaveRequest, Material, FilledForm, PriceList, ProductDatasheet, Quote } from '@/lib/types'

/** A MaterialPanel onApply-jának eredmény-alakja (anyag-művelet). */
type MaterialApply = (result: {
  updatedItem: InventoryItem
  transaction: InventoryTransaction
  kind: MaterialActionKind
}) => void

/**
 * Az App-shell (App.tsx) által az oldalaknak átadott adat- és handler-felület.
 * Fokozatosan bővül, ahogy a lapok kiköltöznek az App.tsx-ből (T4–T9).
 * A panel-specifikus mezők típusa a panelek exportált prop-interfészéből jön
 * (Pick), így nem tud elcsúszni a kettő.
 */
export interface AppShellValue extends
  Pick<OrdersPanelProps,
    'filteredOrders' | 'materialEstimateKg' | 'labelTemplates' |
    'savedDeliveryTemplates' | 'activeTemplates' | 'activeLabelTemplateId' |
    'hideDelivered' | 'hideInvoiced' | 'setHideInvoiced' |
    'yearFilterEnabled' | 'setYearFilterEnabled' | 'yearOptions' |
    'selectedYears' | 'toggleYear' | 'orderSearchQuery' | 'setOrderSearchQuery' |
    'statusFilter' | 'selectedOrderIds' | 'setSelectedOrderIds' |
    'orderColumnFilters' | 'setOrderColumnFilters' |
    'activeOrderFilterId' | 'setActiveOrderFilterId' |
    'setOrderBulkImportDialogOpen' | 'setNewOrderFilterDialogOpen' |
    'setLabelPrintSettingsDialogOpen' | 'lastAction' |
    'handleDeleteOrder' | 'handleDuplicateOrder' | 'handleBatchStatusChange' |
    'handleDeleteSelectedOrders' | 'handleUndoLastAction' |
    'handleExportDelivery' | 'handleExportCmr'>,
  Pick<CustomersPanelProps,
    'filteredCustomers' | 'customerSearchQuery' | 'setCustomerSearchQuery' |
    'setBulkImportDialogOpen' | 'handleNewCustomer' | 'handleEditCustomer' |
    'handleDeleteCustomer'>,
  Pick<DocumentsPanelProps,
    'documentFilters' | 'setDocumentFilters' | 'activeFilterId' |
    'setActiveFilterId' | 'setNewFilterDialogOpen' | 'auditLog' |
    'handlePreviewNote' | 'handleEmailNote' | 'emailTemplate' |
    'setEmailTemplate'>,
  Pick<InventoryPanelProps,
    'setInventory' | 'inventorySearchQuery' | 'setInventorySearchQuery' |
    'setSelectedInventoryItem' | 'setInventoryDialogOpen' |
    'setInventoryAdjustDialogOpen' | 'setHistoryInventoryItem' |
    'setInventoryHistoryDialogOpen' | 'setWarehouseAddPrefillProductId' |
    'setWarehouseAddDialogOpen' | 'appendAudit'>,
  Pick<LabelTemplatesPanelProps,
    'setLabelTemplates' | 'setSelectedLabelTemplate' | 'setActiveLabelTemplateId' |
    'setLabelTemplateDialogOpen' | 'importInputRef'>,
  Pick<ProductsPanelProps,
    'filteredProducts' | 'productSearchQuery' | 'setProductSearchQuery' |
    'setProductBulkImportDialogOpen' | 'handleNewProduct' | 'handleEditProduct' |
    'handleDeleteProduct' | 'handleBulkDeleteProducts'> {
  // Adatok / memók
  orders: Order[]
  customers: CustomersPanelProps['filteredCustomers']
  products: Product[]
  productionShifts: ProductionShift[]
  productionDefects: ProductionDefect[]
  machines: Machine[]
  maintenance: MachineMaintenance[]
  inventory: InventoryItem[]
  inventoryTransactions: InventoryTransaction[]
  metrics: DashboardMetrics
  productionKPIs: ProductionKPIs
  lowStockItems: InventoryItem[]
  overdueOrders: Order[]
  isMobile: boolean
  auth: ReturnType<typeof useAuth>

  // Áttekintés oldal szűrő-állapota
  dashboardSearchQuery: string
  setDashboardSearchQuery: Dispatch<SetStateAction<string>>
  setStatusFilter: Dispatch<SetStateAction<OrderStatus | 'all'>>
  setHideDelivered: Dispatch<SetStateAction<boolean>>

  // Műveletek
  handleFilterByStatus: (status: OrderStatus | 'all') => void
  handleNewOrder: () => void
  handleStatusChange: (id: string, status: OrderStatus) => void
  handleEditOrder: (id: string) => void
  handleSaveShift: (shift: ProductionShift) => void
  handleDeleteShift: (id: string) => void
  handleUpdateOrderNotes: (orderId: string, notes: string) => void
  handleSaveDefect: (defect: ProductionDefect) => void
  handleDeleteDefect: (id: string) => void
  handleMaterialAction: MaterialApply
  handleSaveMachine: (m: Machine) => void
  handleDeleteMachine: (id: string) => void
  maintenanceAdd: (m: MachineMaintenance) => void
  maintenanceRemove: (id: string) => void
  materials: Material[]
  handleSaveMaterial: (m: Material) => void
  handleDeleteMaterial: (id: string) => void
  deliveryNotes: DeliveryNote[]
  // A Dokumentumok-panel szigorúbb (kötelező) típusait használjuk — a
  // DeliveryNotesTable opcionális propjai ezeket gond nélkül elfogadják.
  handleDeleteDeliveryNote: DocumentsPanelProps['handleDeleteDeliveryNote']
  handleUpdateDeliveryNote: DocumentsPanelProps['handleUpdateDeliveryNote']
  setExtraItemsNote: DocumentsPanelProps['onEditExtraItems']
  handleDownloadPdf: DocumentsPanelProps['handleDownloadPdf']
  setCreateNoteDialogOpen: (open: boolean) => void
  users: import('@/lib/types').User[]
  usersLoading: boolean
  handleSaveUser: (u: import('@/lib/types').User & { pin?: string; active?: boolean | string }) => Promise<void>
  handleDeleteUser: (id: string) => Promise<void>
  setActiveTemplates: (v: { cmr?: string; delivery?: string; pallet?: string; 'box-label'?: string }) => Promise<void>
  quotes: Quote[]
  priceLists: PriceList[]
  attendanceEntries: AttendanceEntry[]
  leaveRequests: LeaveRequest[]
  handleSaveAttendance: (a: Partial<AttendanceEntry> & { id: string }) => void
  handleDeleteAttendance: (id: string) => void
  datasheets: ProductDatasheet[]
  filledForms: FilledForm[]
  handleSaveFilledForm: (f: Partial<FilledForm> & { id: string }) => void
  handleDeleteFilledForm: (id: string) => void
  handleSaveDatasheet: (d: Partial<ProductDatasheet> & { id: string }) => void
  handleSaveLeave: (l: Partial<LeaveRequest> & { id: string }) => void
  handleDeleteLeave: (id: string) => void
  handleSavePriceList: (pl: Partial<PriceList> & { id: string }) => void
  handleDeletePriceList: (id: string) => void
  handleSaveQuote: (q: Partial<Quote> & { id: string }) => void
  handleDeleteQuote: (id: string) => void
  handleSetOrderLabelFlag: (orderId: string, field: 'labelDoneAt' | 'palletLabelDoneAt', done: boolean) => void
  /** Régi fül-azonosítóval navigál (setCurrentTab adapter). */
  goToTab: (tab: string) => void
}
