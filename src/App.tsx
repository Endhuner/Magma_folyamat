import { useState, useMemo, useEffect, useRef, Suspense, useCallback } from 'react'
import { useKV } from '@/hooks/useKV'
import { useEntityKV } from '@/hooks/useEntityKV'
import {
  deliveryNotesRepo,
  auditLogRepo,
} from '@/lib/db/repos'
import { useServerCrud } from '@/lib/providers/useServerCrud'
import { runMigrationIfNeeded } from '@/lib/db/migrate'
import { isMigrationDone, markMigrationDone, migrateLocalDataToServer } from '@/lib/db/migrateToServer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { OrderDialog } from '@/components/OrderDialog'
import { Dashboard } from '@/components/Dashboard'
import { CustomerDialog } from '@/components/CustomerDialog'
import { ProductDialog } from '@/components/ProductDialog'
import { DeliveryNotesTable } from '@/components/DeliveryNotesTable'

import { BackupRestore } from '@/components/BackupRestore'
import { ValidationDialog } from '@/components/ValidationDialog'
// Code-split heavy editors / dialogs — lásd `src/components/lazy.ts`.
import {
  GithubStyleTemplateEditor,
  TemplateBackupRestore,
  CmrSettingsDialog,
  DeliverySettingsDialog,
  LabelTemplateDialog,
} from '@/components/lazy'
import { OrderBulkImportDialog } from '@/components/OrderBulkImportDialog'
import { ProductBulkImportDialog } from '@/components/ProductBulkImportDialog'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { DocumentFilterDialog } from '@/components/DocumentFilterDialog'
import { OrderColumnFilterDialog } from '@/components/OrderColumnFilterDialog'
import { ProductionView } from '@/components/ProductionView'
import { MobileProductionView } from '@/components/MobileProductionView'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Order, OrderStatus, Customer, Product, DeliveryNote, InventoryItem, InventoryTransaction, ProductionShift, ProductionLog, ProductionDefect, Machine, User, Material, AuditLogEntry, AuditEntityType, AuditAction, AuditFieldChange } from '@/lib/types'
import { diffObjects, buildAuditEntry, pruneAuditLog, AUDIT_LOG_MAX_ENTRIES } from '@/lib/auditLog'
import { SimpleListView, SimpleColumnDef } from '@/components/SimpleListView'
import { InventoryHistoryDialog } from '@/components/InventoryHistoryDialog'
import { WarehouseAddDialog } from '@/components/WarehouseAddDialog'
import { calculateDashboardMetrics, parseYear, stripDiacritics, isDelivered } from '@/lib/helpers'
import { computeAutoFieldsForOrder } from '@/lib/orderService'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { useAuth } from '@/lib/auth'
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/api/usersApi'
import type { UserRole } from '@produktivpro/shared'
import { Plus, Factory, MagnifyingGlass, FileText, CaretDown, Database, Package } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { exportCmrAsHtml } from '@/lib/cmrHtmlTemplate'
import { exportDeliveryAsHtml, TemplateStyles } from '@/lib/deliveryHtmlTemplate'
import { validateCmrExport, validateDeliveryExport, ValidationResult } from '@/lib/exportValidation'
import { DEFAULT_DELIVERY_TEMPLATE_HTML, DEFAULT_DELIVERY_TEMPLATE_CSS } from '@/lib/defaultDeliveryTemplate'
import { previewLabels, LabelTemplate, generateLabelsWithPrintSettings } from '@/lib/labelTemplate'
import { LabelPrintSettingsDialog } from '@/components/LabelPrintSettingsDialog'
import { InventoryDialog } from '@/components/InventoryDialog'
import { InventoryAdjustDialog } from '@/components/InventoryAdjustDialog'
import { InventoryDeductionDialog } from '@/components/InventoryDeductionDialog'
import { deductInventoryForOrders, commitInventoryDeduction, InventoryDeductionResult } from '@/lib/inventoryService'
import { LabelTemplatesPanel } from '@/components/panels/LabelTemplatesPanel'
import { InventoryPanel } from '@/components/panels/InventoryPanel'
import { DocumentsPanel } from '@/components/panels/DocumentsPanel'
import { CustomersPanel } from '@/components/panels/CustomersPanel'
import { ProductsPanel } from '@/components/panels/ProductsPanel'
import { OrdersPanel } from '@/components/panels/OrdersPanel'
import { ProductionPanel } from '@/components/panels/ProductionPanel'

type LastAction =
  | { type: 'delete', orders: Order[] }
  | { type: 'edit', orderId: string, before: Order }
  | null

