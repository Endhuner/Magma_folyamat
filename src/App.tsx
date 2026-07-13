import { generateId } from '@/lib/generateId'
import { generateAndSavePdf } from '@/lib/pdfService'
import { useState, useMemo, useEffect, useRef, Suspense, useCallback, lazy } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { defaultPathFor, pathForTab } from '@/lib/navigation'
import { useKV } from '@/hooks/useKV'
import { useEntityKV } from '@/hooks/useEntityKV'
import { auditLogRepo } from '@/lib/db/repos'
import { useServerCrud } from '@/lib/providers/useServerCrud'
import { useAppSetting } from '@/hooks/useAppSetting'
import { useCustomerSequences } from '@/hooks/useCustomerSequences'
import { useMigrations } from '@/hooks/useMigrations'
import { useDefaultTemplates } from '@/hooks/useDefaultTemplates'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AppShellContext } from '@/components/layout/AppShellContext'
import type { AppShellValue } from '@/components/layout/shellTypes'
import { RequireRole } from '@/components/layout/RequireRole'
import AttekintesPage from '@/pages/AttekintesPage'
import AjanlatokPage from '@/pages/arajanlat/AjanlatokPage'
import KalkulatorPage from '@/pages/arajanlat/KalkulatorPage'
import AnyagarakPage from '@/pages/arajanlat/AnyagarakPage'
import AktualisArakPage from '@/pages/AktualisArakPage'
import GyartasPage from '@/pages/gyartas/GyartasPage'
import TervezesPage from '@/pages/gyartas/TervezesPage'
import ElozmenyekPage from '@/pages/gyartas/ElozmenyekPage'
import GepekPage from '@/pages/gyartas/GepekPage'
import KarbantartasPage from '@/pages/gyartas/KarbantartasPage'
import KioszkPage from '@/pages/jelenlet/KioszkPage'
import HaviIvPage from '@/pages/jelenlet/HaviIvPage'
import SzabadsagokPage from '@/pages/jelenlet/SzabadsagokPage'
import RendelesekPage from '@/pages/rendelesek/RendelesekPage'
import VevokPage from '@/pages/rendelesek/VevokPage'
import TermekekPage from '@/pages/rendelesek/TermekekPage'
import AdatlapPage from '@/pages/rendelesek/AdatlapPage'
import KeszletPage from '@/pages/keszlet/KeszletPage'
import AnyaglistaPage from '@/pages/keszlet/AnyaglistaPage'
import SzallitasPage from '@/pages/SzallitasPage'
import SzallitolevelPage from '@/pages/dokumentumok/SzallitolevelPage'
import EtikettPage from '@/pages/dokumentumok/EtikettPage'
import MentettPage from '@/pages/dokumentumok/MentettPage'
import UrlapokPage from '@/pages/dokumentumok/UrlapokPage'
import FelhasznalokPage from '@/pages/beallitasok/FelhasznalokPage'
import SablonokPage from '@/pages/beallitasok/SablonokPage'
import MunkanaptarPage from '@/pages/beallitasok/MunkanaptarPage'
import RiportokPage from '@/pages/beallitasok/RiportokPage'
import LomtarPage from '@/pages/beallitasok/LomtarPage'
// Code-split heavy editors — lásd `src/components/lazy.ts`.
import { useIsTouchLayout } from '@/hooks/useMediaQuery'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { OfflineBanner } from '@/components/OfflineBanner'
import { AttendanceEntry, LeaveRequest, Order, OrderStatus, FilledForm, PriceList, ProductDatasheet, Quote, Customer, Product, DeliveryNote, DeliveryRecipient, ExtraDeliveryItem, InventoryItem, InventoryTransaction, ProductionShift, ProductionLog, ProductionDefect, Machine, MachineMaintenance, AppMessage, User, Material, AuditLogEntry, AuditEntityType, AuditAction, AuditFieldChange } from '@/lib/types'
import { diffObjects, buildAuditEntry, pruneAuditLog, AUDIT_LOG_MAX_ENTRIES } from '@/lib/auditLog'
import { calculateDashboardMetrics, calculateProductionKPIs, parseYear, stripDiacritics, isDelivered, isInvoiced, isOverdue, generateDeliveryNoteSequenceNumber, parseFloatSafe } from '@/lib/helpers'
import { producedForOrder, autoStatusForShift, ordersToAutoPause, nextSameProductOrder, splitOverProduction } from '@/lib/productionAutomation'
import { DEFAULT_WORK_CALENDAR, type WorkCalendarSettings } from '@/lib/workCalendar'
import {
  computeAutoFieldsForOrder,
  computeBoxesCount,
  computePalletsCount,
  computeRequiredMaterialKg,
  computeGrossWeightKg,
  computePlannedProductionHours,
} from '@/lib/orderService'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { useAuth } from '@/lib/auth'
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/api/usersApi'
import type { UserRole } from '@produktivpro/shared'
import { GlobalSearch } from '@/components/GlobalSearch'
import { unreadMessagesFor } from '@/components/MessageCenter'
import { ExtraItemsDialog } from '@/components/ExtraItemsDialog'
import { CreateDeliveryNoteDialog } from '@/components/CreateDeliveryNoteDialog'
import {
  computeMaterialStatuses,
  totalEstimatedMaterialKg,
  MATERIAL_BOOKED_THROUGH_KEY,
  type MaterialActionKind,
  type MaterialBookedThroughMap,
} from '@/lib/materialService'
import { ACTIVE_WORK_STATUSES } from '@/lib/constants/orderStatus'
import { toast } from 'sonner'
import { exportCmrAsHtml, generateCmrHtmlTemplate, getCmrHtml } from '@/lib/cmrHtmlTemplate'
import { exportDeliveryAsHtml, generateDeliveryHtmlTemplate, getDeliveryHtml, TemplateStyles } from '@/lib/deliveryHtmlTemplate'
import { validateCmrExport, validateDeliveryExport, ValidationResult } from '@/lib/exportValidation'
import { LabelTemplate } from '@/lib/labelTemplate'
import { deductInventoryForOrders, commitInventoryDeduction, restoreInventoryForOrders, commitInventoryRestore, InventoryDeductionResult } from '@/lib/inventoryService'
import { AppDialogs } from '@/components/AppDialogs'
import { IssueDateDialog } from '@/components/IssueDateDialog'

