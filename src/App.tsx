import { generateId } from '@/lib/generateId'
import { useState, useMemo, useEffect, useRef, Suspense, useCallback, lazy } from 'react'
import { useKV } from '@/hooks/useKV'
import { useEntityKV } from '@/hooks/useEntityKV'
import { auditLogRepo } from '@/lib/db/repos'
import { useServerCrud } from '@/lib/providers/useServerCrud'
import { useAppSetting } from '@/hooks/useAppSetting'
import { useCustomerSequences } from '@/hooks/useCustomerSequences'
import { useMigrations } from '@/hooks/useMigrations'
import { useDefaultTemplates } from '@/hooks/useDefaultTemplates'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Dashboard } from '@/components/Dashboard'
import { DeliveryNotesTable } from '@/components/DeliveryNotesTable'
import { BackupRestore } from '@/components/BackupRestore'
// Code-split heavy editors — lásd `src/components/lazy.ts`.
import { GithubStyleTemplateEditor, TemplateBackupRestore } from '@/components/lazy'
import { ProductionPlanningView } from '@/components/ProductionPlanningView'
import { useIsTouchLayout } from '@/hooks/useMediaQuery'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Order, OrderStatus, Customer, Product, DeliveryNote, ExtraDeliveryItem, InventoryItem, InventoryTransaction, ProductionShift, ProductionLog, ProductionDefect, Machine, MachineMaintenance, AppMessage, User, Material, AuditLogEntry, AuditEntityType, AuditAction, AuditFieldChange } from '@/lib/types'
import { diffObjects, buildAuditEntry, pruneAuditLog, AUDIT_LOG_MAX_ENTRIES } from '@/lib/auditLog'
import { calculateDashboardMetrics, calculateProductionKPIs, parseYear, stripDiacritics, isDelivered, isInvoiced, isOverdue } from '@/lib/helpers'
import { computeAutoFieldsForOrder } from '@/lib/orderService'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { useAuth } from '@/lib/auth'
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/api/usersApi'
import type { UserRole } from '@produktivpro/shared'
import { Plus, Factory, MagnifyingGlass, FileText, CaretDown, Database, SignOut, Gear } from '@phosphor-icons/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { GlobalSearch } from '@/components/GlobalSearch'
import { WorkCalendarDialog } from '@/components/WorkCalendarDialog'
import { MessageCenter } from '@/components/MessageCenter'
import { MaterialPanel } from '@/components/MaterialPanel'
import { ExtraItemsDialog } from '@/components/ExtraItemsDialog'
import {
  computeMaterialStatuses,
  totalEstimatedMaterialKg,
  MATERIAL_BOOKED_THROUGH_KEY,
  type MaterialActionKind,
  type MaterialBookedThroughMap,
} from '@/lib/materialService'
const TrashView = lazy(() => import('@/components/TrashView').then(m => ({ default: m.TrashView })))
const ReportsView = lazy(() => import('@/components/ReportsView').then(m => ({ default: m.ReportsView })))
const MaintenanceView = lazy(() => import('@/components/MaintenanceView').then(m => ({ default: m.MaintenanceView })))
import { ACTIVE_WORK_STATUSES } from '@/lib/constants/orderStatus'
import { toast } from 'sonner'
import { exportCmrAsHtml, generateCmrHtmlTemplate, getCmrHtml } from '@/lib/cmrHtmlTemplate'
import { exportDeliveryAsHtml, generateDeliveryHtmlTemplate, getDeliveryHtml, TemplateStyles } from '@/lib/deliveryHtmlTemplate'
import { validateCmrExport, validateDeliveryExport, ValidationResult } from '@/lib/exportValidation'
import { LabelTemplate } from '@/lib/labelTemplate'
import { deductInventoryForOrders, commitInventoryDeduction, restoreInventoryForOrders, commitInventoryRestore, InventoryDeductionResult } from '@/lib/inventoryService'
import { LabelTemplatesPanel } from '@/components/panels/LabelTemplatesPanel'
import { InventoryPanel } from '@/components/panels/InventoryPanel'
import { DocumentsPanel } from '@/components/panels/DocumentsPanel'
import { CustomersPanel } from '@/components/panels/CustomersPanel'
import { ProductsPanel } from '@/components/panels/ProductsPanel'
import { OrdersPanel } from '@/components/panels/OrdersPanel'
import { ProductionPanel } from '@/components/panels/ProductionPanel'
import { MachinesPanel } from '@/components/panels/MachinesPanel'
import { UsersPanel } from '@/components/panels/UsersPanel'
import { MaterialsPanel } from '@/components/panels/MaterialsPanel'
import { AppDialogs } from '@/components/AppDialogs'
import { IssueDateDialog } from '@/components/IssueDateDialog'
import { ProductionHistoryView } from '@/components/ProductionHistoryView'

type LastAction =
  | { type: 'delete', orders: Order[] }
  | { type: 'edit', orderId: string, before: Order }
  | null