function App() {
  // Mobil eszközön a Gyártás fülön a kompakt érintőbarát nézetet renderelünk.
  const isMobile = useIsMobile()
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
  const [deliveryNotes, setDeliveryNotes] = useEntityKV<DeliveryNote>(deliveryNotesRepo)

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

  // Változásnapló — minden lényeges adatmódosítás itt is rögzül (Dokumentumok → Változások).
  const [auditLog, setAuditLog] = useEntityKV<AuditLogEntry>(auditLogRepo)
  const [machines, setMachines] = useKV<Machine[]>('machines', [])
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
  const [materials, setMaterials] = useKV<Material[]>('materials', [])
  const [customerSequences, setCustomerSequences] = useKV<Record<string, number>>('customerSequences', {})
  const [savedTemplates, setSavedTemplates] = useKV<any[]>('saved-templates', [])
  const [cmrSettings] = useKV<CmrLayoutSettings>('cmr-layout-settings', {
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
  
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [hideDelivered, setHideDelivered] = useState(true)
  
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
  
  const [deliveryStyles] = useKV<Partial<TemplateStyles>>('delivery-html-styles', {})
  
  const [documentFilters, setDocumentFilters] = useKV<Array<{id: string, name: string, columns: string[]}>>('document-filters', [])
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [newFilterDialogOpen, setNewFilterDialogOpen] = useState(false)

  const [orderColumnFilters, setOrderColumnFilters] = useKV<Array<{id: string, name: string, columns: string[]}>>('order-column-filters', [])
  const [activeOrderFilterId, setActiveOrderFilterId] = useState<string | null>(null)
  const [newOrderFilterDialogOpen, setNewOrderFilterDialogOpen] = useState(false)

  const [labelTemplates, setLabelTemplates] = useKV<LabelTemplate[]>('label-templates', [])
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

  // Egyszeri localStorage → IndexedDB migráció bootstrap.
  // Idempotens: ha már lefutott, azonnal visszatér (flag a localStorage-ban).
  // Hibára csak naplózunk — a régi useKV állapotot is meghagyjuk fallbacknek
  // egy verzió erejéig (rollback-stratégia).
  useEffect(() => {
    let cancelled = false
    runMigrationIfNeeded()
      .then((result) => {
        if (cancelled) return
        if (result.alreadyDone) return
        const total = Object.values(result.migrated).reduce((a, b) => a + (b ?? 0), 0)
        if (total > 0) {
          toast.success(
            `Adatbázis migráció kész — ${total} rekord IndexedDB-be mozgatva.`,
            { duration: 6000 }
          )
        }
        if (result.errors.length > 0) {
          console.error('[migrate] hibák:', result.errors)
          toast.warning(
            `Migráció figyelmeztetések: ${result.errors.length} kulcs nem költözött át. Részletek a konzolon.`,
            { duration: 8000 }
          )
        }
      })
      .catch((err) => {
        console.error('[migrate] kritikus hiba:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // Egyszeri migráció: IndexedDB (régi localStorage-alapú) → szerver SQLite.
  // Csak akkor fut, ha a szerver üres ÉS van helyi adat (első indítás után).
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMigrationDone()) return
    // Várunk 2 másodpercet, hogy a szerver-CRUD hook-ok töltsék be az adatot.
    const timer = setTimeout(async () => {
      try {
        const result = await migrateLocalDataToServer()
        markMigrationDone()
        if (result.migrated > 0) {
          toast.success(
            `Helyi adatok szerverre migrálva: ${result.migrated} tétel.`,
            { duration: 8000 }
          )
          // Frissítjük a szerver-CRUD hookokat, hogy az új adatot lássák.
          ordersApi.reload()
          customersApi.reload()
          productsApi.reload()
          inventoryApi.reload()
          transactionsApi.reload()
          shiftsApi.reload()
          defectsApi.reload()
          logsApi.reload()
        } else {
          markMigrationDone()
        }
        if (result.errors > 0) {
          console.warn(`[migration] ${result.errors} tétel migrálása sikertelen`)
        }
      } catch (err) {
        console.error('[migration] kritikus hiba:', err)
      }
    }, 2000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // Egyszeri productId-backfill: a régi rendelések még csak név-alapon
  // kapcsolódtak a termékekhez. Most, hogy az `Order.productId` mező létezik,
  // megpróbáljuk a meglévő rendeléseket az eredeti heurisztikával (customer +
  // productName/designation) párosítani egy létező Producthez, és bevezetni
  // a `productId`-t. Idempotens: csak azokat a rendeléseket frissíti, ahol
  // még nincs `productId`. Egy localStorage-flag akadályozza meg, hogy minden
  // app-induláskor újra végigfusson.
  // ──────────────────────────────────────────────────────────────────────────
  const productIdBackfillDone = useRef(false)
  useEffect(() => {
    if (productIdBackfillDone.current) return
    if (!Array.isArray(orders) || !Array.isArray(products)) return
    if (orders.length === 0 || products.length === 0) return
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem('orders-productid-backfill-v1') === 'done') {
          productIdBackfillDone.current = true
          return
        }
      } catch {
        /* private browsing — semmi baj, akkor minden induláskor lefuthat. */
      }
    }
    const candidates = orders.filter((o) => !o.productId)
    if (candidates.length === 0) {
      productIdBackfillDone.current = true
      try {
        window.localStorage.setItem('orders-productid-backfill-v1', 'done')
      } catch {
        /* ignore */
      }
      return
    }

    // Mégegyszer a régi heurisztika — szándékosan duplikálva, hogy a
    // `productionHelpers.findProductForOrder` új implementációja már a
    // productId-t várja és így ne hivatkozzunk vissza a régi ágra.
    const matchByLegacy = (order: Order): Product | undefined => {
      return products.find(
        (p) =>
          p.customer === order.customer &&
          (p.productName === order.productName ||
            p.drawingNumber === order.productName ||
            p.productName === order.designation ||
            p.drawingNumber === order.designation)
      )
    }

    let updatedCount = 0
    const updatedOrders = orders.map((o) => {
      if (o.productId) return o
      const matched = matchByLegacy(o)
      if (!matched) return o
      updatedCount += 1
      return { ...o, productId: matched.id, updatedAt: new Date().toISOString() }
    })

    productIdBackfillDone.current = true
    try {
      window.localStorage.setItem('orders-productid-backfill-v1', 'done')
    } catch {
      /* ignore */
    }
    if (updatedCount > 0) {
      setOrders(() => updatedOrders)
      // eslint-disable-next-line no-console
      console.log(`[backfill] ${updatedCount} rendelésnél kitöltöttük a productId-t.`)
    }
  }, [orders, products, setOrders])

  // localStorage kvóta figyelmeztetések — ha a tár ≥ 80%-ban tele van, vagy
  // ha QuotaExceededError történik, a felhasználó kap egy érthető toast-ot,
  // mielőtt valami "csendes" mentési hiba miatt adatot veszítene.
  useEffect(() => {
    const onWarning = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { ratio?: number; bytes?: number; entries?: number }
        | undefined
      const pct = Math.round(((detail?.ratio ?? 0) * 100))
      toast.warning(
        `A helyi tárhely ~${pct}%-ban megtelt. Készíts biztonsági mentést és ürítsd a régi adatokat.`,
        { duration: 8000 }
      )
    }
    const onExceeded = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined
      toast.error(
        `Nem sikerült menteni: a böngésző helyi tárhelye megtelt${
          detail?.key ? ` (kulcs: ${detail.key})` : ''
        }. Készíts biztonsági mentést, majd töröld a régi adatokat.`,
        { duration: 12000 }
      )
    }
    window.addEventListener('kv:quota-warning', onWarning as EventListener)
    window.addEventListener('kv:quota-exceeded', onExceeded as EventListener)
    return () => {
      window.removeEventListener('kv:quota-warning', onWarning as EventListener)
      window.removeEventListener('kv:quota-exceeded', onExceeded as EventListener)
    }
  }, [])

  useEffect(() => {
    const initializeDefaultTemplates = () => {
      const deliveryTemplateName = 'Szállítólevél Sablon - 2026.03.13 12:32'
      const deliveryTemplateExists = (savedTemplates || []).some(t => t.name === deliveryTemplateName)
      
      if (!deliveryTemplateExists) {
        const newTemplateId = `template-delivery-${Date.now()}`
        const newTemplate = {
          id: newTemplateId,
          name: deliveryTemplateName,
          timestamp: new Date('2026-03-13T12:32:00').toISOString(),
          size: JSON.stringify({ html: DEFAULT_DELIVERY_TEMPLATE_HTML, css: DEFAULT_DELIVERY_TEMPLATE_CSS }).length,
          data: {
            id: newTemplateId,
            name: deliveryTemplateName,
            type: 'delivery' as const,
            html: DEFAULT_DELIVERY_TEMPLATE_HTML,
            css: DEFAULT_DELIVERY_TEMPLATE_CSS,
            timestamp: new Date('2026-03-13T12:32:00').toISOString(),
            description: 'Alapértelmezett szállítólevél sablon',
            margins: {
              top: '10',
              right: '10',
              bottom: '10',
              left: '10'
            }
          }
        }
        
        setSavedTemplates((current) => [...(current || []), newTemplate])
        console.log('✅ Szállítólevél sablon inicializálva:', deliveryTemplateName)
      }

      const cmrTemplateName = 'CMR Sablon - 2026.03.13 12:42'
      const cmrTemplateExists = (savedTemplates || []).some(t => t.name === cmrTemplateName)
      
      if (!cmrTemplateExists) {
        const DEFAULT_CMR_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMR - {{sequenceNumber}}</title>
</head>
<body>
  <div class="cmr-document">
    <div class="sequence-number">Saját rendelési szám: {{sequenceNumber}}</div>
    
    <div class="header">
      <h1>NEMZETKÖZI FUVARLEVÉL</h1>
      <h2>INTERNATIONAL CONSIGNMENT NOTE</h2>
    </div>
    
    <div class="notice-box">
      This carriage is subject, notwithstanding any clause to the contrary to the Convention on the Contract for the international Carriage of goods by road (CMR).<br>
      A fuvarozásra elétrő megállapodás esetén is a nemzetközi árufuvarozási egyezmény CMR rendelkezései az irányadók
    </div>
    
    <div class="cmr-grid">
      <div class="section">
        <div class="section-title">1. Feladó (Név, cím, ország)<br>Sender (Name, Address, Country)</div>
        <div class="section-content">
          <strong>{{senderName}}</strong><br>
          {{senderAddress}}<br>
          {{senderCity}}, {{senderCountry}}<br>
          Adószám: {{senderTaxNumber}}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">2. Átvevő (Név, cím, ország)<br>Consignee (Name, Address, Country)</div>
        <div class="section-content">
          <strong>{{customerName}}</strong><br>
          {{customerAddress}}<br>
          {{customerCity}}, {{customerCountry}}<br>
          {{customerTaxNumber}}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">3. Az áru átvételének helye és időpontja<br>Place and date of delivery of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>{{pickupLocation}}</strong><br>
          Ország / Country: <strong>{{senderCountry}}</strong>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">4. Az áru leadásának helye és időpontja<br>Place and date of taking over of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>{{customerCity}}</strong><br>
          Ország / Country: <strong>{{customerCountry}}</strong>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">16. Carrier (Name, Address, Country)<br>Fuvarozó (Név, cím, ország)</div>
        <div class="section-content">
          {{carrierName}}<br>
          {{carrierAddress}}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">17. Successive carriers<br>További fuvarozó</div>
        <div class="section-content">
          &nbsp;
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">5. Mellékelt okmányok<br>Documents attached</div>
        <div class="section-content">
          Szállítólevél
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">18. Carrier's reservations and observations<br>A fuvarozó fenntartásai és bejegyzése</div>
        <div class="section-content">
          &nbsp;
        </div>
      </div>
    </div>
    
    <table class="goods-table">
      <thead>
        <tr>
          <th>Jel és szám<br>Marks and Nos</th>
          <th>Vevő rendelési száma<br>Customer Order No</th>
          <th>Darabszám<br>Number of packages</th>
          <th>Csomagolás<br>Method of packing</th>
          <th>Áru megnevezése<br>Nature of the goods</th>
          <th>Bruttósúly kg<br>Gross weight kg</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td class="center">{{index}}</td>
          <td class="center">{{ownOrderNumber}}</td>
          <td class="center">{{quantity}}</td>
          <td>{{packaging}}</td>
          <td>{{productName}}<br><small>{{designation}}</small></td>
          <td class="right">{{weight}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>
    
    <div class="section full-width">
      <div class="section-title">13. Sender's instructions (Customs and other formalities)<br>Feladó rendelkezései (Vám és egyéb hivatalos kezelés)</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>
    
    <div class="cmr-grid">
      <div class="section">
        <div class="section-title">14. Cash on delivery<br>Visszatérítés</div>
        <div class="section-content">
          -
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">19. To be paid by / Fizetendő</div>
        <div class="section-content">
          Sender / Feladó: ☐<br>
          Consignee / Átvevő: ☐<br>
          Currency / Pénznem: EUR
        </div>
      </div>
    </div>
    
    <div class="section full-width">
      <div class="section-title">15. Directions as to payment for carriage<br>Fuvardíjfizetési meghagyások</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>
    
    <div class="section full-width">
      <div class="section-title">20. Special agreements<br>Egyedi megállapodások</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">
          21. Kiállítás helye<br>
          <span class="signature-label-sub">Place issued</span>
        </div>
        <div class="section-content">
          <strong>{{pickupLocation}}</strong><br>
          Dátum: {{issueDate}}
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-label">
          22. A feladó aláírása és bélyegzője<br>
          <span class="signature-label-sub">Signature and stamp of the sender</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-label">
          23. Fuvarozó aláírása és bélyegzője<br>
          <span class="signature-label-sub">Signature and stamp of the carrier</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">
          24. Goods received / Áru átvétele<br>
          <span class="signature-label-sub">Date / Dátum</span>
        </div>
        <div class="signature-space">
          (dátum / date)
        </div>
      </div>
      
      <div class="signature-box" style="grid-column: 2 / -1;">
        <div class="signature-label">
          Signature and stamp of the consignee<br>
          <span class="signature-label-sub">Az átvevő aláírása és bélyegzője</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box" style="grid-column: 1 / -1;">
        <div class="signature-label">
          25. Vehicle / Jármű
        </div>
        <div class="section-content">
          Rendszám / Registration number: <strong>{{vehiclePlate}}</strong>
        </div>
      </div>
    </div>
    
  </div>
  
  <div class="no-print" style="text-align: center; padding: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer;">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
  </div>
</body>
</html>`

        const DEFAULT_CMR_TEMPLATE_CSS = `@page {
  size: A4;
  margin: 10mm;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  color: #000;
}

.cmr-document {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: white;
  padding: 5mm;
  position: relative;
}

.header {
  text-align: center;
  margin-bottom: 10px;
  border-bottom: 2px solid #000;
  padding-bottom: 5px;
}

.header h1 {
  font-size: 14pt;
  font-weight: bold;
  margin-bottom: 2px;
}

.header h2 {
  font-size: 11pt;
  font-weight: normal;
  font-style: italic;
}

.sequence-number {
  position: absolute;
  top: 5mm;
  right: 5mm;
  font-size: 12pt;
  font-weight: bold;
}

.cmr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.section {
  border: 1px solid #000;
  padding: 8px;
  background: #fff;
}

.section-title {
  font-size: 9pt;
  font-weight: bold;
  margin-bottom: 5px;
  text-decoration: underline;
}

.section-content {
  font-size: 10pt;
  line-height: 1.4;
}

.section-content strong {
  font-weight: bold;
}

.full-width {
  grid-column: 1 / -1;
}

.goods-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 9pt;
}

.goods-table th,
.goods-table td {
  border: 1px solid #000;
  padding: 4px 6px;
  text-align: left;
}

.goods-table th {
  background: #e0e0e0;
  font-weight: bold;
  text-align: center;
}

.goods-table td.center {
  text-align: center;
}

.goods-table td.right {
  text-align: right;
}

.signature-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
  page-break-inside: avoid;
}

.signature-box {
  border: 1px solid #000;
  padding: 8px;
  min-height: 80px;
}

.signature-label {
  font-size: 8pt;
  font-weight: bold;
  margin-bottom: 5px;
}

.signature-label-sub {
  font-size: 7pt;
  font-style: italic;
  color: #666;
}

.signature-space {
  margin-top: 40px;
  border-top: 1px solid #666;
  padding-top: 3px;
  text-align: center;
  font-size: 7pt;
}

.notice-box {
  border: 1px solid #000;
  padding: 5px;
  font-size: 7pt;
  text-align: center;
  margin-bottom: 10px;
  background: #f9f9f9;
}

@media print {
  body {
    margin: 0;
    padding: 0;
  }
  
  .cmr-document {
    margin: 0;
    padding: 5mm;
  }
  
  .no-print {
    display: none;
  }
}`

        const newCmrTemplateId = `template-cmr-${Date.now()}`
        const newCmrTemplate = {
          id: newCmrTemplateId,
          name: cmrTemplateName,
          timestamp: new Date('2026-03-13T12:42:00').toISOString(),
          size: JSON.stringify({ html: DEFAULT_CMR_TEMPLATE_HTML, css: DEFAULT_CMR_TEMPLATE_CSS }).length,
          data: {
            id: newCmrTemplateId,
            name: cmrTemplateName,
            type: 'cmr' as const,
            html: DEFAULT_CMR_TEMPLATE_HTML,
            css: DEFAULT_CMR_TEMPLATE_CSS,
            timestamp: new Date('2026-03-13T12:42:00').toISOString(),
            description: 'Alapértelmezett CMR sablon',
            margins: {
              top: '10',
              right: '10',
              bottom: '10',
              left: '10'
            }
          }
        }
        
        setSavedTemplates((current) => [...(current || []), newCmrTemplate])
        console.log('✅ CMR sablon inicializálva:', cmrTemplateName)
      }
    }
    
    if (savedTemplates !== undefined) {
      initializeDefaultTemplates()
    }
  }, [savedTemplates, setSavedTemplates])

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
        id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      const deductionResult = deductInventoryForOrders(
        ordersToUpdate,
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
    return (products || []).find(
      (p) =>
        p.customer === order.customer &&
        (p.productName === order.productName ||
          p.drawingNumber === order.productName ||
          p.productName === order.designation ||
          p.drawingNumber === order.designation)
    )
  }

  const handleSaveShift = (shift: ProductionShift) => {
    const existing = (productionShifts || []).find((s) => s.id === shift.id)
    const qtyDelta = shift.producedQuantity - (existing?.producedQuantity ?? 0)

    if (existing) { shiftsApi.replace(shift) } else { shiftsApi.add(shift) }

    const order = (orders || []).find((o) => o.id === shift.orderId)
    const product = findProductForOrder(order)
    // Automatikus készletfrissítés — csak akkor tiltjuk le, ha a termékhez
    // kifejezetten `autoUpdateInventory: false` van beállítva. Product nélkül
    // is frissítünk (Order adatokból), hogy a termelt mennyiség ne vesszen el.
    const autoUpdate = product?.autoUpdateInventory !== false
    if (order && autoUpdate && qtyDelta !== 0) {
      applyProductionShiftToInventory(shift, order, product, qtyDelta)
    }

    // Naplóbejegyzés
    const logEntry: ProductionLog = {
      id: `plog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
    const autoUpdate = product?.autoUpdateInventory !== false
    if (order && autoUpdate && qtyDelta !== 0) {
      applyProductionShiftToInventory(existing, order, product, qtyDelta, /* isDelete */ true)
    }

    logsApi.add({
      id: `plog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      const existing =
        list.find((i) => i.productId === productId) ||
        list.find(
          (i) =>
            i.customer === customer &&
            (i.productName === inventoryName ||
              i.drawingNumber === drawingNumber ||
              i.productName === order.productName)
        )
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
      itemId = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`
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
        id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      id: `plog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      id: `plog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      // Három szintű keresés: productId egyezés → (név+vevő) egyezés → (rajzszám+vevő) egyezés
      const existing =
        list.find((i) => i.productId === productId) ||
        list.find(
          (i) => i.customer === customer &&
            (i.productName === inventoryName ||
              i.drawingNumber === drawingNumber ||
              i.productName === order.productName)
        )
      if (existing) {
        itemId = existing.id
        return list.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                quantity: Math.max(0, i.quantity + delta),
                totalShots: Math.max(0, (i.totalShots ?? 0) + (isDelete ? -shift.shotsCount : shift.shotsCount)),
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
      itemId = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const newItem: InventoryItem = {
        id: itemId,
        productId,
        productName: inventoryName,
        drawingNumber,
        customer,
        quantity: delta,
        totalShots: shift.shotsCount,
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
        id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

  const handleOrderBulkImport = (importedOrders: Partial<Order>[]) => {
    setOrders((current) => [...(current || []), ...(importedOrders as Order[])])
    if (importedOrders.length > 0) {
      appendAudit(
        'order',
        'Rendelés',
        importedOrders.map((o) => (o as Order).id ?? '').filter(Boolean).join(','),
        `${importedOrders.length} rendelés`,
        'bulkImport',
        { notes: `Tömeges import: ${importedOrders.length} rendelés` }
      )
    }
    toast.success(`${importedOrders.length} rendelés sikeresen importálva`)
  }

  const handleUndoLastAction = () => {
    if (!lastAction) return
    
    if (lastAction.type === 'delete') {
      setOrders((current) => [...(current || []), ...lastAction.orders])
      toast.success('Visszavonva')
      setLastAction(null)
    } else if (lastAction.type === 'edit') {
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
    setCustomers((current) => [...(current || []), ...(importedCustomers as Customer[])])
    if (importedCustomers.length > 0) {
      appendAudit('customer', 'Vevő', '-', `${importedCustomers.length} vevő`, 'bulkImport', {
        notes: `Tömeges import: ${importedCustomers.length} vevő`,
      })
    }
    toast.success(`${importedCustomers.length} vevő sikeresen importálva`)
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
        id: `product-${Date.now()}`,
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
    const before = (machines || []).find((x) => x.id === m.id)
    setMachines((current) => {
      const list = current || []
      const exists = list.some((x) => x.id === m.id)
      return exists ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]
    })
    if (before) {
      const changes = diffObjects(
        before as unknown as Record<string, unknown>,
        m as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('machine', 'Gép', m.id, m.name || m.id, 'update', { changes })
      }
    } else {
      appendAudit('machine', 'Gép', m.id, m.name || m.id, 'create', { notes: m.type })
    }
  }
  const handleDeleteMachine = (id: string) => {
    const existing = (machines || []).find((x) => x.id === id)
    setMachines((current) => (current || []).filter((x) => x.id !== id))
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
    const before = (materials || []).find((x) => x.id === m.id)
    setMaterials((current) => {
      const list = current || []
      const exists = list.some((x) => x.id === m.id)
      return exists ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]
    })
    if (before) {
      const changes = diffObjects(
        before as unknown as Record<string, unknown>,
        m as unknown as Record<string, unknown>
      )
      if (changes.length > 0) {
        appendAudit('material', 'Anyag', m.id, m.name || m.id, 'update', { changes })
      }
    } else {
      appendAudit('material', 'Anyag', m.id, m.name || m.id, 'create', { notes: m.type })
    }
  }
  const handleDeleteMaterial = (id: string) => {
    const existing = (materials || []).find((x) => x.id === id)
    setMaterials((current) => (current || []).filter((x) => x.id !== id))
    if (existing) {
      appendAudit('material', 'Anyag', id, existing.name || id, 'delete', { notes: existing.type })
    }
  }

  const machineColumns: SimpleColumnDef[] = [
    { key: 'name', label: 'Név', required: true, minWidth: 200, placeholder: 'Pl. Engel Victory 120' },
    { key: 'serialNumber', label: 'Gyári szám', minWidth: 160, placeholder: 'Pl. SN-123456' },
    { key: 'type', label: 'Típus', minWidth: 160, placeholder: 'Pl. fröccsöntő' },
    { key: 'capacity', label: 'Befogókapacitás', minWidth: 160, placeholder: 'Pl. 120 t' },
    { key: 'notes', label: 'Megjegyzés', type: 'textarea', minWidth: 240, truncate: true },
  ]

  /**
   * A backend `'admin' | 'operator' | 'viewer'` enum-ot vár (English),
   * a UI viszont magyar feliratokat mutat. A SimpleListView `options`
   * objektum-formátuma ezt natívan megoldja: `value` az API-érték,
   * `label` a felhasználónak megjelenő szöveg.
   */
  const ROLE_LABEL_MAP: Record<string, string> = {
    admin: 'Adminisztrátor',
    operator: 'Operátor',
    viewer: 'Megfigyelő',
  }
  const userColumns: SimpleColumnDef[] = [
    { key: 'name', label: 'Név', required: true, minWidth: 200, placeholder: 'Pl. Kovács János' },
    { key: 'email', label: 'Email', type: 'email', minWidth: 220, placeholder: 'pl. nev@cegnev.hu' },
    {
      key: 'role',
      label: 'Szerepkör',
      type: 'select',
      options: [
        { value: 'admin', label: 'Adminisztrátor' },
        { value: 'operator', label: 'Operátor' },
        { value: 'viewer', label: 'Megfigyelő' },
      ],
      minWidth: 160,
      placeholder: 'Válasszon...',
      formatCell: (v) => ROLE_LABEL_MAP[v] ?? v,
      defaultValue: 'operator',
    },
    {
      key: 'pin',
      label: 'PIN-kód',
      type: 'password',
      digitOnly: true,
      maxLength: 8,
      placeholder: '4–8 számjegy',
      requiredOnCreateOnly: true,
      hideInTable: true,
      helpText:
        'Új felhasználónál kötelező (4–8 számjegy). Szerkesztéskor csak akkor töltsd ki, ha cserélni szeretnéd a PIN-t.',
    },
    {
      key: 'active',
      label: 'Aktív',
      type: 'select',
      options: [
        { value: 'Igen', label: 'Igen' },
        { value: 'Nem', label: 'Nem (zárolt)' },
      ],
      minWidth: 110,
      // A tábla cellájában a User.active boolean; getCell `String(v)`-vel
      // alakítja → 'true' / 'false' / ''. Ezt fordítjuk vissza emberinek.
      formatCell: (v) =>
        v === 'true' || v === 'Igen' ? 'Igen' : v === 'false' || v === 'Nem' ? 'Nem' : 'Igen',
      // Szerkesztéskor a Select értékének az options.value-jéből kell lennie.
      parseValue: (raw) =>
        raw === 'false' || raw === 'Nem' ? 'Nem' : 'Igen',
      // Új user létrehozásakor alapból aktív.
      defaultValue: 'Igen',
    },
    { key: 'notes', label: 'Megjegyzés', type: 'textarea', minWidth: 240, truncate: true },
  ]

  const materialColumns: SimpleColumnDef[] = [
    { key: 'name', label: 'Anyag neve', required: true, minWidth: 200, placeholder: 'Pl. PA66 GF30' },
    { key: 'type', label: 'Típus', minWidth: 160, placeholder: 'Pl. granulátum' },
    { key: 'supplier', label: 'Beszállító', minWidth: 200, placeholder: 'Pl. BASF' },
    { key: 'unitPrice', label: 'Egységár', type: 'number', minWidth: 140, placeholder: 'Pl. 1250' },
    {
      key: 'unit',
      label: 'Egység',
      type: 'select',
      options: ['kg', 'g', 'db', 'l', 'm'],
      minWidth: 120,
    },
    { key: 'notes', label: 'Megjegyzés', type: 'textarea', minWidth: 240, truncate: true },
  ]

  const handleNewProduct = () => {
    setSelectedProduct(null)
    setProductDialogOpen(true)
  }

  const handleProductBulkImport = (importedProducts: Partial<Product>[]) => {
    setProducts((current) => [...(current || []), ...(importedProducts as Product[])])
    toast.success(`${importedProducts.length} termék sikeresen importálva`)
  }

  const handleDeleteDeliveryNote = (id: string) => {
    setDeliveryNotes((current) => (current || []).filter((dn) => dn.id !== id))
    toast.success('Szállítólevél sikeresen törölve')
  }

  const handleUpdateDeliveryNote = (id: string, updatedData: Record<string, string | number | null | undefined>[]) => {
    setDeliveryNotes((current) =>
      (current || []).map((dn) =>
        dn.id === id ? { ...dn, exportData: updatedData, updatedAt: new Date().toISOString() } : dn
      )
    )
    toast.success('Szállítólevél sikeresen frissítve')
  }

  const handleExportDelivery = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }

    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    const validation = validateDeliveryExport(selectedOrders, customers || [], products || [])
    
    if (!validation.isValid || validation.warnings.length > 0) {
      setValidationResult(validation)
      setPendingExportType('delivery')
      setValidationDialogOpen(true)
      return
    }

    await executeDeliveryExport()
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

  const actuallyRunDeliveryExport = async (selectedOrders: Order[]) => {
    await exportDeliveryAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const newNote = {
          ...deliveryNote,
          id: Date.now().toString(),
          sequenceNumber: sequenceNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setDeliveryNotes((current) => [...(current || []), newNote as any])

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
      deliveryStyles
    )
  }

  const executeDeliveryExport = async () => {
    const selectedOrders = (orders || []).filter((o) => selectedOrderIds.includes(o.id))

    // Készletlevonás csak olyan rendelésekre, amelyeknél még nem történt szállítói levonás
    const ordersForDeduction = selectedOrders.filter((o) => !hasExistingShipmentDeduction(o.id))

    if (ordersForDeduction.length === 0) {
      // Nincs mit levonni — közvetlenül exportálunk
      await actuallyRunDeliveryExport(selectedOrders)
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
        await actuallyRunDeliveryExport(selectedOrders)
      })
      setInventoryDeductionDialogOpen(true)
      return
    }

    // Teljes fedezet — automatikusan levonjuk, majd exportálunk
    if (deductionResult.deductedItems.length > 0) {
      // Atomicus commit: lásd inventoryService.commitInventoryDeduction.
      commitInventoryDeduction(
        deductionResult,
        setInventory,
        setInventoryTransactions
      )
      toast.success(`Készlet csökkentve: ${deductionResult.deductedItems.length} tétel`)
    }
    await actuallyRunDeliveryExport(selectedOrders)
  }

  const handleExportCmr = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }

    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    const validation = validateCmrExport(selectedOrders, customers || [], products || [], cmrSettings)
    
    if (!validation.isValid || validation.warnings.length > 0) {
      setValidationResult(validation)
      setPendingExportType('cmr')
      setValidationDialogOpen(true)
      return
    }

    await executeCmrExport()
  }
  
  const executeCmrExport = async () => {
    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    await exportCmrAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const newNote = {
          ...deliveryNote,
          id: Date.now().toString(),
          sequenceNumber: sequenceNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setDeliveryNotes((current) => [...(current || []), newNote as any])

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
      cmrSettings
    )
  }
  
  const handleValidationContinue = async () => {
    setValidationDialogOpen(false)
    
    if (pendingExportType === 'cmr') {
      await executeCmrExport()
    } else if (pendingExportType === 'delivery') {
      await executeDeliveryExport()
    }
    
    setPendingExportType(null)
    setValidationResult(null)
  }

  const activeOrders = useMemo(() => {
    let filtered = orders || []
    
    if (hideDelivered) {
      filtered = filtered.filter(o => !isDelivered(o.status))
    }
    
    if (yearFilterEnabled && selectedYears.length > 0 && yearOptions.length > 0) {
      const yearSet = new Set(selectedYears)
      filtered = filtered.filter(o => {
        const yOrder = parseYear(o.orderDate)
        return yOrder != null && yearSet.has(yOrder)
      })
    }
    
    return filtered
  }, [orders, hideDelivered, selectedYears, yearOptions.length, yearFilterEnabled])

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
    const query = customerSearchQuery.toLowerCase()
    if (!query) return customers || []
    return (customers || []).filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.city.toLowerCase().includes(query) ||
        customer.country.toLowerCase().includes(query) ||
        customer.taxNumber.toLowerCase().includes(query) ||
        customer.postalCode.toLowerCase().includes(query)
    )
  }, [customers, customerSearchQuery])

  const filteredProducts = useMemo(() => {
    const query = productSearchQuery.toLowerCase()
    if (!query) return products || []
    return (products || []).filter(
      (product) =>
        product.customer.toLowerCase().includes(query) ||
        product.productName.toLowerCase().includes(query) ||
        product.drawingNumber.toLowerCase().includes(query) ||
        product.articleNumber.toLowerCase().includes(query) ||
        product.material.toLowerCase().includes(query)
    )
  }, [products, productSearchQuery])

  const dashboardFilteredOrders = useMemo(() => {
    if (!dashboardSearchQuery) return orders || []
    const query = dashboardSearchQuery.toLowerCase()
    return (orders || []).filter(
      (order) =>
        order.productName.toLowerCase().includes(query) ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.customer.toLowerCase().includes(query)
    )
  }, [orders, dashboardSearchQuery])

  const metrics = useMemo(
    () => calculateDashboardMetrics(dashboardFilteredOrders),
    [dashboardFilteredOrders]
  )

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
    return filteredOrders.filter(o => 
      o.status === 'Folyamatban' || 
      o.status === 'Előkészítve' || 
      o.status === 'Csomagolás alatt'
    ).length
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
                <h1 className="text-2xl font-bold tracking-tight">ProduktívPro</h1>
                <p className="text-sm text-muted-foreground">Termelés Irányítási Rendszer</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Aktív Munkák</p>
                <p className="text-3xl font-bold font-mono text-accent">{activeWorkCount}</p>
              </div>
              {auth.user && (
                <div className="flex items-center gap-2 border-l pl-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{auth.user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{auth.user.role === 'admin' ? 'Adminisztrátor' : auth.user.role === 'operator' ? 'Operátor' : 'Megfigyelő'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => auth.logout()} title="Kijelentkezés">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 256 256" fill="currentColor">
                      <path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/>
                    </svg>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto px-6 py-8">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList className={`grid w-full md:w-auto md:inline-grid ${auth.user?.role === 'operator' ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-4 md:grid-cols-4'}`}>
              {auth.user?.role !== 'operator' && <TabsTrigger value="dashboard">Áttekintés</TabsTrigger>}
              <TabsTrigger value="production">Gyártás</TabsTrigger>
              {auth.user?.role !== 'operator' && <TabsTrigger value="orders">Rendelések</TabsTrigger>}
              <TabsTrigger value="inventory">Készlet</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 ml-auto">
              {auth.user?.role === 'admin' && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Database className="w-4 h-4" />
                    Adatok
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCurrentTab('customers')}>
                    Vevők
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('products')}>
                    Termékek
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('machines')}>
                    Gépek
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('users')}>
                    Felhasználók
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('materials')}>
                    Anyaglista
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}

              {auth.user?.role === 'admin' && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Dokumentumok
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Sablonok</DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onSelect={() => setCurrentTab('github-editor')}>
                          Sablon Szerkesztő
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setCurrentTab('template-saves')}>
                          Sablon Mentések
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setCurrentTab('label-templates')}>
                          Címke Sablonok
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setCurrentTab('documents')}>
                    Dokumentumok
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCurrentTab('saves')}>
                    Mentések
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

            <Dashboard metrics={metrics} onFilterByStatus={handleFilterByStatus} />

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
            handleStatusChange={handleStatusChange}
            handleEditOrder={handleEditOrder}
            handleSaveShift={handleSaveShift}
            handleDeleteShift={handleDeleteShift}
            handleUpdateOrderNotes={handleUpdateOrderNotes}
            handleSaveDefect={handleSaveDefect}
            handleDeleteDefect={handleDeleteDefect}
          />

          <OrdersPanel
            filteredOrders={filteredOrders}
            orders={orders}
            customers={customers}
            products={products}
            labelTemplates={labelTemplates}
            activeLabelTemplateId={activeLabelTemplateId}
            hideDelivered={hideDelivered}
            setHideDelivered={setHideDelivered}
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
          />

          <TabsContent value="machines" className="space-y-6">
            <SimpleListView<Machine>
              title="Gépek"
              description="Termelőgépek és berendezések adatai"
              icon={<Factory className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />}
              items={machines || []}
              columns={machineColumns}
              onSave={handleSaveMachine}
              onDelete={handleDeleteMachine}
              addLabel="Új gép"
              addDialogTitle="Új gép hozzáadása"
              editDialogTitle="Gép szerkesztése"
              emptyHint='Vegyen fel új gépet az "Új gép" gombbal.'
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <SimpleListView<User>
              title="Felhasználók"
              description={
                auth.user?.role === 'admin'
                  ? 'Rendszerfelhasználók és szerepkörök. Új felhasználónál állíts be PIN-t — azzal tud belépni a login képernyőn.'
                  : usersLoading
                    ? 'Felhasználók betöltése…'
                    : 'Csak adminisztrátor tud felhasználókat létrehozni vagy módosítani.'
              }
              icon={<Database className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />}
              items={users}
              columns={userColumns}
              onSave={handleSaveUser}
              onDelete={handleDeleteUser}
              addLabel="Új felhasználó"
              addDialogTitle="Új felhasználó hozzáadása"
              editDialogTitle="Felhasználó szerkesztése"
              emptyHint={
                auth.user?.role === 'admin'
                  ? 'Vegyen fel új felhasználót az "Új felhasználó" gombbal. PIN-t a felhasználó-űrlapon adhatsz meg.'
                  : 'Nincs felhasználó. Adminisztrátor jogosultság szükséges a létrehozáshoz.'
              }
              successMessages={{
                create: 'Felhasználó létrehozva',
                update: 'Felhasználó módosítva',
                delete: 'Felhasználó törölve',
              }}
            />
          </TabsContent>

          <TabsContent value="materials" className="space-y-6">
            <SimpleListView<Material>
              title="Anyaglista"
              description="Alapanyagok és granulátumok nyilvántartása"
              icon={<Package className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />}
              items={materials || []}
              columns={materialColumns}
              onSave={handleSaveMaterial}
              onDelete={handleDeleteMaterial}
              addLabel="Új anyag"
              addDialogTitle="Új anyag hozzáadása"
              editDialogTitle="Anyag szerkesztése"
              emptyHint='Vegyen fel új anyagot az "Új anyag" gombbal.'
            />
          </TabsContent>

          <TabsContent value="github-editor" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Sablonszerkesztő betöltése…</div>}>
              <GithubStyleTemplateEditor />
            </Suspense>
          </TabsContent>

          <TabsContent value="template-saves" className="space-y-6">
            <Suspense fallback={<div className="text-muted-foreground p-4">Sablonkezelő betöltése…</div>}>
              <TemplateBackupRestore />
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
          />

          <TabsContent value="saves" className="space-y-6">
            <BackupRestore />
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

      <InventoryDialog
        open={inventoryDialogOpen}
        onClose={() => {
          setInventoryDialogOpen(false)
          setSelectedInventoryItem(null)
        }}
        onSave={(itemData) => {
          if (selectedInventoryItem) {
            const before = inventory?.find((i) => i.id === selectedInventoryItem.id)
            const after = before ? { ...before, ...itemData } : null
            setInventory((current) =>
              (current || []).map((item) =>
                item.id === selectedInventoryItem.id ? { ...item, ...itemData } : item
              )
            )
            if (before && after) {
              const changes = diffObjects(
                before as unknown as Record<string, unknown>,
                after as unknown as Record<string, unknown>,
                ['updatedAt', 'lastUpdated']
              )
              if (changes.length > 0) {
                appendAudit(
                  'inventory',
                  'Készlet',
                  selectedInventoryItem.id,
                  before.productName || before.drawingNumber || selectedInventoryItem.id,
                  'update',
                  { changes, notes: before.customer }
                )
              }
            }
            toast.success('Készlet tétel frissítve')
          } else {
            const newItem: InventoryItem = {
              id: `inv-${Date.now()}`,
              ...itemData,
              createdAt: new Date().toISOString(),
            } as InventoryItem
            setInventory((current) => [...(current || []), newItem])
            appendAudit(
              'inventory',
              'Készlet',
              newItem.id,
              newItem.productName || newItem.drawingNumber || newItem.id,
              'create',
              { notes: `${newItem.customer || ''} · ${newItem.quantity} db` }
            )
            toast.success('Készlet tétel létrehozva')
          }
        }}
        item={selectedInventoryItem}
        products={products || []}
      />

      <InventoryAdjustDialog
        open={inventoryAdjustDialogOpen}
        onClose={() => {
          setInventoryAdjustDialogOpen(false)
          setSelectedInventoryItem(null)
        }}
        onSave={(adjustment) => {
          if (!selectedInventoryItem) return

          const transaction: InventoryTransaction = {
            id: `trans-${Date.now()}`,
            inventoryItemId: selectedInventoryItem.id,
            type: adjustment.type,
            quantity: adjustment.quantity,
            notes: adjustment.notes,
            createdAt: new Date().toISOString(),
          }

          setInventoryTransactions((current) => [...(current || []), transaction])

          let beforeQty = selectedInventoryItem.quantity
          let afterQty = beforeQty
          setInventory((current) =>
            (current || []).map((item) => {
              if (item.id !== selectedInventoryItem.id) return item

              let newQuantity = item.quantity
              if (adjustment.type === 'in') {
                newQuantity += adjustment.quantity
              } else if (adjustment.type === 'out') {
                newQuantity = Math.max(0, newQuantity - adjustment.quantity)
              } else if (adjustment.type === 'adjustment') {
                newQuantity = adjustment.quantity
              }
              afterQty = newQuantity
              beforeQty = item.quantity

              return {
                ...item,
                quantity: newQuantity,
                lastUpdated: new Date().toISOString(),
              }
            })
          )

          // Audit-log: készletmozgás
          appendAudit(
            'inventory',
            'Készlet',
            selectedInventoryItem.id,
            selectedInventoryItem.productName || selectedInventoryItem.drawingNumber || selectedInventoryItem.id,
            adjustment.type,
            {
              changes: [
                {
                  field: 'quantity',
                  label: 'Mennyiség (db)',
                  before: beforeQty,
                  after: afterQty,
                },
              ],
              notes: adjustment.notes || `${adjustment.quantity} db`,
            }
          )

          toast.success('Készlet módosítva')
        }}
        item={selectedInventoryItem}
      />

      <OrderDialog
        open={orderDialogOpen}
        onClose={() => {
          setOrderDialogOpen(false)
          setSelectedOrder(null)
        }}
        onSave={handleSaveOrder}
        order={selectedOrder}
        customers={customers || []}
        products={products || []}
        orders={orders || []}
      />

      <OrderBulkImportDialog
        open={orderBulkImportDialogOpen}
        onClose={() => setOrderBulkImportDialogOpen(false)}
        onImport={handleOrderBulkImport}
      />

      <CustomerDialog
        open={customerDialogOpen}
        onClose={() => {
          setCustomerDialogOpen(false)
          setSelectedCustomer(null)
        }}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
        savedTemplates={savedTemplates?.map(t => t.data).filter(Boolean) || []}
        labelTemplates={labelTemplates || []}
      />

      <BulkImportDialog
        open={bulkImportDialogOpen}
        onClose={() => setBulkImportDialogOpen(false)}
        onImport={handleBulkImport}
      />

      <ProductDialog
        open={productDialogOpen}
        onClose={() => {
          setProductDialogOpen(false)
          setSelectedProduct(null)
        }}
        onSave={handleSaveProduct}
        product={selectedProduct}
      />

      <ProductBulkImportDialog
        open={productBulkImportDialogOpen}
        onClose={() => setProductBulkImportDialogOpen(false)}
        onImport={handleProductBulkImport}
      />

      {cmrSettingsDialogOpen && (
        <Suspense fallback={null}>
          <CmrSettingsDialog
            open={cmrSettingsDialogOpen}
            onClose={() => setCmrSettingsDialogOpen(false)}
          />
        </Suspense>
      )}

      {deliverySettingsDialogOpen && (
        <Suspense fallback={null}>
          <DeliverySettingsDialog
            open={deliverySettingsDialogOpen}
            onClose={() => setDeliverySettingsDialogOpen(false)}
          />
        </Suspense>
      )}

      <ValidationDialog
        open={validationDialogOpen}
        onClose={() => {
          setValidationDialogOpen(false)
          setPendingExportType(null)
          setValidationResult(null)
        }}
        onContinue={handleValidationContinue}
        validation={validationResult || { isValid: true, errors: [], warnings: [] }}
        title={pendingExportType === 'cmr' ? 'CMR Export Ellenőrzés' : 'Szállítólevél Export Ellenőrzés'}
        orders={(orders || []).filter(o => selectedOrderIds.includes(o.id))}
        onEditOrder={handleEditOrder}
        onEditSettings={() => {
          if (pendingExportType === 'cmr') {
            setCmrSettingsDialogOpen(true)
          } else if (pendingExportType === 'delivery') {
            setDeliverySettingsDialogOpen(true)
          }
        }}
        exportType={pendingExportType || undefined}
      />

      <DocumentFilterDialog
        open={newFilterDialogOpen}
        onClose={() => setNewFilterDialogOpen(false)}
        onSave={(filter) => {
          const newFilter = {
            id: Date.now().toString(),
            ...filter,
          }
          setDocumentFilters((current) => [...(current || []), newFilter])
          toast.success(`Szűrő "${filter.name}" létrehozva`)
        }}
      />

      <OrderColumnFilterDialog
        open={newOrderFilterDialogOpen}
        onClose={() => setNewOrderFilterDialogOpen(false)}
        onSave={(filter) => {
          const newFilter = {
            id: Date.now().toString(),
            ...filter,
          }
          setOrderColumnFilters((current) => [...(current || []), newFilter])
          setActiveOrderFilterId(newFilter.id)
          toast.success(`Oszlop szűrő "${filter.name}" létrehozva és aktiválva`)
        }}
      />

      {labelTemplateDialogOpen && (
        <Suspense fallback={null}>
          <LabelTemplateDialog
            open={labelTemplateDialogOpen}
            onClose={() => {
              setLabelTemplateDialogOpen(false)
              setSelectedLabelTemplate(null)
            }}
            onSave={(template) => {
              if (selectedLabelTemplate) {
                setLabelTemplates((current) =>
                  (current || []).map((t) =>
                    t.id === selectedLabelTemplate.id ? template : t
                  )
                )
                toast.success('Sablon frissítve')
              } else {
                setLabelTemplates((current) => [...(current || []), template])
                toast.success('Sablon létrehozva')
              }
              setLabelTemplateDialogOpen(false)
              setSelectedLabelTemplate(null)
            }}
            template={selectedLabelTemplate || undefined}
            onPreview={async (template) => {
              if (selectedOrderIds.length === 0) {
                const demoOrders = orders?.slice(0, 3) || []
                if (demoOrders.length === 0) {
                  toast.info('Nincs rendelés az előnézethez')
                  return
                }
                const html = await previewLabels(demoOrders, customers || [], products || [], template)
                const win = window.open('', '_blank')
                if (win) {
                  win.document.write(html)
                  win.document.close()
                }
              } else {
                const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                const html = await previewLabels(selectedOrders, customers || [], products || [], template)
                const win = window.open('', '_blank')
                if (win) {
                  win.document.write(html)
                  win.document.close()
                }
              }
            }}
          />
        </Suspense>
      )}

      <InventoryDeductionDialog
        open={inventoryDeductionDialogOpen}
        onClose={() => {
          setInventoryDeductionDialogOpen(false)
          setPendingDeductionResult(null)
          setPendingStatusChange(null)
          setPendingPostDeduction(null)
          setDeductionContext('státuszváltás')
        }}
        onConfirm={handleConfirmInventoryDeduction}
        deductionResult={pendingDeductionResult}
        context={deductionContext}
      />

      <InventoryHistoryDialog
        open={inventoryHistoryDialogOpen}
        onClose={() => {
          setInventoryHistoryDialogOpen(false)
          setHistoryInventoryItem(null)
        }}
        item={historyInventoryItem}
        transactions={inventoryTransactions || []}
        orders={orders || []}
      />

      <WarehouseAddDialog
        open={warehouseAddDialogOpen}
        onClose={() => {
          setWarehouseAddDialogOpen(false)
          setWarehouseAddPrefillProductId(undefined)
        }}
        products={products || []}
        inventory={inventory || []}
        prefillProductId={warehouseAddPrefillProductId}
        onSubmit={({ item, transaction, createdNew }) => {
          if (createdNew) {
            setInventory((current) => [...(current || []), item])
            appendAudit(
              'inventory',
              'Készlet',
              item.id,
              item.productName || item.drawingNumber || item.id,
              'create',
              { notes: `${item.customer || ''} · ${item.quantity} db` }
            )
          } else {
            const before = (inventory || []).find((i) => i.id === item.id)
            setInventory((current) =>
              (current || []).map((i) => (i.id === item.id ? item : i))
            )
            if (before) {
              appendAudit(
                'inventory',
                'Készlet',
                item.id,
                item.productName || item.drawingNumber || item.id,
                transaction.type,
                {
                  changes: [
                    {
                      field: 'quantity',
                      label: 'Mennyiség (db)',
                      before: before.quantity,
                      after: item.quantity,
                    },
                  ],
                  notes: transaction.notes,
                }
              )
            }
          }
          setInventoryTransactions((current) => [...(current || []), transaction])
        }}
      />

      <LabelPrintSettingsDialog
        open={labelPrintSettingsDialogOpen}
        onClose={() => setLabelPrintSettingsDialogOpen(false)}
        onPrint={async (printSettings) => {
          if (selectedOrderIds.length === 0) {
            toast.error('Nincsenek kiválasztott rendelések')
            return
          }
          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
          await generateLabelsWithPrintSettings(
            selectedOrders,
            customers || [],
            products || [],
            activeTemplate,
            printSettings
          )
        }}
        defaultCopies={1}
      />
    </div>
  )
}

export default App