type LastAction =
  | { type: 'delete', orders: Order[] }
  | { type: 'edit', orderId: string, before: Order }
  | null

/** A menü ki/be állapota: a sidebar_state cookie-ból (a SidebarProvider írja),
 *  első látogatáskor tableten (≤1024px) csukva, desktopon nyitva. */
function sidebarDefaultOpen(): boolean {
  const m = document.cookie.match(/(?:^|; )sidebar_state=(true|false)/)
  if (m) return m[1] === 'true'
  return window.matchMedia('(min-width: 1025px)').matches
}

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

  const quotesApi = useServerCrud<Quote>('quotes', ['quote'])
  const priceListsApi = useServerCrud<PriceList>('price-lists', ['priceList'])
  const attendanceApi = useServerCrud<AttendanceEntry>('attendance-entries', ['attendance'])
  const leavesApi = useServerCrud<LeaveRequest>('leave-requests', ['leave'])
  const datasheetsApi = useServerCrud<ProductDatasheet>('product-datasheets', ['datasheet'])
  const filledFormsApi = useServerCrud<FilledForm>('filled-forms', ['filledForm'])
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

  // Olvasatlan üzenetek száma — a fejléc márkaneve villog tőle (1-es variáció).
  // FONTOS: az auth deklarációja UTÁN kell állnia (TDZ).
  const unreadMessageCount = useMemo(
    () => unreadMessagesFor(messagesApi.items, auth.user?.id ?? '').length,
    [messagesApi.items, auth.user?.id]
  )
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
  
  const navigate = useNavigate()
  const roleForNav = auth.status === 'bypass' ? null : (auth.user?.role ?? null)
  // A régi fül-azonosítós hívók (fejléc-csempék, GlobalSearch, OrdersPanel)
  // navigációs adaptere. Az útvonal-őrzés a RequireRole route-elemeké.
  const setCurrentTab = useCallback(
    (tab: string) => navigate(pathForTab(tab)),
    [navigate],
  )

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)

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
  // Egyéni (rendelés nélküli) szállítólevél — a dátumválasztó megerősítéséig tárolt adat.
  const [pendingCustomNote, setPendingCustomNote] = useState<{ recipient: DeliveryRecipient; items: ExtraDeliveryItem[] } | null>(null)
  
  const [workCalendar] = useAppSetting<WorkCalendarSettings>('work-calendar', DEFAULT_WORK_CALENDAR)
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
  const handleSetOrderLabelFlag = (
    orderId: string,
    field: 'labelDoneAt' | 'palletLabelDoneAt',
    done: boolean,
  ) => {
    const value = done ? new Date().toISOString().slice(0, 10) : ''
    setOrders((current) =>
      (current || []).map((o) =>
        o.id === orderId ? { ...o, [field]: value, updatedAt: new Date().toISOString() } : o
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

  const handleSaveShift = (inputShift: ProductionShift) => {
    const allShifts = productionShifts || []
    const existing = allShifts.find((s) => s.id === inputShift.id)
    const order = (orders || []).find((o) => o.id === inputShift.orderId)
    const product = findProductForOrder(order)
    const nest = Math.max(1, parseFloatSafe(product?.nestCount, 1, { allowNegative: false }) || 1)

    // Túltermelés szétosztása: ha egy ÚJ műszak túltölti a rendelést és van
    // következő azonos termékű rendelés, a felesleg oda kerül (folytonos számláló).
    const producedBefore = producedForOrder(inputShift.orderId, allShifts.filter((s) => s.id !== inputShift.id))
    const next = order && !existing ? nextSameProductOrder(order, orders || []) : null
    const split = order
      ? splitOverProduction({
          shift: inputShift, order, producedBefore, nest, nextOrder: next,
          newId: generateId(), nowISO: new Date().toISOString(),
        })
      : null

    const shift = split ? split.cappedShift : inputShift
    const qtyDelta = shift.producedQuantity - (existing?.producedQuantity ?? 0)

    if (existing) { shiftsApi.replace(shift) } else { shiftsApi.add(shift) }

    // Automatikus készletfrissítés: mindig frissítünk, ha van rendelés és mennyiség változott.
    // Az autoUpdateInventory DB-mezőre nem támaszkodunk — annak default értéke false volt,
    // ami megakadályozta a készletfrissítést minden meglévő terméknél.
    if (order && qtyDelta !== 0) {
      applyProductionShiftToInventory(shift, order, product, qtyDelta)
    }

    // Átvezetett (rollover) műszak a következő azonos termékű rendelésre.
    if (split && next) {
      shiftsApi.add(split.rolloverShift)
      applyProductionShiftToInventory(split.rolloverShift, next, findProductForOrder(next), split.rolloverShift.producedQuantity)
      toast.info(`Felesleg átvezetve: ${split.rolloverShift.producedQuantity} db → ${next.ownOrderNumber || next.orderNumber || next.productName}`)
    }

    // Automatikus státusz: vég lövésszám → Folyamatban; kért mennyiség elérve → Elkészült.
    if (order) {
      const totalA = producedBefore + shift.producedQuantity
      const statusA = autoStatusForShift(order, totalA)
      if (statusA) handleStatusChange(order.id, statusA)
    }
    if (split && next) {
      const totalB = producedForOrder(next.id, allShifts) + split.rolloverShift.producedQuantity
      const statusB = autoStatusForShift(next, totalB)
      if (statusB) handleStatusChange(next.id, statusB)
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

  // Automatikus Szünetel: ha egy „Folyamatban" rendelésnél 2+ teljes munkanapja
  // nincs műszakbeírás, átállítjuk. Betöltéskor és az adatok változásakor fut.
  useEffect(() => {
    if (!orders?.length || !productionShifts) return
    const today = new Date().toISOString().slice(0, 10)
    const toPause = ordersToAutoPause(orders, productionShifts, today, workCalendar)
    if (toPause.length > 0) handleBatchStatusChange(toPause, 'Szünetel')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, productionShifts, workCalendar])

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

      // ── Cégnév átgyűrűztetése ──
      // A rendelés / termék / készlet NÉV szerint kapcsolódik a vevőhöz, ezért
      // átnevezéskor el kell vinni az új nevet minden hivatkozó rekordra,
      // különben elszakad a kapcsolat (a rendelés "árván" marad a régi néven).
      const oldName = before?.name?.trim()
      const newName = customerData.name?.trim()
      if (oldName && newName && oldName !== newName) {
        const now = new Date().toISOString()
        let touched = 0
        setOrders((current) =>
          (current || []).map((o) => {
            if (o.customer?.trim() !== oldName) return o
            touched++
            return { ...o, customer: newName, updatedAt: now }
          })
        )
        setProducts((current) =>
          (current || []).map((p) => (p.customer?.trim() === oldName ? { ...p, customer: newName } : p))
        )
        setInventory((current) =>
          (current || []).map((i) => (i.customer?.trim() === oldName ? { ...i, customer: newName, lastUpdated: now } : i))
        )
        if (touched > 0) {
          toast.info(`A névváltozás átvezetve ${touched} rendelésre (+ termékek, készlet)`)
        }
      }

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

      // ── Termékadat átgyűrűztetése a kötött rendelésekre / készletre ──
      // A rendelés a termékből átmásolt mezőkkel dolgozik (a gyártás az élő
      // findProductForOrder-t használja, de a rendelés-táblában eltárolt
      // másolat különben elavulna). Csak a VALÓBAN megváltozott mezőket
      // visszük át, hogy a rendelésen kézzel felülírt értékeket ne töröljük.
      //   order.productName ← product.drawingNumber (rajzszám)
      //   order.designation ← product.productName   (terméknév)
      //   order.material    ← product.material
      if (before && after) {
        // 1) Azonos-mezős átmásolás (csak a változott mezőket)
        const orderPatch: Partial<Order> = {}
        if (before.drawingNumber !== after.drawingNumber) orderPatch.productName = after.drawingNumber || ''
        if (before.productName !== after.productName) orderPatch.designation = after.productName || ''
        if (before.material !== after.material) orderPatch.material = after.material || ''

        // 2) SZÁMÍTOTT mezők: ha a doboz/raklap/súly/idő forrás-mezők
        //    változtak a terméken, a rendelés kiszámolt értékeit (doboz,
        //    raklap, anyagigény, bruttó súly, gyártási idő) újra kell számolni
        //    a rendelt darabszámmal. Ez az, ami eddig hiányzott.
        const calcChanged =
          before.piecesPerBox !== after.piecesPerBox ||
          before.boxesPerPallet !== after.boxesPerPallet ||
          before.weightPerPiece !== after.weightPerPiece ||
          before.cycleTime !== after.cycleTime ||
          before.nestCount !== after.nestCount ||
          before.surfaceTreatment !== after.surfaceTreatment

        if (Object.keys(orderPatch).length > 0 || calcChanged) {
          const now = new Date().toISOString()
          let touched = 0
          setOrders((current) =>
            (current || []).map((o) => {
              if (o.productId !== selectedProduct.id) return o
              touched++
              const updated: Order = { ...o, ...orderPatch, updatedAt: now }
              if (calcChanged) {
                const amount = o.amountPc || 0
                const boxes = computeBoxesCount(amount, after.piecesPerBox)
                const pallets = computePalletsCount(boxes, after.boxesPerPallet)
                updated.boxesCount = boxes
                updated.palletsCount = pallets
                updated.requiredMaterialKg = computeRequiredMaterialKg(amount, after.weightPerPiece)
                updated.grossWeightKg = computeGrossWeightKg(amount, after.weightPerPiece, pallets)
                updated.plannedProductionHours = computePlannedProductionHours(amount, undefined, after.cycleTime, after.nestCount)
                updated.surfaceTreatment = after.surfaceTreatment || ''
              }
              return updated
            })
          )
          // Készlet: a termékhez kötött tételek neve/rajzszáma is kövesse
          if (before.productName !== after.productName || before.drawingNumber !== after.drawingNumber) {
            setInventory((current) =>
              (current || []).map((i) =>
                i.productId === selectedProduct.id
                  ? { ...i, productName: after.productName || '', drawingNumber: after.drawingNumber || '', lastUpdated: now }
                  : i
              )
            )
          }
          if (touched > 0) {
            toast.info(`A termékmódosítás átvezetve ${touched} rendelésre`)
          }
        }
      }

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
  const handleSaveQuote = (q: Partial<Quote> & { id: string }) => {
    const before = quotesApi.items.find((x) => x.id === q.id)
    const record = {
      ...(before ?? { createdAt: new Date().toISOString(), items: [] }),
      ...q,
      updatedAt: new Date().toISOString(),
    } as Quote
    if (before) {
      quotesApi.replace(record)
      const changes = diffObjects(
        before as unknown as Record<string, unknown>,
        record as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('quote', 'Árajánlat', record.id, record.number || record.id, 'update', { changes })
      }
    } else {
      quotesApi.add(record)
      appendAudit('quote', 'Árajánlat', record.id, record.number || record.id, 'create', { notes: record.customerName })
    }
  }
  const handleDeleteQuote = (id: string) => {
    const existing = quotesApi.items.find((x) => x.id === id)
    quotesApi.remove(id)
    if (existing) {
      appendAudit('quote', 'Árajánlat', id, existing.number || id, 'delete')
    }
  }
  const handleSavePriceList = (pl: Partial<PriceList> & { id: string }) => {
    const before = priceListsApi.items.find((x) => x.id === pl.id)
    const record = {
      ...(before ?? {
        createdAt: new Date().toISOString(),
        burnRate: 0.06, mpbEurPerKg: 0, currentMpEurPerKg: 0,
        mpHistory: [], items: [],
      }),
      ...pl,
      updatedAt: new Date().toISOString(),
    } as PriceList
    if (before) {
      priceListsApi.replace(record)
      const changes = diffObjects(
        before as unknown as Record<string, unknown>,
        record as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('priceList', 'Árlista', record.id, record.customerName || record.id, 'update', { changes })
      }
    } else {
      priceListsApi.add(record)
      appendAudit('priceList', 'Árlista', record.id, record.customerName || record.id, 'create')
    }
  }
  const handleDeletePriceList = (id: string) => {
    const existing = priceListsApi.items.find((x) => x.id === id)
    priceListsApi.remove(id)
    if (existing) {
      appendAudit('priceList', 'Árlista', id, existing.customerName || id, 'delete')
    }
  }
  const handleSaveAttendance = (a: Partial<AttendanceEntry> & { id: string }) => {
    const before = attendanceApi.items.find((x) => x.id === a.id)
    const record = {
      ...(before ?? { inTime: '', outTime: '', createdAt: new Date().toISOString() }),
      ...a,
      updatedAt: new Date().toISOString(),
    } as AttendanceEntry
    if (before) attendanceApi.replace(record)
    else attendanceApi.add(record)
  }
  const handleDeleteAttendance = (id: string) => {
    attendanceApi.remove(id)
  }
  const handleSaveLeave = (l: Partial<LeaveRequest> & { id: string }) => {
    const before = leavesApi.items.find((x) => x.id === l.id)
    const record = {
      ...(before ?? {
        status: 'pending' as const,
        requestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
      ...l,
      updatedAt: new Date().toISOString(),
    } as LeaveRequest
    if (before) {
      leavesApi.replace(record)
      appendAudit('leave', 'Szabadság', record.id, `${record.fromDate}–${record.toDate}`, 'update')
    } else {
      leavesApi.add(record)
      appendAudit('leave', 'Szabadság', record.id, `${record.fromDate}–${record.toDate}`, 'create')
    }
  }
  const handleDeleteLeave = (id: string) => {
    leavesApi.remove(id)
  }
  const handleSaveDatasheet = (d: Partial<ProductDatasheet> & { id: string }) => {
    const before = datasheetsApi.items.find((x) => x.id === d.id)
    const record = {
      ...(before ?? {
        machineSettings: [], castingChecks: [], postOperations: [],
        createdAt: new Date().toISOString(),
      }),
      ...d,
      updatedAt: new Date().toISOString(),
    } as ProductDatasheet
    if (before) {
      datasheetsApi.replace(record)
      appendAudit('datasheet', 'Termék adatlap', record.id, record.docId || record.productId, 'update')
    } else {
      datasheetsApi.add(record)
      appendAudit('datasheet', 'Termék adatlap', record.id, record.docId || record.productId, 'create')
    }
  }
  const handleSaveFilledForm = (f: Partial<FilledForm> & { id: string }) => {
    const before = filledFormsApi.items.find((x) => x.id === f.id)
    const record = {
      ...(before ?? { data: {}, createdAt: new Date().toISOString() }),
      ...f,
      updatedAt: new Date().toISOString(),
    } as FilledForm
    if (before) {
      filledFormsApi.replace(record)
      appendAudit('filledForm', 'Kitöltött űrlap', record.id, record.title, 'update')
    } else {
      filledFormsApi.add(record)
      appendAudit('filledForm', 'Kitöltött űrlap', record.id, record.title, 'create')
    }
  }
  const handleDeleteFilledForm = (id: string) => {
    const existing = filledFormsApi.items.find((x) => x.id === id)
    filledFormsApi.remove(id)
    if (existing) appendAudit('filledForm', 'Kitöltött űrlap', id, existing.title, 'delete')
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
    // A Felhasználók-táblában az 'alap' sentinel az üres (alap) skint jelöli.
    const skin = u.skin === 'alap' ? '' : (u.skin ?? '')
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
          skin,
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
          skin,
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

  // Szállítólevél/CMR készítése a Dokumentumok fülről — a kiválasztott
  // rendeléseket a meglévő kiállítás-láncba adja (dátum → validáció → export).
  const [createNoteDialogOpen, setCreateNoteDialogOpen] = useState(false)
  const handleCreateNoteFromDocuments = (type: 'delivery' | 'cmr', orderIds: string[]) => {
    setPendingCustomNote(null)   // rendelés-alapú folyamat — nincs egyéni címzett
    setSelectedOrderIds(orderIds)
    setIssueDateDialogType(type)
    setIssueDateDialogOpen(true)
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
    } else if (note.recipient || note.orderIds.length === 0) {
      // Egyéni szállítólevél — rendelés nélkül; a rendelés-alapú exportDeliveryAsHtml
      // üres listára megállna, ezért közvetlenül a HTML-t rendereljük.
      const html = getDeliveryHtml(
        [], customers || [], products || [], deliveryNotes || [],
        undefined, note.sequenceNumber, savedTemplates, activeTemplates,
        note.issueDate, note.extraItems, note.recipient,
      )
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close(); win.focus() }
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
        savedTemplates, activeTemplates, note.issueDate, note.extraItems, note.recipient
      )
    }

    const type = note.type === 'cmr' ? 'CMR' : 'Szallitolevel'
    const filename = `${type}_${note.sequenceNumber}_${note.customer.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    // 1) Frissen generált PDF (a szerver a /pdf-output mappába is menti)
    const ok = await generateAndSavePdf(html, filename, true)
    if (ok) {
      toast.success(`PDF letöltve: ${filename}`)
      return
    }

    // 2) Tartalék: ha az újragenerálás nem ment, a KORÁBBAN mentett fájlt
    //    töltjük le ugyanarról a helyről (PDF_OUTPUT_DIR).
    try {
      const res = await fetch(`/api/v1/pdf-file/${encodeURIComponent(filename)}`, { credentials: 'include' })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`PDF letöltve a mentett fájlból: ${filename}`)
      } else {
        toast.error('A PDF újragenerálása nem sikerült, és mentett fájl sincs a szerver PDF-mappájában.')
      }
    } catch {
      toast.error('A PDF letöltése nem sikerült.')
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

  /**
   * Egyéni szállítólevél indítása a Dokumentumok fülről — bárkinek, bármilyen
   * (rendszerben nem lévő) tétellel. Csak a kiállítási dátumot kérjük be, utána
   * executeCustomDeliveryExport fut.
   */
  const handleCreateCustomDeliveryNote = (recipient: DeliveryRecipient, items: ExtraDeliveryItem[]) => {
    setPendingCustomNote({ recipient, items })
    setIssueDateDialogType('delivery')
    setIssueDateDialogOpen(true)
  }

  /** Egyéni szállítólevél kiállítása: render (rendelés nélkül) + nyomtatás + mentés. */
  const executeCustomDeliveryExport = async (issueDate: string) => {
    const pending = pendingCustomNote
    if (!pending) return
    const { recipient, items } = pending
    const seq = generateDeliveryNoteSequenceNumber(deliveryNotes || [], 'delivery')
    const now = new Date().toISOString()
    const fileName = `Szallitolevel_${seq}_${recipient.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    const html = getDeliveryHtml(
      [], customers || [], products || [], deliveryNotes || [],
      deliveryStyles, seq, savedTemplates, activeTemplates, issueDate, items, recipient,
    )
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 400)
    }

    // A tételeket exportData-ba is elmentjük, hogy a lista/előnézet is mutassa.
    const exportData = items.map((it) => ({
      'Termék név': it.name,
      'Mennyiség': it.quantity,
      'Egység': it.unit,
      'Megjegyzés': it.notes ?? '',
    }))

    deliveryNotesApi.add({
      id: generateId(),
      type: 'delivery',
      sequenceNumber: seq,
      customer: recipient.name,
      orderIds: [],
      fileName,
      exportDate: now,
      issueDate,
      exportData,
      extraItems: items,
      recipient,
      createdAt: now,
      updatedAt: now,
    } as DeliveryNote)

    toast.success(`Egyéni szállítólevél elkészült: ${seq}`)
    setPendingCustomNote(null)
  }

  const handleExportDelivery = async (idsOverride?: string[]) => {
    const ids = idsOverride ?? selectedOrderIds
    if (ids.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }
    setPendingCustomNote(null)   // rendelés-alapú folyamat
    // Az Etikett oldal egy rendelést ad át közvetlenül; itt állítjuk be a
    // kiválasztást, hogy a dátum-megerősítés (handleIssueDateConfirm) is lássa.
    if (idsOverride) setSelectedOrderIds(idsOverride)
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

    // Egyéni szállítólevél: nincs rendelés → nincs validáció/készletlevonás.
    if (pendingCustomNote) {
      await executeCustomDeliveryExport(issueDate)
      return
    }

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

  const handleExportCmr = async (idsOverride?: string[]) => {
    const ids = idsOverride ?? selectedOrderIds
    if (ids.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }
    setPendingCustomNote(null)   // rendelés-alapú folyamat
    if (idsOverride) setSelectedOrderIds(idsOverride)
    setIssueDateDialogType('cmr')
    setIssueDateDialogOpen(true)
  }
  
  /**
   * PDF generálás + szerver-oldali mentés (a /pdf-output mappába). Ha `download`,
   * a böngészőbe is letölti. Visszaadja, sikerült-e.
   */

  /**
   * A CMR-hez automatikusan létrehozza a szállítólevél REKORDOT is (saját
   * sorszámmal) + PDF-et ment a szerverre. NEM állítja az order mezőket —
   * azt a hívó teszi (a cmr + deliveryNote EGY setOrders-ben, hogy ne
   * versenyezzenek). Visszaadja a szállítólevél sorszámát.
   */
  const autoCreateDeliveryNoteRecord = async (selectedOrders: Order[], issueDate: string): Promise<string> => {
    const seq = generateDeliveryNoteSequenceNumber(deliveryNotes || [], 'delivery')
    const firstCustomer = selectedOrders[0]?.customer || 'export'
    const fileName = `Szallitolevel_${seq}_${firstCustomer.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    const now = new Date().toISOString()

    deliveryNotesApi.add({
      id: generateId(),
      type: 'delivery',
      sequenceNumber: seq,
      customer: firstCustomer,
      orderIds: selectedOrders.map(o => o.id),
      fileName,
      exportDate: now,
      issueDate,
      createdAt: now,
      updatedAt: now,
    } as DeliveryNote)

    const html = getDeliveryHtml(
      selectedOrders, customers || [], products || [], deliveryNotes || [],
      undefined, seq, savedTemplates, activeTemplates, issueDate
    )
    const ok = await generateAndSavePdf(html, fileName, false)
    toast.success(ok ? `Szállítólevél is elkészült: ${seq}` : `Szállítólevél létrehozva (${seq}) — PDF mentése kihagyva`)
    return seq
  }

  const executeCmrExport = async (issueDate?: string) => {
    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    const orderIds = selectedOrders.map(o => o.id)
    const iso = issueDate ?? new Date().toISOString().slice(0, 10)

    // 1) Automatikus szállítólevél-rekord + PDF (a sorszám előre kell a közös
    //    order-frissítéshez)
    const deliveryNoteSeq = await autoCreateDeliveryNoteRecord(selectedOrders, iso)

    // 2) CMR generálás (nyomtatás-ablak + rekord). Az order-mezőket NEM itt
    //    állítjuk — lásd lent az EGYETLEN setOrders-t (különben a több
    //    párhuzamos PATCH last-write-wins alapon felülírná egymást).
    let cmrSeq = ''
    await exportCmrAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const now = new Date().toISOString()
        deliveryNotesApi.add({
          ...deliveryNote,
          id: generateId(),
          sequenceNumber: sequenceNumber || '',
          createdAt: now,
          updatedAt: now,
        } as DeliveryNote)
        cmrSeq = sequenceNumber || ''
      },
      cmrSettings,
      savedTemplates,
      activeTemplates,
      issueDate ?? undefined
    )

    // Az order-mezők commit-ja: cmr + deliveryNote + status EGY setOrders-ben,
    // + audit a státuszváltásról. A készletlevonás UTÁN fut (a dialógus
    // megerősítésekor vagy csendes levonásnál közvetlenül), így pontosan egy
    // PATCH megy az egyes rendelésekre — nincs versenyhelyzet.
    const commitOrderFields = () => {
      const now = new Date().toISOString()
      selectedOrders.forEach((o) => {
        if (o.status !== 'Kiszállítva') {
          appendAudit('order', 'Rendelés', o.id, o.orderNumber || o.productName || o.id, 'status', {
            changes: [{ field: 'status', label: 'Státusz', before: o.status, after: 'Kiszállítva' }],
            notes: `${o.customer} · ${o.productName}${cmrSeq ? ` · CMR ${cmrSeq}` : ''}`,
          })
        }
      })
      setOrders((current) =>
        (current || []).map(o =>
          orderIds.includes(o.id)
            ? { ...o, cmr: cmrSeq || o.cmr, deliveryNote: deliveryNoteSeq, status: 'Kiszállítva' as OrderStatus, updatedAt: now }
            : o
        )
      )
    }

    // 3) Készletlevonás a szállítólevéllel AZONOS módon: teljes fedezetnél
    //    csendben levonunk, hiánynál megerősítő dialógus (a
    //    hasExistingShipmentDeduction őrzi, hogy ne vonjon le kétszer).
    if (orderIds.length > 0) {
      const ordersForDeduction = selectedOrders.filter(
        (o) => !hasExistingShipmentDeduction(o.id) && !isDelivered(o.status)
      )
      if (ordersForDeduction.length > 0) {
        const deductionResult = deductInventoryForOrders(ordersForDeduction, inventory || [], products || [])
        const needsConfirmation =
          deductionResult.failedItems.length > 0 ||
          deductionResult.deductedItems.some((d) => d.shortage > 0)
        if (needsConfirmation) {
          setPendingDeductionResult(deductionResult)
          setDeductionContext('CMR + szállítólevél')
          setPendingStatusChange(null)
          // A levonás megerősítése UTÁN egyetlen setOrders-ben commitoljuk a mezőket.
          setPendingPostDeduction(() => commitOrderFields)
          setInventoryDeductionDialogOpen(true)
          return // a dialógus megerősítése végzi a levonást + a commit-ot
        }
        if (deductionResult.deductedItems.length > 0) {
          commitInventoryDeduction(deductionResult, setInventory, setInventoryTransactions)
        }
      }
      commitOrderFields()
    }
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

  // Az oldalak (src/pages) adat- és handler-felülete — T5–T9 alatt bővül,
  // ahogy a lapok kiköltöznek a lenti legacy Tabs-blokkból.
  const shell: AppShellValue = {
    orders: orders || [],
    metrics,
    productionKPIs,
    lowStockItems,
    overdueOrders,
    products: products || [],
    productionShifts: productionShifts || [],
    productionDefects: productionDefects || [],
    machines: machinesApi.items || [],
    maintenance: maintenanceApi.items || [],
    inventory: inventory || [],
    inventoryTransactions: inventoryTransactions || [],
    isMobile,
    auth,
    dashboardSearchQuery,
    setDashboardSearchQuery,
    setStatusFilter,
    setHideDelivered,
    handleFilterByStatus,
    handleNewOrder,
    handleStatusChange,
    handleEditOrder,
    handleSaveShift,
    handleDeleteShift,
    handleUpdateOrderNotes,
    handleSaveDefect,
    handleDeleteDefect,
    handleMaterialAction,
    handleSaveMachine,
    handleDeleteMachine,
    customers: customers || [],
    filteredOrders,
    filteredCustomers,
    filteredProducts,
    materialEstimateKg,
    labelTemplates,
    savedDeliveryTemplates: savedTemplates,
    activeTemplates,
    activeLabelTemplateId,
    hideDelivered,
    hideInvoiced,
    setHideInvoiced,
    yearFilterEnabled,
    setYearFilterEnabled,
    yearOptions,
    selectedYears,
    toggleYear,
    orderSearchQuery,
    setOrderSearchQuery,
    statusFilter,
    selectedOrderIds,
    setSelectedOrderIds,
    orderColumnFilters,
    setOrderColumnFilters,
    activeOrderFilterId,
    setActiveOrderFilterId,
    setOrderBulkImportDialogOpen,
    setNewOrderFilterDialogOpen,
    setLabelPrintSettingsDialogOpen,
    lastAction,
    handleDeleteOrder,
    handleDuplicateOrder,
    handleBatchStatusChange,
    handleDeleteSelectedOrders,
    handleUndoLastAction,
    handleExportDelivery,
    handleExportCmr,
    customerSearchQuery,
    setCustomerSearchQuery,
    setBulkImportDialogOpen,
    handleNewCustomer,
    handleEditCustomer,
    handleDeleteCustomer,
    productSearchQuery,
    setProductSearchQuery,
    setProductBulkImportDialogOpen,
    handleNewProduct,
    handleEditProduct,
    handleDeleteProduct,
    handleBulkDeleteProducts,
    maintenanceAdd: (m) => { maintenanceApi.add(m) },
    maintenanceRemove: (id) => { maintenanceApi.remove(id) },
    quotes: quotesApi.items || [],
    priceLists: priceListsApi.items || [],
    attendanceEntries: attendanceApi.items || [],
    leaveRequests: leavesApi.items || [],
    handleSaveAttendance,
    handleDeleteAttendance,
    datasheets: datasheetsApi.items || [],
    filledForms: filledFormsApi.items || [],
    handleSaveFilledForm,
    handleDeleteFilledForm,
    handleSaveDatasheet,
    handleSaveLeave,
    handleDeleteLeave,
    handleSavePriceList,
    handleDeletePriceList,
    handleSaveQuote,
    handleDeleteQuote,
    handleSetOrderLabelFlag,
    goToTab: setCurrentTab,
    inventorySearchQuery,
    setInventorySearchQuery,
    setInventory,
    setSelectedInventoryItem,
    setInventoryDialogOpen,
    setInventoryAdjustDialogOpen,
    setHistoryInventoryItem,
    setInventoryHistoryDialogOpen,
    setWarehouseAddPrefillProductId,
    setWarehouseAddDialogOpen,
    appendAudit,
    materials: materialsApi.items,
    handleSaveMaterial,
    handleDeleteMaterial,
    deliveryNotes: deliveryNotes || [],
    handleDeleteDeliveryNote,
    handleUpdateDeliveryNote,
    setExtraItemsNote,
    handleDownloadPdf,
    setCreateNoteDialogOpen,
    documentFilters,
    setDocumentFilters,
    activeFilterId,
    setActiveFilterId,
    setNewFilterDialogOpen,
    auditLog,
    handlePreviewNote,
    handleEmailNote,
    emailTemplate,
    setEmailTemplate,
    users,
    usersLoading,
    handleSaveUser,
    handleDeleteUser,
    setActiveTemplates,
    setLabelTemplates,
    setActiveLabelTemplateId,
    setSelectedLabelTemplate,
    setLabelTemplateDialogOpen,
    importInputRef: labelImportInputRef,
  }

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen()}>
      <AppSidebar
        role={roleForNav}
        lowStockCount={lowStockItems.length}
        brandAlert={unreadMessageCount > 0}
      />
      <SidebarInset>
        <TopBar
          auth={auth}
          messagesApi={messagesApi}
          orders={orders || []}
          onOpenSearch={() => setGlobalSearchOpen(true)}
          activeWorkCount={activeWorkCount}
          inProductionOrders={metrics.inProductionOrders}
          readyForDeliveryOrders={metrics.readyForDeliveryOrders}
          lowStockCount={lowStockItems.length}
          onTileProduction={() => setCurrentTab('production')}
          onTileInProduction={() => handleFilterByStatus('Folyamatban')}
          onTileDeliveries={() => setCurrentTab('deliveries')}
          onTileInventory={() => setCurrentTab('inventory')}
        />
        <div className="flex-1 px-4 py-6 md:px-6 space-y-6">
        <AppShellContext.Provider value={shell}>
        <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />
        <Routes>
          <Route path="/" element={<RequireRole allowed={['admin', 'viewer']}><AttekintesPage /></RequireRole>} />
          <Route path="/arajanlat" element={<RequireRole allowed={['admin']}><AjanlatokPage /></RequireRole>} />
          <Route path="/arajanlat/kalkulator" element={<RequireRole allowed={['admin']}><KalkulatorPage /></RequireRole>} />
          <Route path="/arajanlat/anyagarak" element={<RequireRole allowed={['admin']}><AnyagarakPage /></RequireRole>} />
          <Route path="/aktualis-arak" element={<RequireRole allowed={['admin']}><AktualisArakPage /></RequireRole>} />
          <Route path="/gyartas" element={<GyartasPage />} />
          <Route path="/gyartas/tervezes" element={<TervezesPage />} />
          <Route path="/gyartas/elozmenyek" element={<RequireRole allowed={['admin', 'operator']}><ElozmenyekPage /></RequireRole>} />
          <Route path="/gyartas/gepek" element={<RequireRole allowed={['admin', 'operator']}><GepekPage /></RequireRole>} />
          <Route path="/gyartas/karbantartas" element={<RequireRole allowed={['admin', 'operator']}><KarbantartasPage /></RequireRole>} />
          <Route path="/jelenlet" element={<RequireRole allowed={['admin', 'operator']}><KioszkPage /></RequireRole>} />
          <Route path="/jelenlet/havi-iv" element={<RequireRole allowed={['admin']}><HaviIvPage /></RequireRole>} />
          <Route path="/jelenlet/szabadsagok" element={<RequireRole allowed={['admin', 'operator']}><SzabadsagokPage /></RequireRole>} />
          <Route path="/rendelesek" element={<RequireRole allowed={['admin', 'viewer']}><RendelesekPage /></RequireRole>} />
          <Route path="/rendelesek/vevok" element={<RequireRole allowed={['admin']}><VevokPage /></RequireRole>} />
          <Route path="/rendelesek/termekek" element={<RequireRole allowed={['admin']}><TermekekPage /></RequireRole>} />
          <Route path="/rendelesek/termekek/adatlap/:productId" element={<RequireRole allowed={['admin']}><AdatlapPage /></RequireRole>} />
          <Route path="/keszlet" element={<KeszletPage />} />
          <Route path="/keszlet/anyaglista" element={<RequireRole allowed={['admin', 'operator']}><AnyaglistaPage /></RequireRole>} />
          <Route path="/szallitas" element={<SzallitasPage />} />
          <Route path="/dokumentumok/szallitolevel" element={<RequireRole allowed={['admin']}><SzallitolevelPage /></RequireRole>} />
          <Route path="/dokumentumok/etikett" element={<RequireRole allowed={['admin', 'operator']}><EtikettPage /></RequireRole>} />
          <Route path="/beallitasok/mentett" element={<RequireRole allowed={['admin']}><MentettPage /></RequireRole>} />
          <Route path="/dokumentumok/urlapok" element={<RequireRole allowed={['admin']}><UrlapokPage /></RequireRole>} />
          <Route path="/beallitasok/felhasznalok" element={<RequireRole allowed={['admin']}><FelhasznalokPage /></RequireRole>} />
          <Route path="/beallitasok/sablonok" element={<RequireRole allowed={['admin']}><SablonokPage /></RequireRole>} />
          <Route path="/beallitasok/munkanaptar" element={<RequireRole allowed={['admin']}><MunkanaptarPage /></RequireRole>} />
          <Route path="/beallitasok/riportok" element={<RequireRole allowed={['admin']}><RiportokPage /></RequireRole>} />
          <Route path="/beallitasok/lomtar" element={<RequireRole allowed={['admin']}><LomtarPage /></RequireRole>} />
          <Route path="*" element={<Navigate to={defaultPathFor(roleForNav)} replace />} />

        </Routes>
        </AppShellContext.Provider>
        </div>
      </SidebarInset>

      <IssueDateDialog
        open={issueDateDialogOpen}
        type={issueDateDialogType}
        onConfirm={handleIssueDateConfirm}
        onClose={() => { setIssueDateDialogOpen(false); setPendingCustomNote(null) }}
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


      <ExtraItemsDialog
        note={extraItemsNote}
        inventory={inventory || []}
        onClose={() => setExtraItemsNote(null)}
        onSave={handleSaveExtraItems}
      />

      <CreateDeliveryNoteDialog
        open={createNoteDialogOpen}
        onClose={() => setCreateNoteDialogOpen(false)}
        orders={orders || []}
        inventory={inventory || []}
        onCreate={handleCreateNoteFromDocuments}
        onCreateCustom={handleCreateCustomDeliveryNote}
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
    </SidebarProvider>
  )
}

export default App