function App() {
  // Mobil ÉS tablet eszközön a Gyártás fülön a kompakt érintőbarát nézetet
  // renderelünk (≤1024px), hogy ne kelljen a sok-oszlopos táblázatot oldalra
  // görgetni. Asztali (egér) nézeten marad a teljes táblázat.
  const isMobile = useIsTouchLayout()
  // ──────────────────────────────────────────────────────────────────────────
  // ADAT — IndexedDB (Dexie repos) az entitásokra. Az `useEntityKV` adapter
  // megőrzi a `useKV` API-t (tuple: [értékek, setter]), de írásnál a diff-et
  // számolja és a Dexie tranzakcióval atomian perzisztálja.
  // ──────────────────────────────────────────────────────────────────────────
  // Rendelések, vevők, termékek: szerver-alapú (SQLite), mindenki látja.
  const ordersApi = useServerCrud<Order>('orders', ['order'])
  const orders = ordersApi.items
  const customersApi = useServerCrud<Customer>('customers', ['customer'])
  const customers = customersApi.items
  const productsApi = useServerCrud<Product>('products', ['product'])
  const products = productsApi.items
  const deliveryNotesApi = useServerCrud<DeliveryNote>('delivery-notes', ['order'])
  const deliveryNotes = deliveryNotesApi.items

  // Gyártás + Készlet: szerver-alapú (SQLite), SSE valós idejű szinkronnal.
  // Minden felhasználó (admin + operátor) azonnal látja egymás adatait.
  const inventoryApi = useServerCrud<InventoryItem>('inventory-items', ['inventory'])
  const inventory = inventoryApi.items
  const transactionsApi = useServerCrud<InventoryTransaction>('inventory-transactions', ['inventoryTransaction'])
  const inventoryTransactions = transactionsApi.items
  const shiftsApi = useServerCrud<ProductionShift>('shifts', ['shift'])
  const productionShifts = shiftsApi.items
  const logsApi = useServerCrud<ProductionLog>('production-logs', ['shift'])
  const productionLogs = logsApi.items
  const defectsApi = useServerCrud<ProductionDefect>('defects', ['defect'])
  const productionDefects = defectsApi.items

  // Kompatibilitási wrapper: a meglévő funkcionális setter mintát (setInventory(prev => ...))
  // leképezi a szerver API hívásokra. Szinkronban fut, így az itemId-t befogó
  // applyProductionShiftToInventory / applyDefectToInventory is helyesen működik.
  const setInventory = useCallback((updater: InventoryItem[] | ((prev: InventoryItem[] | undefined) => InventoryItem[])) => {
    const prev = inventoryApi.items
    const next = typeof updater === 'function' ? updater(prev) : updater
    const prevMap = new Map(prev.map(i => [i.id, i]))
    const nextMap = new Map(next.map(i => [i.id, i]))
    for (const item of prev) {
      if (!nextMap.has(item.id)) inventoryApi.remove(item.id)
    }
    for (const item of next) {
      if (!prevMap.has(item.id)) inventoryApi.add(item)
      else if (JSON.stringify(prevMap.get(item.id)) !== JSON.stringify(item)) inventoryApi.replace(item)
    }
  }, [inventoryApi])

  const setInventoryTransactions = useCallback((updater: InventoryTransaction[] | ((prev: InventoryTransaction[] | undefined) => InventoryTransaction[])) => {
    const prev = transactionsApi.items
    const next = typeof updater === 'function' ? updater(prev) : updater
    const prevIds = new Set(prev.map(i => i.id))
    for (const item of next) {
      if (!prevIds.has(item.id)) transactionsApi.add(item)
    }
  }, [transactionsApi])

  // Rendelések / vevők / termékek: ugyanaz a diff-alapú wrapper mint a készletnél.
  function makeSyncSetter<T extends { id: string }>(
    api: { items: T[]; add: (i: T) => void; remove: (id: string) => void; replace: (i: T) => void }
  ) {
    return (updater: T[] | ((prev: T[] | undefined) => T[])) => {
      const prev = api.items
      const next = typeof updater === 'function' ? updater(prev) : updater
      const prevMap = new Map(prev.map(i => [i.id, i]))
      const nextMap = new Map(next.map(i => [i.id, i]))
      for (const item of prev) { if (!nextMap.has(item.id)) api.remove(item.id) }
      for (const item of next) {
        if (!prevMap.has(item.id)) api.add(item)
        else if (JSON.stringify(prevMap.get(item.id)) !== JSON.stringify(item)) api.replace(item)
      }
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setOrders = useCallback(makeSyncSetter(ordersApi), [ordersApi.items, ordersApi.add, ordersApi.remove, ordersApi.replace])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setCustomers = useCallback(makeSyncSetter(customersApi), [customersApi.items, customersApi.add, customersApi.remove, customersApi.replace])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setProducts = useCallback(makeSyncSetter(productsApi), [productsApi.items, productsApi.add, productsApi.remove, productsApi.replace])


  const { isOnline, pendingCount, isSyncing } = useOfflineSync(() => {
    ordersApi.reload()
    productsApi.reload()
    customersApi.reload()
    inventoryApi.reload()
  })

  // Változásnapló — minden lényeges adatmódosítás itt is rögzül (Dokumentumok → Változások).
  const [auditLog, setAuditLog] = useEntityKV<AuditLogEntry>(auditLogRepo)
  const machinesApi = useServerCrud<Machine>('machines', ['machine'])
  const maintenanceApi = useServerCrud<MachineMaintenance>('machine-maintenance', ['maintenance'])
  const messagesApi = useServerCrud<AppMessage>('messages', ['message'])
  // Felhasználók: a backend a forrás (auth + bcrypt PIN miatt nem lehet
  // local-only). A "Felhasználók" tab onSave/onDelete a `usersApi`-n
  // keresztül a `/api/v1/users` endpointtal beszél, mentés után
  // újrakérdezzük a listát + a login-screen `publicUsers` listáját is.
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const auth = useAuth()
  const refreshUsers = async (): Promise<void> => {
    try {
      setUsersLoading(true)
      const list = await listUsers()
      setUsers(Array.isArray(list) ? list : [])
    } catch (err) {
      // Csendben elnyeljük — a hívó megfelelő toast-tal jelzi a hibát.
      // Csak akkor logolunk, ha nem 401 (a 401 normális bypass-módban / nem auth.).
      // eslint-disable-next-line no-console
      console.warn('[App] users lista betöltése sikertelen', err)
    } finally {
      setUsersLoading(false)
    }
  }
  useEffect(() => {
    if (auth.status === 'authenticated') {
      void refreshUsers()
    } else if (auth.status === 'unauthenticated' || auth.status === 'backend-unavailable') {
      setUsers([])
    }
    // bypass-módban marad amit a user lát (üres) — bypass csak dev/offline.
  }, [auth.status])
  const materialsApi = useServerCrud<Material>('materials', ['material'])
  // customerSequences: szerver-alapú (megosztott sorszámok minden felhasználónak)
  const [customerSequences, setCustomerSequences] = useCustomerSequences()
  const savedTemplatesApi = useServerCrud<any>('saved-templates', ['order'])
  const savedTemplates = savedTemplatesApi.items
  const [cmrSettings] = useAppSetting<CmrLayoutSettings>('cmr-layout-settings', {
    senderName: 'Magma Kft',
    senderAddress: 'H-1211 Budapest, Déli utca 13.',
    senderTaxNumber: 'HU10368152-2-43',
    placeOfTakingOver: 'Budapest, Hungary',
    placeIssued: 'Budapest',
    templateExtension: 'xltx',
    senderCity: 'Budapest',
    senderCountry: 'Magyarország',
    senderPhone: '',
    senderEmail: '',
    carrierName: '',
    carrierAddress: '',
    vehiclePlate: '',
  })
  
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [orderBulkImportDialogOpen, setOrderBulkImportDialogOpen] = useState(false)
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productBulkImportDialogOpen, setProductBulkImportDialogOpen] = useState(false)
  const [cmrSettingsDialogOpen, setCmrSettingsDialogOpen] = useState(false)
  const [deliverySettingsDialogOpen, setDeliverySettingsDialogOpen] = useState(false)
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  const [currentTab, setCurrentTab] = useState(() =>
    auth.user?.role === 'operator' ? 'production' : 'dashboard'
  )
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [workCalendarDialogOpen, setWorkCalendarDialogOpen] = useState(false)

  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [hideDelivered, setHideDelivered] = useState(true)
  const [hideInvoiced, setHideInvoiced] = useState(true)
  
  const currentYear = new Date().getFullYear()
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [yearFilterEnabled, setYearFilterEnabled] = useState(true)
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [lastAction, setLastAction] = useState<LastAction>(null)
  
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('')
  
  const [validationDialogOpen, setValidationDialogOpen] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExportType, setPendingExportType] = useState<'cmr' | 'delivery' | null>(null)
  const [issueDateDialogOpen, setIssueDateDialogOpen] = useState(false)
  const [issueDateDialogType, setIssueDateDialogType] = useState<'delivery' | 'cmr'>('delivery')
  const [pendingIssueDate, setPendingIssueDate] = useState<string | null>(null)
  
  const [deliveryStyles] = useAppSetting<Partial<TemplateStyles>>('delivery-html-styles', {})
  // Aktív sablonok (melyik saved-template van CMR/szállítólevélhez beállítva)
  const [activeTemplates, setActiveTemplates] = useAppSetting<{ cmr?: string; delivery?: string; pallet?: string; 'box-label'?: string }>('active-templates', {})
  const [emailTemplate, setEmailTemplate] = useAppSetting<string>(
    'email-body-template',
    'Tisztelt Partnerünk!\n\nMellékletben küldjük a {{sorszam}} számú {{tipus}} dokumentumot.\n\nÜdvözlettel,\nMagma Kft'
  )
  
  const [documentFilters, setDocumentFilters] = useKV<Array<{id: string, name: string, columns: string[]}>>('document-filters', [])
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [newFilterDialogOpen, setNewFilterDialogOpen] = useState(false)

  const [orderColumnFilters, setOrderColumnFilters] = useKV<Array<{id: string, name: string, columns: string[]}>>('order-column-filters', [])
  const [activeOrderFilterId, setActiveOrderFilterId] = useState<string | null>(null)
  const [newOrderFilterDialogOpen, setNewOrderFilterDialogOpen] = useState(false)

  const labelTemplatesApi = useServerCrud<LabelTemplate>('label-templates', ['order'])
  const labelTemplates = labelTemplatesApi.items
  // makeSyncSetter adapter: LabelTemplatesPanel a régi funkcionális updater stílust vár
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setLabelTemplates = useCallback(makeSyncSetter(labelTemplatesApi), [labelTemplatesApi.items, labelTemplatesApi.add, labelTemplatesApi.remove, labelTemplatesApi.replace])
  // activeLabelTemplateId: user-specifikus UI beállítás, marad lokálisan
  const [activeLabelTemplateId, setActiveLabelTemplateId] = useKV<string | null>('active-label-template', null)
  const [labelTemplateDialogOpen, setLabelTemplateDialogOpen] = useState(false)
  const [selectedLabelTemplate, setSelectedLabelTemplate] = useState<LabelTemplate | null>(null)
  const labelImportInputRef = useRef<HTMLInputElement>(null)

  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [inventoryAdjustDialogOpen, setInventoryAdjustDialogOpen] = useState(false)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)
  const [inventorySearchQuery, setInventorySearchQuery] = useState('')
  const [inventoryDeductionDialogOpen, setInventoryDeductionDialogOpen] = useState(false)
  const [pendingDeductionResult, setPendingDeductionResult] = useState<InventoryDeductionResult | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ orderIds: string[], status: OrderStatus } | null>(null)
  /**
   * Megerősítés utáni callback (pl. szállítólevél vagy CMR export). A
   * deduction-dialógus OK gombjára lefut, miután a készletlevonás átment.
   */
  const [pendingPostDeduction, setPendingPostDeduction] = useState<(() => void | Promise<void>) | null>(null)
  const [deductionContext, setDeductionContext] = useState<string>('státuszváltás')
  const [labelPrintSettingsDialogOpen, setLabelPrintSettingsDialogOpen] = useState(false)

  // Készlet ablakok — új dialógok a PRD §4.7 szerint
  const [inventoryHistoryDialogOpen, setInventoryHistoryDialogOpen] = useState(false)
  const [historyInventoryItem, setHistoryInventoryItem] = useState<InventoryItem | null>(null)
  const [warehouseAddDialogOpen, setWarehouseAddDialogOpen] = useState(false)
  const [warehouseAddPrefillProductId, setWarehouseAddPrefillProductId] = useState<string | undefined>(undefined)

  const yearOptions = useMemo(() => {
    const set = new Set<number>()
    for (const o of orders ?? []) {
      const yOrder = parseYear(o.orderDate)
      if (yOrder) set.add(yOrder)
    }
    const years = Array.from(set).sort((a, b) => b - a)
    return years
  }, [orders])
  
  useEffect(() => {
    if (yearOptions.length > 0 && selectedYears.length === 0) {
      if (yearOptions.includes(currentYear)) {
        setSelectedYears([currentYear])
      } else {
        setSelectedYears([yearOptions[0]])
      }
    }
  }, [yearOptions, selectedYears.length, currentYear])

  useMigrations({
    orders,
    products,
    setOrders,
    reloadAll: () => {
      ordersApi.reload()
      customersApi.reload()
      productsApi.reload()
      inventoryApi.reload()
      transactionsApi.reload()
      shiftsApi.reload()
      defectsApi.reload()
      logsApi.reload()
    },
  })

  useDefaultTemplates(savedTemplatesApi)


  const handleSaveOrder = (orderData: Partial<Order>) => {
    if (selectedOrder) {
      const before = orders?.find(o => o.id === selectedOrder.id)
      if (before) {
        setLastAction({ type: 'edit', orderId: selectedOrder.id, before: { ...before } })
      }
      const after = before ? { ...before, ...orderData } : null
      setOrders((current) =>
        (current || []).map((order) =>
          order.id === selectedOrder.id ? { ...order, ...orderData } : order
        )
      )
      // Audit-bejegyzés: rendelés módosítás (mező-szintű diff)
      if (before && after) {
        const changes = diffObjects(
          before as unknown as Record<string, unknown>,
          after as unknown as Record<string, unknown>
        )
        if (changes.length > 0) {
          appendAudit('order', 'Rendelés', selectedOrder.id, before.orderNumber || before.productName || selectedOrder.id, 'update', {
            changes,
            notes: `${before.customer} · ${before.productName}`,
          })
        }
      }
      toast.success('Rendelés sikeresen frissítve')
    } else {
      const autoFields = computeAutoFieldsForOrder(
        orderData.customer || '',
        orderData.productName || '',
        orderData.amountPc || 0,
        products || []
      )

      const newOrder: Order = {
        id: generateId(),
        ...orderData,
        ...autoFields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Order

      setOrders((current) => [...(current || []), newOrder])
      // Audit: új rendelés létrehozva
      appendAudit('order', 'Rendelés', newOrder.id, newOrder.orderNumber || newOrder.productName || newOrder.id, 'create', {
        notes: `${newOrder.customer} · ${newOrder.amountPc} db`,
      })
      toast.success('Rendelés sikeresen létrehozva')
    }
    setSelectedOrder(null)
  }

  const handleEditOrder = (id: string) => {
    const order = (orders || []).find((o) => o.id === id)
    if (order) {
      setSelectedOrder(order)
      setOrderDialogOpen(true)
    }
  }

  const handleDeleteOrder = (id: string) => {
    const order = (orders || []).find(o => o.id === id)
    if (order) {
      setLastAction({ type: 'delete', orders: [order] })
      appendAudit('order', 'Rendelés', order.id, order.orderNumber || order.productName || order.id, 'delete', {
        notes: `${order.customer} · ${order.amountPc} db`,
      })
    }
    setOrders((current) => (current || []).filter((o) => o.id !== id))
    toast.success('Rendelés sikeresen törölve')
  }

  const handleDuplicateOrder = (id: string) => {
    const order = (orders || []).find(o => o.id === id)
    if (!order) return

    const duplicatedOrder: Order = {
      ...order,
      id: generateId(),
      orderNumber: '',
      ownOrderNumber: '',
      deliveryNote: '',
      cmr: '',
      status: 'Felvéve',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setOrders((current) => [...(current || []), duplicatedOrder])
    appendAudit('order', 'Rendelés', duplicatedOrder.id, duplicatedOrder.productName || duplicatedOrder.id, 'create', {
      notes: `Duplikálva ebből: ${order.orderNumber || order.id} (${order.customer})`,
    })
    toast.success('Rendelés sikeresen duplikálva')
  }

  const handleDeleteSelectedOrders = () => {
    if (selectedOrderIds.length === 0) return

    const deletedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    setLastAction({ type: 'delete', orders: deletedOrders })

    setOrders((current) => (current || []).filter(o => !selectedOrderIds.includes(o.id)))
    // Audit: csoportos rendelés-törlés (egy összevont sor — kompakt napló)
    if (deletedOrders.length > 0) {
      const names = deletedOrders.map(o => o.orderNumber || o.productName).filter(Boolean).slice(0, 8).join(', ')
      const more = deletedOrders.length > 8 ? `, +${deletedOrders.length - 8} további` : ''
      appendAudit(
        'order',
        'Rendelés',
        deletedOrders.map(o => o.id).join(','),
        `${deletedOrders.length} rendelés`,
        'bulkDelete',
        { notes: `${names}${more}` }
      )
    }
    setSelectedOrderIds([])
    toast.success(`${deletedOrders.length} rendelés törölve`)
  }

  const handleStatusChange = (id: string, status: OrderStatus) => {
    const ordersToChange = [id]
    handleBatchStatusChange(ordersToChange, status)
  }

  /**
   * Mobil oldalról érkező megjegyzés-mentés egy rendelésre.
   * Csak a `notes` mezőt frissíti és az `updatedAt`-et léptet.
   */
  const handleUpdateOrderNotes = (orderId: string, notes: string) => {
    setOrders((current) =>
      (current || []).map((o) =>
        o.id === orderId ? { ...o, notes, updatedAt: new Date().toISOString() } : o
      )
    )
  }

  const handleBatchStatusChange = (orderIds: string[], status: OrderStatus) => {
    const ordersToUpdate = (orders || []).filter(o => orderIds.includes(o.id))
    const isChangingToDelivered = isDelivered(status)

    if (isChangingToDelivered && ordersToUpdate.length > 0) {
      // Csak azok a rendelések, amelyek MOST váltanak kiszállítottra, és még
      // nincs szállítói levonásuk. Enélkül a Kiszállítva → Kiszállítva/Számlázva
      // (számlázás) átmenet másodszor is levonta ugyanazt a készletet.
      const ordersForDeduction = ordersToUpdate.filter(
        o => !isDelivered(o.status) && !hasExistingShipmentDeduction(o.id)
      )
      if (ordersForDeduction.length > 0) {
        const deductionResult = deductInventoryForOrders(
          ordersForDeduction,
          inventory || [],
          products || []
        )

        if (deductionResult.deductedItems.length > 0 || deductionResult.failedItems.length > 0) {
          setPendingDeductionResult(deductionResult)
          setPendingStatusChange({ orderIds, status })
          setPendingPostDeduction(null)
          setDeductionContext('státuszváltás')
          setInventoryDeductionDialogOpen(true)
          return
        }
      }
    }

    // Kiszállított → nem-kiszállított váltás: a korábban levont készlet
    // visszatöltése (tranzakció-alapú, idempotens — ld. inventoryService).
    if (!isChangingToDelivered) {
      const revertedOrders = ordersToUpdate.filter(o => isDelivered(o.status))
      if (revertedOrders.length > 0) {
        const restore = restoreInventoryForOrders(revertedOrders, inventoryTransactions || [])
        if (restore.restoredItems.length > 0) {
          commitInventoryRestore(restore, setInventory, setInventoryTransactions)
          toast.success(`Készlet visszatöltve: ${restore.restoredItems.length} tétel`)
        }
      }
    }

    executeStatusChange(orderIds, status)
  }

  const executeStatusChange = (orderIds: string[], status: OrderStatus) => {
    orderIds.forEach(id => {
      const before = orders?.find(o => o.id === id)
      if (before) {
        setLastAction({ type: 'edit', orderId: id, before: { ...before } })
        // Audit: státusz-váltás (csak ha valóban változott)
        if (before.status !== status) {
          appendAudit('order', 'Rendelés', before.id, before.orderNumber || before.productName || before.id, 'status', {
            changes: [{ field: 'status', label: 'Státusz', before: before.status, after: status }],
            notes: `${before.customer} · ${before.productName}`,
          })
        }
      }
    })

    setOrders((current) =>
      (current || []).map(o =>
        orderIds.includes(o.id)
          ? { ...o, status, updatedAt: new Date().toISOString() }
          : o
      )
    )

    // 'Elkészült' státusznál automatikusan eltávolítjuk a gyártástervező hozzárendelést
    if (status === 'Elkészült') {
      orderIds.forEach(id => {
        fetch(`/api/v1/machine-planning/order/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(err => console.warn('[planning] auto-remove sikertelen:', err))
      })
    }
  }

  const handleConfirmInventoryDeduction = async () => {
    if (!pendingDeductionResult) return

    // 1) Készletlevonás átvezetése — akkor is fut, ha a szállítólevél / CMR útvonalon jöttünk.
    if (pendingDeductionResult.deductedItems.length > 0) {
      // Atomicus commit: funkcionális setterek, így nem írjuk felül a közben
      // történt másik tab / másik kéz frissítését (lásd inventoryService.ts).
      commitInventoryDeduction(
        pendingDeductionResult,
        setInventory,
        setInventoryTransactions
      )
      toast.success(`Készlet csökkentve: ${pendingDeductionResult.deductedItems.length} tétel`)
    }
    if (pendingDeductionResult.failedItems.length > 0) {
      toast.warning(`${pendingDeductionResult.failedItems.length} tétel nem került levonásra`)
    }

    // 2) Státuszváltás vagy post-callback (szállítólevél / CMR export)
    if (pendingStatusChange) {
      executeStatusChange(pendingStatusChange.orderIds, pendingStatusChange.status)
    }
    const cb = pendingPostDeduction
    if (cb) {
      try {
        await cb()
      } catch (e) {
        console.error('Post-deduction callback hiba:', e)
        toast.error('A folytatás közben hiba történt')
      }
    }

    setInventoryDeductionDialogOpen(false)
    setPendingDeductionResult(null)
    setPendingStatusChange(null)
    setPendingPostDeduction(null)
    setDeductionContext('státuszváltás')
  }

  // ============================================================
  // Gyártási műszak kezelés (PRD §4.4)
  //
  // A műszak mentésénél:
  //   1. Új/módosított ProductionShift rekord útvonala.
  //   2. Automatikus készletfrissítés (lövésszám × fészekszám = db).
  //      Mindig lefut — ha nincs Product, az Order adataiból derítjük a
  //      készlettétel alapadatait, így a raktár akkor is nyilvántartódik,
  //      ha a termékrekord hiányzik.
  //      Ha volt korábbi rekord ugyanazon id-vel, annak a `producedQuantity`-ja
  //      visszavonódik (diff), hogy a szerkesztés ne halmozódjon.
  //   3. ProductionLog auditbejegyzés.
  // ============================================================

  // ============================================================
  // Audit-log (változásnapló) — központi hozzáadó segédfüggvény
  // ============================================================

  /**
   * Új audit-bejegyzés hozzáadása. Csak a változó részt kell megadni;
   * az `id` és `createdAt` automatikusan kitöltődik.
   */
  const appendAudit = (
    entityType: AuditEntityType,
    entityLabel: string,
    entityId: string,
    entityName: string,
    action: AuditAction,
    opts?: { changes?: AuditFieldChange[]; notes?: string; userId?: string; userName?: string }
  ) => {
    const entry = buildAuditEntry({
      entityType,
      entityLabel,
      entityId,
      entityName,
      action,
      changes: opts?.changes,
      notes: opts?.notes,
      userId: opts?.userId,
      userName: opts?.userName,
    })
    setAuditLog((current) => {
      const next = [...(current || []), entry]
      // Auto-prune: tartsuk a legutóbbi N bejegyzést, hogy a localStorage
      // ne fusson tele tipikusan napi ~50–200 audit-bejegyzés mellett.
      return pruneAuditLog(next, AUDIT_LOG_MAX_ENTRIES)
    })
  }

  /**
   * Termékkeresés egy rendeléshez. Az `Order.productId` (ha van) erős hivatkozás
   * a master termékre — egyértelmű, nem téveszthető össze. Ha hiányzik (régi
   * rendelés), visszaesünk a customer + productName/designation heurisztikára,
   * ami a productId-előtti viselkedést tartja meg.
   *
   * NB: ez egy lokális duplikáció a `productionHelpers.findProductForOrder`-é,
   * mert itt a `products` direkt elérhető — a két implementációnak szigorúan
   * azonos algoritmust kell használnia.
   */
  const findProductForOrder = (order: Order | undefined): Product | undefined => {
    if (!order) return undefined
    if (order.productId) {
      const exact = (products || []).find((p) => p.id === order.productId)
      if (exact) return exact
    }
    // Fallback: csak helyes mezőpárosítással — cross-field illesztés false positive-ot okoz.
    // order.productName = rajzszám, order.designation = terméknév (ld. OrderDialog)
    // product.drawingNumber = rajzszám, product.productName = terméknév
    return (products || []).find(
      (p) =>
        p.customer === order.customer &&
        (
          (order.productName && p.drawingNumber === order.productName) ||
          (order.designation && p.productName === order.designation)
        )
    )
  }

  const handleSaveShift = (shift: ProductionShift) => {
    const existing = (productionShifts || []).find((s) => s.id === shift.id)
    const qtyDelta = shift.producedQuantity - (existing?.producedQuantity ?? 0)

    if (existing) { shiftsApi.replace(shift) } else { shiftsApi.add(shift) }

    const order = (orders || []).find((o) => o.id === shift.orderId)
    const product = findProductForOrder(order)
    // Automatikus készletfrissítés: mindig frissítünk, ha van rendelés és mennyiség változott.
    // Az autoUpdateInventory DB-mezőre nem támaszkodunk — annak default értéke false volt,
    // ami megakadályozta a készletfrissítést minden meglévő terméknél.
    if (order && qtyDelta !== 0) {
      applyProductionShiftToInventory(shift, order, product, qtyDelta)
    }

    // Naplóbejegyzés
    const logEntry: ProductionLog = {
      id: generateId(),
      orderId: shift.orderId,
      productId: product?.id,
      action: existing ? 'Műszak módosítás' : 'Műszak rögzítés',
      notes: `${shift.date} ${shift.shift === 'de' ? 'Délelőtt' : 'Délután'} · ${shift.shotsCount} lövés · ${shift.producedQuantity} db`,
      userId: shift.userId,
      createdAt: new Date().toISOString(),
    }
    logsApi.add(logEntry)

    // Audit-log bejegyzés (változásnapló)
    const shiftName = `${shift.date} ${shift.shift === 'de' ? 'DE' : 'DU'} · ${order?.productName || order?.id || shift.orderId}`
    if (existing) {
      const changes = diffObjects(
        existing as unknown as Record<string, unknown>,
        shift as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('shift', 'Műszak', shift.id, shiftName, 'update', {
          changes,
          notes: `${shift.shotsCount} lövés · ${shift.producedQuantity} db`,
          userId: shift.userId,
        })
      }
    } else {
      appendAudit('shift', 'Műszak', shift.id, shiftName, 'create', {
        notes: `${shift.shotsCount} lövés · ${shift.producedQuantity} db`,
        userId: shift.userId,
      })
    }
  }

  const handleDeleteShift = (shiftId: string) => {
    const existing = (productionShifts || []).find((s) => s.id === shiftId)
    if (!existing) return
    const qtyDelta = -existing.producedQuantity // fordított delta → visszavonás

    shiftsApi.remove(shiftId)

    const order = (orders || []).find((o) => o.id === existing.orderId)
    const product = findProductForOrder(order)
    if (order && qtyDelta !== 0) {
      applyProductionShiftToInventory(existing, order, product, qtyDelta, /* isDelete */ true)
    }

    logsApi.add({
      id: generateId(),
      orderId: existing.orderId,
      productId: product?.id,
      action: 'Műszak törölve',
      notes: `${existing.date} · ${existing.shotsCount} lövés visszavonva`,
      createdAt: new Date().toISOString(),
    })

    const shiftName = `${existing.date} ${existing.shift === 'de' ? 'DE' : 'DU'} · ${order?.productName || existing.orderId}`
    appendAudit('shift', 'Műszak', existing.id, shiftName, 'delete', {
      notes: `${existing.shotsCount} lövés · ${existing.producedQuantity} db visszavonva`,
      userId: existing.userId,
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Selejt rögzítések (ProductionDefect) — kezelők
  // ─────────────────────────────────────────────────────────────

  /**
   * Selejt-mennyiség átvezetése a készletre.
   * A `delta` darabban értendő (NINCS lövés × fészek átszámítás), mert a selejt
   * eleve db-ban van rögzítve.
   *   - rögzítéskor       delta = -quantity      (kivét a készletből)
   *   - törléskor          delta = +quantity      (visszavétel a készletre)
   *   - szerkesztéskor     delta = old - new      (új>old esetén több kivét)
   */
  const applyDefectToInventory = (
    defect: ProductionDefect,
    order: Order,
    product: Product | undefined,
    delta: number,
    note: string
  ) => {
    if (delta === 0) return
    const now = new Date().toISOString()
    const productId = product?.id ?? `order-prod::${order.customer}::${order.productName}`
    const inventoryName = product?.productName || order.designation || order.productName
    const drawingNumber = product?.drawingNumber || order.productName || order.designation || ''
    const customer = product?.customer || order.customer
    const warehouse = product?.warehouse || ''
    const nestCountValue = product?.nestCount || '1'
    let itemId: string | null = null

    setInventory((current) => {
      const list = current || []
      // Ugyanaz a szigorú keresési sorrend mint applyProductionShiftToInventory-ban:
      // 1. productId — 2. rajzszám+vevő (ha nem üres) — 3. terméknév+vevő (ha nincs rajzszám)
      const existing =
        list.find((i) => i.productId === productId) ||
        (drawingNumber
          ? list.find((i) => i.customer === customer && i.drawingNumber === drawingNumber)
          : undefined) ||
        (!drawingNumber && inventoryName
          ? list.find((i) => i.customer === customer && i.productName === inventoryName)
          : undefined)
      if (existing) {
        itemId = existing.id
        return list.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                quantity: Math.max(0, i.quantity + delta),
                nestCount: i.nestCount || nestCountValue,
                productId: i.productId || productId,
                drawingNumber: i.drawingNumber || drawingNumber,
                productName: i.productName || inventoryName,
                lastUpdated: now,
              }
            : i
        )
      }
      // Nincs még készlettétel: ha kivét érkezne (delta < 0), nem hozunk létre tételt 0 készlettel.
      // Pozitív (visszavétel) delta esetén pedig nem tipikus, hogy kell, de létrehozzuk védelemből.
      if (delta <= 0) return list
      itemId = generateId()
      const newItem: InventoryItem = {
        id: itemId,
        productId,
        productName: inventoryName,
        drawingNumber,
        customer,
        quantity: delta,
        totalShots: 0,
        nestCount: nestCountValue,
        location: warehouse,
        notes: product ? '' : 'Automatikusan létrehozva selejt visszavonásból',
        lastUpdated: now,
        createdAt: now,
      }
      return [...list, newItem]
    })

    if (itemId) {
      const transaction: InventoryTransaction = {
        id: generateId(),
        inventoryItemId: itemId,
        type: delta >= 0 ? 'in' : 'out',
        quantity: Math.abs(delta),
        orderId: defect.orderId,
        notes: note,
        userId: defect.userId,
        createdAt: now,
      }
      setInventoryTransactions((current) => [...(current || []), transaction])
    }
  }

  const handleSaveDefect = (defect: ProductionDefect) => {
    const previous = (productionDefects || []).find((d) => d.id === defect.id)
    if (previous) { defectsApi.replace(defect) } else { defectsApi.add(defect) }

    const order = (orders || []).find((o) => o.id === defect.orderId)
    const product = order ? findProductForOrder(order) : undefined

    if (order) {
      // Új rögzítés: teljes mennyiséget kivenni; szerkesztés: csak a különbséget.
      const oldQty = previous?.quantity ?? 0
      const newQty = defect.quantity ?? 0
      const delta = -(newQty - oldQty) // kivét → negatív
      if (delta !== 0) {
        const note = previous
          ? `Selejt módosítva (${defect.date}, ${oldQty} → ${newQty} db) — ${defect.reason}`
          : `Selejt (${defect.date}, ${newQty} db) — ${defect.reason}`
        applyDefectToInventory(defect, order, product, delta, note)
      }
    }

    logsApi.add({
      id: generateId(),
      orderId: defect.orderId,
      productId: product?.id,
      action: previous ? 'Selejt módosítva' : 'Selejt rögzítve',
      notes: `${defect.date} · ${defect.quantity} db · ${defect.reason}`,
      userId: defect.userId,
      createdAt: new Date().toISOString(),
    })

    // Audit-log
    const defectName = `${defect.date} · ${order?.productName || defect.orderId}`
    if (previous) {
      const changes = diffObjects(
        previous as unknown as Record<string, unknown>,
        defect as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('defect', 'Selejt', defect.id, defectName, 'update', {
          changes,
          notes: `${defect.quantity} db · ${defect.reason}`,
          userId: defect.userId,
        })
      }
    } else {
      appendAudit('defect', 'Selejt', defect.id, defectName, 'create', {
        notes: `${defect.quantity} db · ${defect.reason}`,
        userId: defect.userId,
      })
    }
  }

  const handleDeleteDefect = (defectId: string) => {
    const existing = (productionDefects || []).find((d) => d.id === defectId)
    if (!existing) return
    defectsApi.remove(defectId)
    const order = (orders || []).find((o) => o.id === existing.orderId)
    const product = order ? findProductForOrder(order) : undefined

    // Törléskor a kivett mennyiséget visszaadjuk a készletre.
    if (order && existing.quantity > 0) {
      applyDefectToInventory(
        existing,
        order,
        product,
        +existing.quantity,
        `Selejt visszavonva (${existing.date}, ${existing.quantity} db)`
      )
    }

    logsApi.add({
      id: generateId(),
      orderId: existing.orderId,
      productId: product?.id,
      action: 'Selejt törölve',
      notes: `${existing.date} · ${existing.quantity} db visszavonva`,
      createdAt: new Date().toISOString(),
    })

    const defectName = `${existing.date} · ${order?.productName || existing.orderId}`
    appendAudit('defect', 'Selejt', existing.id, defectName, 'delete', {
      notes: `${existing.quantity} db · ${existing.reason}`,
      userId: existing.userId,
    })
  }

  /**
   * Készlet-delta átvezetése műszakrögzítés / törlés során.
   * A tételt elsősorban `productId` alapján keressük; ha Product nincs, akkor
   * rendelés-alapú szintetikus ID-t (`order-prod::<customer>::<productName>`)
   * használunk, de megengedjük a `(productName+customer)` alapú illeszkedést is
   * a létrehozáskor, hogy régi készlettételek ne duplikálódjanak.
   */
  const applyProductionShiftToInventory = (
    shift: ProductionShift,
    order: Order,
    product: Product | undefined,
    delta: number,
    isDelete = false
  ) => {
    const now = new Date().toISOString()
    // Készlet-azonosító adatok: először Product, fallback Order
    const productId = product?.id ?? `order-prod::${order.customer}::${order.productName}`
    const inventoryName = product?.productName || order.designation || order.productName
    const drawingNumber = product?.drawingNumber || order.productName || order.designation || ''
    const customer = product?.customer || order.customer
    const warehouse = product?.warehouse || ''
    const nestCountValue = product?.nestCount || '1'
    let itemId: string | null = null

    setInventory((current) => {
      const list = current || []
      // Háromszintű keresés — szigorú sorrendben, üres-string false positive nélkül:
      // 1. productId egyezés (legbiztosabb)
      // 2. Rajzszám + vevő (csak ha rajzszám nem üres — üres érték bármit egyeztetne)
      // 3. Terméknév + vevő (csak ha nincs rajzszám — elkerüli az ambiguitást)
      const existing =
        list.find((i) => i.productId === productId) ||
        (drawingNumber
          ? list.find((i) => i.customer === customer && i.drawingNumber === drawingNumber)
          : undefined) ||
        (!drawingNumber && inventoryName
          ? list.find((i) => i.customer === customer && i.productName === inventoryName)
          : undefined)
      if (existing) {
        itemId = existing.id
        return list.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                // Math.round: a backend integer mezőt vár — float-os lövésszám 400-as hibát okozna
                quantity: Math.max(0, Math.round(i.quantity + delta)),
                totalShots: Math.max(0, Math.round((i.totalShots ?? 0) + (isDelete ? -shift.shotsCount : shift.shotsCount))),
                nestCount: i.nestCount || nestCountValue,
                // Hiányzó azonosítók feltöltése Product-ból utólag, ha most találtunk
                productId: i.productId || productId,
                drawingNumber: i.drawingNumber || drawingNumber,
                productName: i.productName || inventoryName,
                lastUpdated: now,
              }
            : i
        )
      }
      // Ha még nincs tétel, és negatív delta érkezne (törlés nincs mihez), ne hozzunk létre újat.
      if (delta <= 0) return list
      itemId = generateId()
      const newItem: InventoryItem = {
        id: itemId,
        productId,
        productName: inventoryName,
        drawingNumber,
        customer,
        quantity: Math.round(delta),
        totalShots: Math.round(shift.shotsCount),
        nestCount: nestCountValue,
        location: warehouse,
        notes: product ? '' : 'Automatikusan létrehozva gyártásból (nincs termékrekord)',
        lastUpdated: now,
        createdAt: now,
      }
      return [...list, newItem]
    })

    if (itemId) {
      const transaction: InventoryTransaction = {
        id: generateId(),
        inventoryItemId: itemId,
        type: delta >= 0 ? 'in' : 'out',
        quantity: Math.abs(delta),
        shiftId: shift.id,
        orderId: shift.orderId,
        notes: isDelete
          ? `Műszak visszavonva (${shift.date} ${shift.shift === 'de' ? 'DE' : 'DU'})`
          : `Gyártás (${shift.date} ${shift.shift === 'de' ? 'DE' : 'DU'}, ${shift.shotsCount} lövés)`,
        userId: shift.userId,
        createdAt: now,
      }
      setInventoryTransactions((current) => [...(current || []), transaction])
    }
  }

  const handleNewOrder = () => {
    setSelectedOrder(null)
    setOrderDialogOpen(true)
  }

  const orderImportKey = (o: Partial<Order>): string => {
    // Természetes kulcs: vevő + rendelési szám + termék. Ha nincs rendelési
    // szám, a saját szám azonosít; e nélkül nem szűrünk (nincs identitás).
    const num = o.orderNumber || o.ownOrderNumber
    if (!num) return ''
    return `${stripDiacritics(o.customer)}|${stripDiacritics(num)}|${stripDiacritics(o.productName)}`
  }

  const handleOrderBulkImport = (importedOrders: Partial<Order>[]) => {
    const existingKeys = new Set((orders || []).map(orderImportKey).filter(Boolean))
    const fresh = importedOrders.filter((o) => {
      const key = orderImportKey(o)
      return !key || !existingKeys.has(key)
    })
    const skipped = importedOrders.length - fresh.length
    if (skipped > 0) toast.warning(`${skipped} rendelés már létezik — kihagyva`)
    if (fresh.length === 0) return

    setOrders((current) => [...(current || []), ...(fresh as Order[])])
    appendAudit(
      'order',
      'Rendelés',
      fresh.map((o) => (o as Order).id ?? '').filter(Boolean).join(','),
      `${fresh.length} rendelés`,
      'bulkImport',
      { notes: `Tömeges import: ${fresh.length} rendelés` }
    )
    toast.success(`${fresh.length} rendelés sikeresen importálva`)
  }

  const handleUndoLastAction = () => {
    if (!lastAction) return
    
    if (lastAction.type === 'delete') {
      setOrders((current) => [...(current || []), ...lastAction.orders])
      toast.success('Visszavonva')
      setLastAction(null)
    } else if (lastAction.type === 'edit') {
      // Készlet-kompenzáció: ha a visszavont művelet státuszt váltott a
      // kiszállított állapotba/állapotból, a készletet is vissza kell igazítani.
      const current = (orders || []).find(o => o.id === lastAction.orderId)
      const before = lastAction.before
      if (current) {
        if (isDelivered(current.status) && !isDelivered(before.status)) {
          // A visszavont váltás levont készletet → visszatöltés
          const restore = restoreInventoryForOrders([current], inventoryTransactions || [])
          if (restore.restoredItems.length > 0) {
            commitInventoryRestore(restore, setInventory, setInventoryTransactions)
            toast.success(`Készlet visszatöltve: ${restore.restoredItems.length} tétel`)
          }
        } else if (
          !isDelivered(current.status) &&
          isDelivered(before.status) &&
          !hasExistingShipmentDeduction(before.id)
        ) {
          // Visszavonás egy kiszállított állapotra → az eredetileg már
          // megerősített levonás újra-alkalmazása (dialógus nélkül).
          const d = deductInventoryForOrders([before], inventory || [], products || [])
          if (d.deductedItems.length > 0) {
            commitInventoryDeduction(d, setInventory, setInventoryTransactions)
            toast.success(`Készlet levonva: ${d.deductedItems.length} tétel`)
          }
        }
      }

      setOrders((current) =>
        (current || []).map(o => o.id === lastAction.orderId ? lastAction.before : o)
      )
      toast.success('Visszavonva')
      setLastAction(null)
    }
  }

  const handleSaveCustomer = (customerData: Partial<Customer>) => {
    if (selectedCustomer) {
      const before = customers?.find((c) => c.id === selectedCustomer.id)
      const after = before ? { ...before, ...customerData } : null
      setCustomers((current) =>
        (current || []).map((c) =>
          c.id === selectedCustomer.id ? { ...c, ...customerData } : c
        )
      )
      if (before && after) {
        const changes = diffObjects(
          before as unknown as Record<string, unknown>,
          after as unknown as Record<string, unknown>
        )
        if (changes.length > 0) {
          appendAudit('customer', 'Vevő', selectedCustomer.id, before.name || selectedCustomer.id, 'update', { changes })
        }
      }
      toast.success('Vevő sikeresen frissítve')
    } else {
      const newCustomer: Customer = {
        ...customerData,
      } as Customer
      setCustomers((current) => [...(current || []), newCustomer])
      appendAudit('customer', 'Vevő', newCustomer.id || '?', newCustomer.name || newCustomer.id || '?', 'create', {
        notes: newCustomer.fullAddress || newCustomer.city,
      })
      toast.success('Vevő sikeresen létrehozva')
    }
    setSelectedCustomer(null)
  }

  const handleEditCustomer = (id: string) => {
    const customer = (customers || []).find((c) => c.id === id)
    if (customer) {
      setSelectedCustomer(customer)
      setCustomerDialogOpen(true)
    }
  }

  const handleDeleteCustomer = (id: string) => {
    const existing = (customers || []).find((c) => c.id === id)
    setCustomers((current) => (current || []).filter((c) => c.id !== id))
    if (existing) {
      appendAudit('customer', 'Vevő', existing.id, existing.name || id, 'delete', {
        notes: existing.fullAddress || existing.city,
      })
    }
    toast.success('Vevő sikeresen törölve')
  }

  const handleNewCustomer = () => {
    setSelectedCustomer(null)
    setCustomerDialogOpen(true)
  }

  const handleBulkImport = (importedCustomers: Partial<Customer>[]) => {
    // Duplikátum-szűrés név alapján — ugyanaz a fájl kétszer importálva
    // korábban minden vevőt megduplázott (új ID-kkal).
    const existingNames = new Set((customers || []).map((c) => stripDiacritics(c.name)))
    const fresh = importedCustomers.filter(
      (c) => !c.name || !existingNames.has(stripDiacritics(c.name))
    )
    const skipped = importedCustomers.length - fresh.length
    if (skipped > 0) toast.warning(`${skipped} vevő már létezik — kihagyva`)
    if (fresh.length === 0) return

    setCustomers((current) => [...(current || []), ...(fresh as Customer[])])
    appendAudit('customer', 'Vevő', '-', `${fresh.length} vevő`, 'bulkImport', {
      notes: `Tömeges import: ${fresh.length} vevő`,
    })
    toast.success(`${fresh.length} vevő sikeresen importálva`)
  }

  const handleSaveProduct = (productData: Partial<Product>) => {
    if (selectedProduct) {
      const before = products?.find((p) => p.id === selectedProduct.id)
      const after = before ? { ...before, ...productData } : null
      setProducts((current) =>
        (current || []).map((p) =>
          p.id === selectedProduct.id ? { ...p, ...productData } : p
        )
      )
      if (before && after) {
        const changes = diffObjects(
          before as unknown as Record<string, unknown>,
          after as unknown as Record<string, unknown>
        )
        if (changes.length > 0) {
          const name = before.productName || before.drawingNumber || selectedProduct.id
          appendAudit('product', 'Termék', selectedProduct.id, name, 'update', {
            changes,
            notes: `${before.customer || ''}`.trim() || undefined,
          })
        }
      }
      toast.success('Termék sikeresen frissítve')
    } else {
      const newProduct: Product = {
        id: generateId(),
        ...productData,
      } as Product
      setProducts((current) => [...(current || []), newProduct])
      const name = newProduct.productName || newProduct.drawingNumber || newProduct.id
      appendAudit('product', 'Termék', newProduct.id, name, 'create', {
        notes: newProduct.customer,
      })
      toast.success('Termék sikeresen létrehozva')
    }
    setSelectedProduct(null)
  }

  const handleEditProduct = (id: string) => {
    const product = (products || []).find((p) => p.id === id)
    if (product) {
      setSelectedProduct(product)
      setProductDialogOpen(true)
    }
  }

  const handleDeleteProduct = (id: string) => {
    const existing = (products || []).find((p) => p.id === id)
    setProducts((current) => (current || []).filter((p) => p.id !== id))
    if (existing) {
      const name = existing.productName || existing.drawingNumber || id
      appendAudit('product', 'Termék', id, name, 'delete', { notes: existing.customer })
    }
    toast.success('Termék sikeresen törölve')
  }

  const handleBulkDeleteProducts = (ids: string[]) => {
    if (!ids.length) return
    const idSet = new Set(ids)
    const existing = (products || []).filter((p) => idSet.has(p.id))
    setProducts((current) => (current || []).filter((p) => !idSet.has(p.id)))
    if (existing.length > 0) {
      const names = existing
        .map((p) => p.productName || p.drawingNumber || p.id)
        .slice(0, 8)
        .join(', ')
      const more = existing.length > 8 ? `, +${existing.length - 8} további` : ''
      appendAudit('product', 'Termék', ids.join(','), `${ids.length} termék`, 'bulkDelete', {
        notes: `${names}${more}`,
      })
    }
    toast.success(`${ids.length} termék sikeresen törölve`)
  }

  // ---- Egyszerű listák (Gépek, Felhasználók, Anyaglista) -------------------
  const handleSaveMachine = (m: Machine) => {
    const before = machinesApi.items.find((x) => x.id === m.id)
    // Szerkesztésnél merge-eljük a meglévő rekorddal, hogy az oils/accessories/
    // repairs/photoUrl mezők ne veszjenek el — a SimpleListView csak az alap
    // oszlopokat (name/type/capacity/notes) adja vissza.
    // Új gépnél tároljuk a létrehozó user ID-ját.
    const record: Machine = before
      ? { ...before, ...m }
      : { ...m, createdBy: auth.user?.id }
    if (before) {
      machinesApi.replace(record)
      const changes = diffObjects(
        before as unknown as Record<string, unknown>,
        record as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('machine', 'Gép', record.id, record.name || record.id, 'update', { changes })
      }
    } else {
      machinesApi.add(record)
      appendAudit('machine', 'Gép', record.id, record.name || record.id, 'create', { notes: record.type })
    }
  }
  const handleDeleteMachine = (id: string) => {
    const existing = machinesApi.items.find((x) => x.id === id)
    machinesApi.remove(id)
    if (existing) {
      appendAudit('machine', 'Gép', id, existing.name || id, 'delete', { notes: existing.type })
    }
  }

  /**
   * A "Felhasználók" tab mentése a BACKEND-en keresztül megy. A SimpleListView
   * egy formból érkező rekordot ad át, amelyben a `pin` cleartext (a backend
   * bcrypt-eli, soha nem tároljuk hash-eletlenül). `active` stringként jön
   * ('Igen'/'Nem'), ezt boolean-né konvertáljuk. A sikeres írás után
   * újratöltjük a listát + a login-screen publikus user-listáját is, hogy
   * a változás azonnal látsszon.
   */
  const handleSaveUser = async (u: User & { pin?: string; active?: boolean | string }) => {
    if (auth.status !== 'authenticated') {
      toast.error('Bejelentkezés szükséges a felhasználó-kezeléshez.')
      throw new Error('not-authenticated')
    }
    if (auth.user?.role !== 'admin') {
      toast.error('Csak adminisztrátor hozhat létre vagy módosíthat felhasználót.')
      throw new Error('forbidden')
    }
    // A SimpleListView form-rekordja stringeket ad vissza — boolean-okat
    // és üres mezőket itt normalizáljuk.
    const activeRaw = (u as { active?: boolean | string }).active
    const active =
      typeof activeRaw === 'boolean'
        ? activeRaw
        : typeof activeRaw === 'string'
          ? activeRaw === 'Igen' || activeRaw === 'true' || activeRaw === '1'
          : true
    const role = (u.role as UserRole) || 'operator'
    const pin = typeof u.pin === 'string' ? u.pin.trim() : ''
    const existing = users.find((x) => x.id === u.id)

    try {
      if (existing) {
        // Update: csak a megváltozott + üres-PIN-mentes mezőket küldjük
        const updatePayload = {
          name: u.name,
          email: u.email || '',
          role,
          notes: u.notes || '',
          active,
          ...(pin.length > 0 ? { pin } : {}),
        }
        const updated = await updateUser(u.id, updatePayload)
        // Audit (frontend log) — a backend is auditál, de a UI a frontend logot mutatja
        const changes = diffObjects(
          existing as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>
        )
        if (changes.length > 0) {
          appendAudit('user', 'Felhasználó', updated.id, updated.name || updated.id, 'update', {
            changes,
          })
        }
      } else {
        // Create: a backend a `pin` mezőt fogadja, hash-eli, és törli
        const createPayload = {
          name: u.name,
          email: u.email || '',
          role,
          notes: u.notes || '',
          active,
          ...(pin.length > 0 ? { pin } : {}),
        }
        const created = await createUser(createPayload)
        appendAudit('user', 'Felhasználó', created.id, created.name || created.id, 'create', {
          notes: created.email || '',
        })
      }
      // Lista + login-screen publikus lista frissítése
      await refreshUsers()
      void auth.refreshPublicUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Mentés sikertelen'
      toast.error(`Felhasználó mentése sikertelen: ${msg}`)
      throw err
    }
  }
  const handleDeleteUser = async (id: string) => {
    if (auth.status !== 'authenticated') {
      toast.error('Bejelentkezés szükséges a felhasználó-kezeléshez.')
      throw new Error('not-authenticated')
    }
    if (auth.user?.role !== 'admin') {
      toast.error('Csak adminisztrátor törölhet felhasználót.')
      throw new Error('forbidden')
    }
    if (auth.user?.id === id) {
      toast.error('Saját magadat nem törölheted. Kérj meg egy másik admin-t.')
      throw new Error('self-delete-forbidden')
    }
    const existing = users.find((x) => x.id === id)
    try {
      await deleteUser(id)
      if (existing) {
        appendAudit('user', 'Felhasználó', id, existing.name || id, 'delete', {
          notes: existing.email || '',
        })
      }
      await refreshUsers()
      void auth.refreshPublicUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Törlés sikertelen'
      toast.error(`Felhasználó törlése sikertelen: ${msg}`)
      throw err
    }
  }

  const handleSaveMaterial = (m: Material) => {
    const before = materialsApi.items.find((x) => x.id === m.id)
    // Új anyagnál tároljuk a létrehozó user ID-ját
    const record: Material = before
      ? m
      : { ...m, createdBy: auth.user?.id }
    if (before) {
      materialsApi.replace(record)
      const changes = diffObjects(
        before as unknown as Record<string, unknown>,
        record as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('material', 'Anyag', record.id, record.name || record.id, 'update', { changes })
      }
    } else {
      materialsApi.add(record)
      appendAudit('material', 'Anyag', record.id, record.name || record.id, 'create', { notes: record.type })
    }
  }
  const handleDeleteMaterial = (id: string) => {
    const existing = materialsApi.items.find((x) => x.id === id)
    materialsApi.remove(id)
    if (existing) {
      appendAudit('material', 'Anyag', id, existing.name || id, 'delete', { notes: existing.type })
    }
  }


  const handleNewProduct = () => {
    setSelectedProduct(null)
    setProductDialogOpen(true)
  }

  const handleProductBulkImport = (importedProducts: Partial<Product>[]) => {
    // Duplikátum-szűrés: vevő + rajzszám (ha nincs rajzszám, vevő + terméknév)
    const productKey = (p: Partial<Product>): string => {
      const ident = p.drawingNumber || p.productName
      if (!ident) return ''
      return `${stripDiacritics(p.customer)}|${stripDiacritics(ident)}`
    }
    const existingKeys = new Set((products || []).map(productKey).filter(Boolean))
    const fresh = importedProducts.filter((p) => {
      const key = productKey(p)
      return !key || !existingKeys.has(key)
    })
    const skipped = importedProducts.length - fresh.length
    if (skipped > 0) toast.warning(`${skipped} termék már létezik — kihagyva`)
    if (fresh.length === 0) return

    setProducts((current) => [...(current || []), ...(fresh as Product[])])
    toast.success(`${fresh.length} termék sikeresen importálva`)
  }

  // Kiegészítő tételek a szállítólevélen (szerszám / anyag / szabad sor)
  const [extraItemsNote, setExtraItemsNote] = useState<DeliveryNote | null>(null)
  const handleSaveExtraItems = (note: DeliveryNote, extraItems: ExtraDeliveryItem[]) => {
    const existing = deliveryNotesApi.items.find((dn) => dn.id === note.id)
    if (!existing) return
    deliveryNotesApi.replace({ ...existing, extraItems, updatedAt: new Date().toISOString() })
  }

  const handleDeleteDeliveryNote = (id: string) => {
    deliveryNotesApi.remove(id)
    toast.success('Szállítólevél sikeresen törölve')
  }

  const handleUpdateDeliveryNote = (id: string, updatedData: Record<string, string | number | null | undefined>[]) => {
    const existing = deliveryNotesApi.items.find((dn) => dn.id === id)
    if (existing) {
      deliveryNotesApi.replace({ ...existing, exportData: updatedData, updatedAt: new Date().toISOString() })
    }
    toast.success('Szállítólevél sikeresen frissítve')
  }

  const handlePreviewNote = async (note: DeliveryNote) => {
    const noteOrders = (orders || []).filter(o => note.orderIds.includes(o.id))
    if (note.type === 'cmr') {
      await exportCmrAsHtml(
        noteOrders, customers || [], products || [], deliveryNotes || [],
        undefined, cmrSettings, savedTemplates, activeTemplates,
        note.issueDate, note.sequenceNumber
      )
    } else {
      await exportDeliveryAsHtml(
        noteOrders, customers || [], products || [], deliveryNotes || [],
        undefined, undefined, savedTemplates, activeTemplates,
        note.issueDate, note.sequenceNumber, note.extraItems
      )
    }
  }

  const handleDownloadPdf = async (note: DeliveryNote) => {
    const noteOrders = (orders || []).filter(o => note.orderIds.includes(o.id))

    // HTML generálás az aktív/mentett sablon alapján (szerver-oldali adatokkal)
    let html = ''
    if (note.type === 'cmr') {
      html = getCmrHtml(
        noteOrders, customers || [], products || [], deliveryNotes || [],
        cmrSettings, note.sequenceNumber,
        savedTemplates, activeTemplates, note.issueDate
      )
    } else {
      html = getDeliveryHtml(
        noteOrders, customers || [], products || [], deliveryNotes || [],
        undefined, note.sequenceNumber,
        savedTemplates, activeTemplates, note.issueDate, note.extraItems
      )
    }

    const type = note.type === 'cmr' ? 'CMR' : 'Szallitolevel'
    const filename = `${type}_${note.sequenceNumber}_${note.customer.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    try {
      const token = document.cookie
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('pp_session='))
        ?.split('=')[1] ?? ''

      const res = await fetch('/api/v1/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ html, filename }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(`PDF generálás sikertelen: ${(err as any).detail || res.statusText}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`PDF letöltve: ${filename}`)
    } catch (err) {
      toast.error(`PDF generálás sikertelen: ${String(err)}`)
    }
  }

  const handleEmailNote = (note: DeliveryNote, ccEmails?: string) => {
    const customer = (customers || []).find(c => c.name === note.customer)
    const email = customer?.email || ''
    const type = note.type === 'cmr' ? 'CMR' : 'Szállítólevél'
    const subject = `${type} - ${note.sequenceNumber}`
    const body = (emailTemplate || '')
      .replace(/\{\{sorszam\}\}/g, note.sequenceNumber)
      .replace(/\{\{tipus\}\}/g, type.toLowerCase())
      .replace(/\{\{Tipus\}\}/g, type)
      .replace(/\{\{vevo\}\}/g, note.customer)
    const cc = ccEmails ? `&cc=${encodeURIComponent(ccEmails)}` : ''
    window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc}`)
  }

  const handleExportDelivery = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }
    setIssueDateDialogType('delivery')
    setIssueDateDialogOpen(true)
  }
  
  /**
   * Megadott rendeléseken már történt-e korábban szállítólevél / CMR alapú
   * készletkivét? Ha igen, a duplikáció elkerülése érdekében nem vonjuk le
   * újra. (Ugyanarra az orderId-re egyszer vonunk le készletet.)
   */
  const hasExistingShipmentDeduction = (orderId: string): boolean => {
    return (inventoryTransactions || []).some(
      (t) => t.type === 'out' && t.orderId === orderId && !t.shiftId
    )
  }

  /** Dátumválasztó megerősítése után fut — elvégzi a validációt, majd exportál. */
  const handleIssueDateConfirm = async (issueDate: string) => {
    setPendingIssueDate(issueDate)
    setIssueDateDialogOpen(false)

    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))

    if (issueDateDialogType === 'delivery') {
      const validation = validateDeliveryExport(selectedOrders, customers || [], products || [])
      if (!validation.isValid || validation.warnings.length > 0) {
        setValidationResult(validation)
        setPendingExportType('delivery')
        setValidationDialogOpen(true)
        return
      }
      await executeDeliveryExport(issueDate)
    } else {
      const validation = validateCmrExport(selectedOrders, customers || [], products || [], cmrSettings)
      if (!validation.isValid || validation.warnings.length > 0) {
        setValidationResult(validation)
        setPendingExportType('cmr')
        setValidationDialogOpen(true)
        return
      }
      await executeCmrExport(issueDate)
    }
  }

  const actuallyRunDeliveryExport = async (selectedOrders: Order[], issueDate?: string) => {
    await exportDeliveryAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const newNote = {
          ...deliveryNote,
          id: generateId(),
          sequenceNumber: sequenceNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        deliveryNotesApi.add(newNote as DeliveryNote)

        if (sequenceNumber) {
          const orderIdsToUpdate = selectedOrders.map((o) => o.id)
          setOrders((current) =>
            (current || []).map((o) =>
              orderIdsToUpdate.includes(o.id)
                ? { ...o, deliveryNote: sequenceNumber, updatedAt: new Date().toISOString() }
                : o
            )
          )
        }
      },
      deliveryStyles,
      savedTemplates,
      activeTemplates,
      issueDate ?? undefined
    )
  }

  const executeDeliveryExport = async (issueDate?: string) => {
    const selectedOrders = (orders || []).filter((o) => selectedOrderIds.includes(o.id))

    // Készletlevonás csak olyan rendelésekre, amelyeknél még nem történt szállítói levonás
    const ordersForDeduction = selectedOrders.filter((o) => !hasExistingShipmentDeduction(o.id))

    if (ordersForDeduction.length === 0) {
      // Nincs mit levonni — közvetlenül exportálunk
      await actuallyRunDeliveryExport(selectedOrders, issueDate)
      return
    }

    const deductionResult = deductInventoryForOrders(
      ordersForDeduction,
      inventory || [],
      products || []
    )

    const needsConfirmation =
      deductionResult.failedItems.length > 0 ||
      deductionResult.deductedItems.some((d) => d.shortage > 0)

    if (needsConfirmation) {
      setPendingDeductionResult(deductionResult)
      setDeductionContext('szállítólevél')
      setPendingStatusChange(null)
      setPendingPostDeduction(() => async () => {
        await actuallyRunDeliveryExport(selectedOrders, issueDate)
      })
      setInventoryDeductionDialogOpen(true)
      return
    }

    // Teljes fedezet — automatikusan levonjuk, majd exportálunk
    if (deductionResult.deductedItems.length > 0) {
      commitInventoryDeduction(
        deductionResult,
        setInventory,
        setInventoryTransactions
      )
      toast.success(`Készlet csökkentve: ${deductionResult.deductedItems.length} tétel`)
    }
    await actuallyRunDeliveryExport(selectedOrders, issueDate)
  }

  const handleExportCmr = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }
    setIssueDateDialogType('cmr')
    setIssueDateDialogOpen(true)
  }
  
  const executeCmrExport = async (issueDate?: string) => {
    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))

    await exportCmrAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const newNote = {
          ...deliveryNote,
          id: generateId(),
          sequenceNumber: sequenceNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        deliveryNotesApi.add(newNote as DeliveryNote)

        if (sequenceNumber) {
          const orderIdsToUpdate = selectedOrders.map(o => o.id)
          setOrders((current) =>
            (current || []).map(o =>
              orderIdsToUpdate.includes(o.id)
                ? { ...o, cmr: sequenceNumber, updatedAt: new Date().toISOString() }
                : o
            )
          )
        }
      },
      cmrSettings,
      savedTemplates,
      activeTemplates,
      issueDate ?? undefined
    )
  }

  const handleValidationContinue = async () => {
    setValidationDialogOpen(false)

    if (pendingExportType === 'cmr') {
      await executeCmrExport(pendingIssueDate ?? undefined)
    } else if (pendingExportType === 'delivery') {
      await executeDeliveryExport(pendingIssueDate ?? undefined)
    }
    
    setPendingExportType(null)
    setValidationResult(null)
  }

  const activeOrders = useMemo(() => {
    let filtered = orders || []
    
    if (hideDelivered) {
      filtered = filtered.filter(o => !isDelivered(o.status))
    }

    if (hideInvoiced) {
      filtered = filtered.filter(o => !isInvoiced(o.status))
    }
    
    if (yearFilterEnabled && selectedYears.length > 0 && yearOptions.length > 0) {
      const yearSet = new Set(selectedYears)
      filtered = filtered.filter(o => {
        const yOrder = parseYear(o.orderDate)
        return yOrder != null && yearSet.has(yOrder)
      })
    }
    
    return filtered
  }, [orders, hideDelivered, hideInvoiced, selectedYears, yearOptions.length, yearFilterEnabled])

  const filteredOrders = useMemo(() => {
    let filtered = activeOrders
    
    const query = stripDiacritics(orderSearchQuery)
    if (query) {
      filtered = filtered.filter(o =>
        stripDiacritics(o.productName).includes(query) ||
        stripDiacritics(o.orderNumber).includes(query) ||
        stripDiacritics(o.customer).includes(query) ||
        stripDiacritics(o.designation).includes(query) ||
        stripDiacritics(o.notes).includes(query) ||
        stripDiacritics(o.material).includes(query)
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }
    
    return filtered
  }, [activeOrders, orderSearchQuery, statusFilter])

  // Memoizált szűrt listák — a vevő/termék panelen való gépelés többé
  // nem indít újratöltést a fő rendelés-listán (és viszont). A useMemo a
  // hivatkozási egyenlőséget tartja meg, így a `OrdersTable` / `CustomersTable`
  // / `ProductsTable` virtualizációja vagy memoizációja sem invalidálódik
  // szükségtelenül.
  const filteredCustomers = useMemo(() => {
    const query = stripDiacritics(customerSearchQuery)
    if (!query) return customers || []
    return (customers || []).filter(
      (customer) =>
        stripDiacritics(customer.name).includes(query) ||
        stripDiacritics(customer.city).includes(query) ||
        stripDiacritics(customer.country).includes(query) ||
        stripDiacritics(customer.taxNumber).includes(query) ||
        stripDiacritics(customer.postalCode).includes(query)
    )
  }, [customers, customerSearchQuery])

  const filteredProducts = useMemo(() => {
    const query = stripDiacritics(productSearchQuery)
    if (!query) return products || []
    return (products || []).filter(
      (product) =>
        stripDiacritics(product.customer).includes(query) ||
        stripDiacritics(product.productName).includes(query) ||
        stripDiacritics(product.drawingNumber).includes(query) ||
        stripDiacritics(product.articleNumber).includes(query) ||
        stripDiacritics(product.material).includes(query)
    )
  }, [products, productSearchQuery])

  const dashboardFilteredOrders = useMemo(() => {
    const query = stripDiacritics(dashboardSearchQuery)
    if (!query) return orders || []
    return (orders || []).filter(
      (order) =>
        stripDiacritics(order.productName).includes(query) ||
        stripDiacritics(order.orderNumber).includes(query) ||
        stripDiacritics(order.customer).includes(query)
    )
  }, [orders, dashboardSearchQuery])

  const metrics = useMemo(
    () => calculateDashboardMetrics(dashboardFilteredOrders),
    [dashboardFilteredOrders]
  )

  // ── Alapanyag-gazdálkodás (A3 hibrid modell) ──
  // Élő becslés a Rendelések összesítő sávjához; a részletes kártyák a
  // MaterialPanel-ben élnek (Gyártás + Készlet fül).
  const [materialBookedThrough] = useAppSetting<MaterialBookedThroughMap>(MATERIAL_BOOKED_THROUGH_KEY, {})
  const materialEstimateKg = useMemo(() => {
    const statuses = computeMaterialStatuses(
      inventory || [],
      productionShifts || [],
      orders || [],
      products || [],
      inventoryTransactions || [],
      materialBookedThrough
    )
    return statuses.length > 0 ? totalEstimatedMaterialKg(statuses) : null
  }, [inventory, productionShifts, orders, products, inventoryTransactions, materialBookedThrough])

  /** Anyag-művelet (bevét/visszaolvasztás/leltár) átvezetése + audit. */
  const handleMaterialAction = useCallback(
    ({ updatedItem, transaction, kind }: {
      updatedItem: InventoryItem
      transaction: InventoryTransaction
      kind: MaterialActionKind
    }) => {
      setInventory((current) =>
        (current || []).map((i) => (i.id === updatedItem.id ? updatedItem : i))
      )
      setInventoryTransactions((current) => [...(current || []), transaction])
      appendAudit(
        'inventory',
        'Készlet',
        updatedItem.id,
        updatedItem.productName || updatedItem.id,
        transaction.type as AuditAction,
        { notes: transaction.notes, userId: auth.user?.id, userName: auth.user?.name }
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.user?.id, auth.user?.name]
  )

  // Lejárt határidejű, még ki nem szállított rendelések — a legrégebben
  // lejárt elöl. A dashboard piros sávban jelzi (a leginkább akcióigényes tétel).
  const overdueOrders = useMemo(
    () =>
      (dashboardFilteredOrders || [])
        .filter((o) => isOverdue(o.requiredDate, o.status))
        .sort(
          (a, b) =>
            new Date(a.requiredDate).getTime() - new Date(b.requiredDate).getTime()
        ),
    [dashboardFilteredOrders]
  )

  const productionKPIs = useMemo(
    () => calculateProductionKPIs(productionShifts || [], productionDefects || []),
    [productionShifts, productionDefects]
  )

  const lowStockItems = useMemo(() => {
    if (!inventory || !products) return []
    const productMap = new Map((products || []).map(p => [p.id, p]))
    return (inventory || []).filter(item => {
      const product = productMap.get(item.productId)
      if (!product?.lowStockThreshold) return false
      return item.quantity < product.lowStockThreshold
    })
  }, [inventory, products])

  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year))
    } else {
      setSelectedYears([...selectedYears, year])
    }
  }

  const handleFilterByStatus = (status: OrderStatus | 'all') => {
    setCurrentTab('orders')
    setStatusFilter(status)
    setHideDelivered(false)
  }

  const activeWorkCount = useMemo(() => {
    return filteredOrders.filter(o => ACTIVE_WORK_STATUSES.includes(o.status)).length
  }, [filteredOrders])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Factory className="w-8 h-8" weight="duotone" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  ProduktívPro
                  <span className="ml-2 align-middle text-xs font-mono font-normal text-muted-foreground">
                    {import.meta.env.VITE_APP_VERSION || 'dev'}
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground">Termelés Irányítási Rendszer</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted-foreground hidden sm:flex"
                onClick={() => setGlobalSearchOpen(true)}
                title="Gyorskereső (Ctrl+K)"
              >
                <MagnifyingGlass className="w-4 h-4" />
                <span className="hidden md:inline">Keresés</span>
                <kbd className="hidden md:inline pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
              </Button>
              <MessageCenter
                messagesApi={messagesApi}
                currentUser={auth.user ? { id: auth.user.id, name: auth.user.name } : null}
              />
              <ThemeToggle />
              {auth.user && (
                <div className="flex items-center gap-2 border-l pl-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{auth.user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{auth.user.role === 'admin' ? 'Adminisztrátor' : auth.user.role === 'operator' ? 'Operátor' : 'Megfigyelő'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => auth.logout()} title="Kijelentkezés">
                    <SignOut className="w-4 h-4" weight="bold" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Állapot-csík — egy pillantásra a műhely legfontosabb mutatói.
              Minden csempe a megfelelő szűrt nézetre ugrik. */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setCurrentTab('production')}
              className="text-left rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-accent/80">Aktív munka</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-accent">{activeWorkCount}</div>
            </button>
            <button
              type="button"
              onClick={() => handleFilterByStatus('Folyamatban')}
              className="text-left rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-warning/80">Gyártás alatt</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-warning">{metrics.inProductionOrders}</div>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('deliveries')}
              className="text-left rounded-lg bg-success/10 hover:bg-success/20 transition-colors px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-success/80">Szállításra kész</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-success">{metrics.readyForDeliveryOrders}</div>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('inventory')}
              className={`text-left rounded-lg transition-colors px-3 py-2 ${lowStockItems.length > 0 ? 'bg-destructive/10 hover:bg-destructive/20 ring-1 ring-destructive/30' : 'bg-muted hover:bg-muted/70'}`}
            >
              <div className={`text-[11px] uppercase tracking-wide ${lowStockItems.length > 0 ? 'text-destructive/80' : 'text-muted-foreground'}`}>Alacsony készlet</div>
              <div className={`text-2xl font-bold font-mono tabular-nums ${lowStockItems.length > 0 ? 'text-destructive' : ''}`}>{lowStockItems.length}</div>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto px-6 py-8">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
          <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />

          <div className="flex items-center gap-3 flex-wrap">
            {/* Telefonon vízszintesen görgethető sáv (a magyar címkék nem férnek
                5 fix oszlopba 375px-en); md-től rácsba rendezve. */}
            <TabsList className={`flex w-full max-w-full overflow-x-auto md:grid md:w-auto md:inline-grid text-xs sm:text-sm ${auth.user?.role === 'operator' ? 'md:grid-cols-3' : 'md:grid-cols-5'}`}>
              {auth.user?.role !== 'operator' && <TabsTrigger value="dashboard">Áttekintés</TabsTrigger>}
              <TabsTrigger value="production">Gyártás</TabsTrigger>
              <TabsTrigger value="planning">Gy. tervezés</TabsTrigger>
              {auth.user?.role !== 'operator' && <TabsTrigger value="orders">Rendelések</TabsTrigger>}
              <TabsTrigger value="inventory" className="relative">
                Készlet
                {lowStockItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {lowStockItems.length > 9 ? '9+' : lowStockItems.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 ml-auto">
              {/* Törzsadatok — alap nyilvántartások */}
              {(auth.user?.role === 'admin' || auth.user?.role === 'operator') && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Database className="w-4 h-4" />
                    Törzsadatok
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {auth.user?.role === 'admin' && <DropdownMenuItem onSelect={() => setCurrentTab('customers')}>
                    Vevők
                  </DropdownMenuItem>}
                  {auth.user?.role === 'admin' && <DropdownMenuItem onSelect={() => setCurrentTab('products')}>
                    Termékek
                  </DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => setCurrentTab('machines')}>
                    Gépek
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('maintenance')}>
                    Karbantartás
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('materials')}>
                    Anyaglista
                  </DropdownMenuItem>
                  {auth.user?.role === 'admin' && <DropdownMenuItem onSelect={() => setCurrentTab('users')}>
                    Felhasználók
                  </DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  {auth.user?.role === 'admin' && <DropdownMenuItem onSelect={() => setCurrentTab('reports')}>
                    Riportok
                  </DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => setCurrentTab('production-history')}>
                    Gyártás előzmények
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}

              {/* Dokumentumok — kimenő iratok és mentett fájlok */}
              {auth.user?.role === 'admin' && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Dokumentumok
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCurrentTab('documents')}>
                    Szállítólevelek / CMR
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('saves')}>
                    Mentett fájlok
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}

              {/* Beállítások — sablonok és nyomtatás */}
              {auth.user?.role === 'admin' && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Gear className="w-4 h-4" />
                    Beállítások
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCurrentTab('github-editor')}>
                    Sablon szerkesztő
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('template-saves')}>
                    Sablon mentések
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('label-templates')}>
                    Címke sablonok
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setWorkCalendarDialogOpen(true)}>
                    Munkanaptár
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('trash')}>
                    Lomtár
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Keresés rendelések között..."
                value={dashboardSearchQuery}
                onChange={(e) => setDashboardSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Dashboard
              metrics={metrics}
              productionKPIs={productionKPIs}
              lowStockItems={lowStockItems}
              overdueOrders={overdueOrders}
              onFilterByStatus={handleFilterByStatus}
              onNavigateToInventory={() => setCurrentTab('inventory')}
              onShowOverdue={() => { setCurrentTab('orders'); setStatusFilter('all'); setHideDelivered(true) }}
            />

            {(orders || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Factory className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
                <h3 className="text-xl font-semibold mb-2">Nincs rendelés</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Kezdje el az új rendelés létrehozásával a termelés nyomon követéséhez
                </p>
                <Button onClick={handleNewOrder}>
                  <Plus className="w-5 h-5 mr-2" />
                  Első Rendelés Létrehozása
                </Button>
              </div>
            )}
          </TabsContent>

          <ProductionPanel
            isMobile={isMobile}
            orders={orders}
            products={products}
            productionShifts={productionShifts}
            productionDefects={productionDefects}
            machines={machinesApi.items || []}
            materialSlot={
              <MaterialPanel
                compact
                inventory={inventory || []}
                shifts={productionShifts || []}
                orders={orders || []}
                products={products || []}
                transactions={inventoryTransactions || []}
                onApply={handleMaterialAction}
              />
            }
            handleStatusChange={handleStatusChange}
            handleEditOrder={handleEditOrder}
            handleSaveShift={handleSaveShift}
            handleDeleteShift={handleDeleteShift}
            handleUpdateOrderNotes={handleUpdateOrderNotes}
            handleSaveDefect={handleSaveDefect}
            handleDeleteDefect={handleDeleteDefect}
          />

          <TabsContent value="planning">
            <ProductionPlanningView
              machines={machinesApi.items || []}
              orders={orders || []}
            />
          </TabsContent>

          <OrdersPanel
            filteredOrders={filteredOrders}
            orders={orders}
            customers={customers}
            products={products}
            materialEstimateKg={materialEstimateKg}
            labelTemplates={labelTemplates}
            savedDeliveryTemplates={savedTemplates}
            activeTemplates={activeTemplates}
            activeLabelTemplateId={activeLabelTemplateId}
            hideDelivered={hideDelivered}
            setHideDelivered={setHideDelivered}
            hideInvoiced={hideInvoiced}
            setHideInvoiced={setHideInvoiced}
            yearFilterEnabled={yearFilterEnabled}
            setYearFilterEnabled={setYearFilterEnabled}
            yearOptions={yearOptions}
            selectedYears={selectedYears}
            toggleYear={toggleYear}
            orderSearchQuery={orderSearchQuery}
            setOrderSearchQuery={setOrderSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            selectedOrderIds={selectedOrderIds}
            setSelectedOrderIds={setSelectedOrderIds}
            orderColumnFilters={orderColumnFilters}
            setOrderColumnFilters={setOrderColumnFilters}
            activeOrderFilterId={activeOrderFilterId}
            setActiveOrderFilterId={setActiveOrderFilterId}
            setOrderBulkImportDialogOpen={setOrderBulkImportDialogOpen}
            setNewOrderFilterDialogOpen={setNewOrderFilterDialogOpen}
            setLabelPrintSettingsDialogOpen={setLabelPrintSettingsDialogOpen}
            setCurrentTab={setCurrentTab}
            lastAction={lastAction}
            handleNewOrder={handleNewOrder}
            handleEditOrder={handleEditOrder}
            handleDeleteOrder={handleDeleteOrder}
            handleDuplicateOrder={handleDuplicateOrder}
            handleStatusChange={handleStatusChange}
            handleBatchStatusChange={handleBatchStatusChange}
            handleDeleteSelectedOrders={handleDeleteSelectedOrders}
            handleUndoLastAction={handleUndoLastAction}
            handleExportDelivery={handleExportDelivery}
            handleExportCmr={handleExportCmr}
          />

          <CustomersPanel
            filteredCustomers={filteredCustomers}
            orders={orders}
            customerSearchQuery={customerSearchQuery}
            setCustomerSearchQuery={setCustomerSearchQuery}
            setBulkImportDialogOpen={setBulkImportDialogOpen}
            handleNewCustomer={handleNewCustomer}
            handleEditCustomer={handleEditCustomer}
            handleDeleteCustomer={handleDeleteCustomer}
          />

          <ProductsPanel
            filteredProducts={filteredProducts}
            orders={orders}
            productSearchQuery={productSearchQuery}
            setProductSearchQuery={setProductSearchQuery}
            setProductBulkImportDialogOpen={setProductBulkImportDialogOpen}
            handleNewProduct={handleNewProduct}
            handleEditProduct={handleEditProduct}
            handleDeleteProduct={handleDeleteProduct}
            handleBulkDeleteProducts={handleBulkDeleteProducts}
            savedTemplates={savedTemplates?.map(t => ({ id: (t as any).id, name: (t as any).name || t.data?.name || '', data: { type: t.data?.type || '', active: t.data?.active } })) || []}
          />


          <MachinesPanel
            machines={machinesApi.items}
            orders={orders}
            auth={auth}
            onSave={handleSaveMachine}
            onDelete={handleDeleteMachine}
          />

          <UsersPanel
            users={users}
            usersLoading={usersLoading}
            auth={auth}
            onSave={handleSaveUser}
            onDelete={handleDeleteUser}
          />

          <MaterialsPanel
            materials={materialsApi.items}
            auth={auth}
            onSave={handleSaveMaterial}
            onDelete={handleDeleteMaterial}
          />

          <TabsContent value="github-editor" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Sablonszerkesztő betöltése…</div>}>
              <GithubStyleTemplateEditor />
            </Suspense>
          </TabsContent>

          <TabsContent value="template-saves" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Sablonkezelő betöltése…</div>}>
              <TemplateBackupRestore
                activeTemplates={activeTemplates}
                setActiveTemplates={setActiveTemplates}
              />
            </Suspense>
          </TabsContent>

          <DocumentsPanel
            documentFilters={documentFilters}
            setDocumentFilters={setDocumentFilters}
            activeFilterId={activeFilterId}
            setActiveFilterId={setActiveFilterId}
            setNewFilterDialogOpen={setNewFilterDialogOpen}
            deliveryNotes={deliveryNotes}
            orders={orders}
            customers={customers}
            products={products}
            auditLog={auditLog}
            handleDeleteDeliveryNote={handleDeleteDeliveryNote}
            handleUpdateDeliveryNote={handleUpdateDeliveryNote}
            handlePreviewNote={handlePreviewNote}
            handleDownloadPdf={handleDownloadPdf}
            onEditExtraItems={setExtraItemsNote}
            handleEmailNote={handleEmailNote}
            emailTemplate={emailTemplate}
            setEmailTemplate={setEmailTemplate}
          />

          <TabsContent value="saves" className="space-y-6">
            <BackupRestore />
          </TabsContent>

          <TabsContent value="trash" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Lomtár betöltése…</div>}>
              <TrashView />
            </Suspense>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Riportok betöltése…</div>}>
              <ReportsView
                orders={orders || []}
                shifts={productionShifts || []}
                defects={productionDefects || []}
                machines={machinesApi.items || []}
                products={products || []}
                inventory={inventory || []}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Karbantartás betöltése…</div>}>
              <MaintenanceView
                machines={machinesApi.items || []}
                maintenance={maintenanceApi.items || []}
                onSave={(m) => maintenanceApi.add(m)}
                onDelete={(id) => maintenanceApi.remove(id)}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="production-history" className="space-y-6">
            <ProductionHistoryView
              shifts={productionShifts || []}
              orders={orders || []}
              products={products || []}
              machines={machinesApi.items || []}
            />
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">Szállítólevelek</h2>
              <p className="text-muted-foreground">Létrehozott szállítólevelek és CMR dokumentumok</p>
            </div>

            <DeliveryNotesTable
              deliveryNotes={deliveryNotes || []}
              orders={orders || []}
              customers={customers || []}
              products={products || []}
              onDelete={handleDeleteDeliveryNote}
              onUpdate={handleUpdateDeliveryNote}
              onEditExtraItems={setExtraItemsNote}
            />
          </TabsContent>

          <LabelTemplatesPanel
            labelTemplates={labelTemplates}
            setLabelTemplates={setLabelTemplates}
            activeLabelTemplateId={activeLabelTemplateId}
            setActiveLabelTemplateId={setActiveLabelTemplateId}
            setSelectedLabelTemplate={setSelectedLabelTemplate}
            setLabelTemplateDialogOpen={setLabelTemplateDialogOpen}
            orders={orders}
            customers={customers}
            products={products}
            importInputRef={labelImportInputRef}
          />

          <InventoryPanel
            inventory={inventory}
            setInventory={setInventory}
            products={products}
            orders={orders}
            inventoryTransactions={inventoryTransactions}
            productionShifts={productionShifts}
            onMaterialAction={handleMaterialAction}
            lowStockItems={lowStockItems}
            inventorySearchQuery={inventorySearchQuery}
            setInventorySearchQuery={setInventorySearchQuery}
            setSelectedInventoryItem={setSelectedInventoryItem}
            setInventoryDialogOpen={setInventoryDialogOpen}
            setInventoryAdjustDialogOpen={setInventoryAdjustDialogOpen}
            setHistoryInventoryItem={setHistoryInventoryItem}
            setInventoryHistoryDialogOpen={setInventoryHistoryDialogOpen}
            setWarehouseAddPrefillProductId={setWarehouseAddPrefillProductId}
            setWarehouseAddDialogOpen={setWarehouseAddDialogOpen}
            appendAudit={appendAudit}
          />
        </Tabs>
      </div>

      <IssueDateDialog
        open={issueDateDialogOpen}
        type={issueDateDialogType}
        onConfirm={handleIssueDateConfirm}
        onClose={() => setIssueDateDialogOpen(false)}
      />

      <GlobalSearch
        open={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
        orders={orders || []}
        customers={customers || []}
        products={products || []}
        onOpenOrder={handleEditOrder}
        onOpenCustomer={(id) => { setCurrentTab('customers'); handleEditCustomer(id) }}
        onOpenProduct={(id) => { setCurrentTab('products'); handleEditProduct(id) }}
        onNavigate={setCurrentTab}
      />

      <WorkCalendarDialog
        open={workCalendarDialogOpen}
        onClose={() => setWorkCalendarDialogOpen(false)}
      />

      <ExtraItemsDialog
        note={extraItemsNote}
        inventory={inventory || []}
        onClose={() => setExtraItemsNote(null)}
        onSave={handleSaveExtraItems}
      />

      <AppDialogs
        inventoryDialogOpen={inventoryDialogOpen}
        setInventoryDialogOpen={setInventoryDialogOpen}
        selectedInventoryItem={selectedInventoryItem}
        setSelectedInventoryItem={setSelectedInventoryItem}
        inventory={inventory}
        setInventory={setInventory}
        products={products}
        appendAudit={appendAudit}
        inventoryAdjustDialogOpen={inventoryAdjustDialogOpen}
        setInventoryAdjustDialogOpen={setInventoryAdjustDialogOpen}
        inventoryTransactions={inventoryTransactions}
        setInventoryTransactions={setInventoryTransactions}
        inventoryDeductionDialogOpen={inventoryDeductionDialogOpen}
        setInventoryDeductionDialogOpen={setInventoryDeductionDialogOpen}
        pendingDeductionResult={pendingDeductionResult}
        setPendingDeductionResult={setPendingDeductionResult}
        pendingStatusChange={pendingStatusChange}
        setPendingStatusChange={setPendingStatusChange}
        setPendingPostDeduction={setPendingPostDeduction}
        deductionContext={deductionContext}
        setDeductionContext={setDeductionContext}
        handleConfirmInventoryDeduction={handleConfirmInventoryDeduction}
        inventoryHistoryDialogOpen={inventoryHistoryDialogOpen}
        setInventoryHistoryDialogOpen={setInventoryHistoryDialogOpen}
        historyInventoryItem={historyInventoryItem}
        setHistoryInventoryItem={setHistoryInventoryItem}
        orders={orders}
        warehouseAddDialogOpen={warehouseAddDialogOpen}
        setWarehouseAddDialogOpen={setWarehouseAddDialogOpen}
        warehouseAddPrefillProductId={warehouseAddPrefillProductId}
        setWarehouseAddPrefillProductId={setWarehouseAddPrefillProductId}
        orderDialogOpen={orderDialogOpen}
        setOrderDialogOpen={setOrderDialogOpen}
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        handleSaveOrder={handleSaveOrder}
        customers={customers}
        orderBulkImportDialogOpen={orderBulkImportDialogOpen}
        setOrderBulkImportDialogOpen={setOrderBulkImportDialogOpen}
        handleOrderBulkImport={handleOrderBulkImport}
        validationDialogOpen={validationDialogOpen}
        setValidationDialogOpen={setValidationDialogOpen}
        validationResult={validationResult}
        setValidationResult={setValidationResult}
        pendingExportType={pendingExportType}
        setPendingExportType={setPendingExportType}
        handleValidationContinue={handleValidationContinue}
        selectedOrderIds={selectedOrderIds}
        handleEditOrder={handleEditOrder}
        cmrSettingsDialogOpen={cmrSettingsDialogOpen}
        setCmrSettingsDialogOpen={setCmrSettingsDialogOpen}
        deliverySettingsDialogOpen={deliverySettingsDialogOpen}
        setDeliverySettingsDialogOpen={setDeliverySettingsDialogOpen}
        customerDialogOpen={customerDialogOpen}
        setCustomerDialogOpen={setCustomerDialogOpen}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        handleSaveCustomer={handleSaveCustomer}
        savedTemplates={savedTemplates}
        labelTemplates={labelTemplates}
        bulkImportDialogOpen={bulkImportDialogOpen}
        setBulkImportDialogOpen={setBulkImportDialogOpen}
        handleBulkImport={handleBulkImport}
        productDialogOpen={productDialogOpen}
        setProductDialogOpen={setProductDialogOpen}
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        handleSaveProduct={handleSaveProduct}
        materials={materialsApi.items}
        productBulkImportDialogOpen={productBulkImportDialogOpen}
        setProductBulkImportDialogOpen={setProductBulkImportDialogOpen}
        handleProductBulkImport={handleProductBulkImport}
        newFilterDialogOpen={newFilterDialogOpen}
        setNewFilterDialogOpen={setNewFilterDialogOpen}
        setDocumentFilters={setDocumentFilters}
        newOrderFilterDialogOpen={newOrderFilterDialogOpen}
        setNewOrderFilterDialogOpen={setNewOrderFilterDialogOpen}
        setOrderColumnFilters={setOrderColumnFilters}
        setActiveOrderFilterId={setActiveOrderFilterId}
        labelTemplateDialogOpen={labelTemplateDialogOpen}
        setLabelTemplateDialogOpen={setLabelTemplateDialogOpen}
        selectedLabelTemplate={selectedLabelTemplate}
        setSelectedLabelTemplate={setSelectedLabelTemplate}
        labelTemplatesApiAdd={labelTemplatesApi.add}
        labelTemplatesApiReplace={labelTemplatesApi.replace}
        activeLabelTemplateId={activeLabelTemplateId}
        labelPrintSettingsDialogOpen={labelPrintSettingsDialogOpen}
        setLabelPrintSettingsDialogOpen={setLabelPrintSettingsDialogOpen}
      />
    </div>
  )
}

export default App
