/**
 * Rendelések (Orders) kezelőpanel — a TIR fő tabjának egyik szigetelt blokkja.
 *
 * Felelőssége:
 *  - év- és státusz-szűrők, kereső
 *  - tömeges státuszváltás, törlés, duplikálás, undo
 *  - oszlopszűrő-választás
 *  - dokumentumkészítés (szállító, CMR, címkék, PDF/PNG/CSV/Excel export)
 *
 * Architektúra: csak prop-ok — semmi közvetlen DB-elérés. Az összes
 * mutáció a hívó (App.tsx) handler-jein keresztül történik, hogy a panel
 * tisztán prezentációs maradjon.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Upload,
  MagnifyingGlass,
  Funnel,
  Truck,
  FileText,
  FilePdf,
  Tag,
  CaretDown,
  X,
  ArrowCounterClockwise,
  CopySimple,
  DownloadSimple,
  Export,
  Package,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { OrdersTable } from '@/components/OrdersTable'
import {
  generateLabels,
  generateLabelsByCustomer,
  previewLabels,
  type LabelTemplate,
} from '@/lib/labelTemplate'
import type { Order, OrderStatus, Customer, Product } from '@/lib/types'
import { downloadOrderImportTemplate, exportOrdersToExcel } from '@/lib/orderExcelExport'
import { generatePalletLabels } from '@/lib/palletLabelExport'

export interface OrderColumnFilter {
  id: string
  name: string
  columns: string[]
}

export type LastOrderAction =
  | { type: 'delete'; orders: Order[] }
  | { type: 'edit'; orderId: string; before: Order }
  | null

export interface OrdersPanelProps {
  // Adatok / filterek
  filteredOrders: Order[]
  orders: Order[] | null | undefined
  customers: Customer[] | null | undefined
  products: Product[] | null | undefined
  labelTemplates: LabelTemplate[] | null | undefined
  activeLabelTemplateId: string | null | undefined
  savedDeliveryTemplates?: Array<{ id: string; data: { type: string; html: string; css: string } }> | null

  // UI state
  hideDelivered: boolean
  setHideDelivered: (v: boolean) => void
  yearFilterEnabled: boolean
  setYearFilterEnabled: (v: boolean) => void
  yearOptions: number[]
  selectedYears: number[]
  toggleYear: (year: number) => void
  orderSearchQuery: string
  setOrderSearchQuery: (q: string) => void
  statusFilter: OrderStatus | 'all'
  setStatusFilter: (s: OrderStatus | 'all') => void
  selectedOrderIds: string[]
  setSelectedOrderIds: (ids: string[]) => void

  // Oszlopszűrők
  orderColumnFilters: OrderColumnFilter[] | null | undefined
  setOrderColumnFilters: (
    updater: (current: OrderColumnFilter[] | null | undefined) => OrderColumnFilter[]
  ) => void
  activeOrderFilterId: string | null
  setActiveOrderFilterId: (id: string | null) => void

  // Dialógus-vezérlők
  setOrderBulkImportDialogOpen: (open: boolean) => void
  setNewOrderFilterDialogOpen: (open: boolean) => void
  setLabelPrintSettingsDialogOpen: (open: boolean) => void
  setCurrentTab: (tab: string) => void

  // Műveleti handler-ek
  lastAction: LastOrderAction
  handleNewOrder: () => void
  handleEditOrder: (id: string) => void
  handleDeleteOrder: (id: string) => void
  handleDuplicateOrder: (id: string) => void
  handleStatusChange: (id: string, status: OrderStatus) => void
  handleBatchStatusChange: (ids: string[], status: OrderStatus) => void
  handleDeleteSelectedOrders: () => void
  handleUndoLastAction: () => void
  handleExportDelivery: () => void | Promise<void>
  handleExportCmr: () => void | Promise<void>
}

export function OrdersPanel({
  filteredOrders,
  orders,
  customers,
  products,
  labelTemplates,
  activeLabelTemplateId,
  savedDeliveryTemplates,
  hideDelivered,
  setHideDelivered,
  yearFilterEnabled,
  setYearFilterEnabled,
  yearOptions,
  selectedYears,
  toggleYear,
  orderSearchQuery,
  setOrderSearchQuery,
  statusFilter,
  setStatusFilter,
  selectedOrderIds,
  setSelectedOrderIds,
  orderColumnFilters,
  setOrderColumnFilters,
  activeOrderFilterId,
  setActiveOrderFilterId,
  setOrderBulkImportDialogOpen,
  setNewOrderFilterDialogOpen,
  setLabelPrintSettingsDialogOpen,
  setCurrentTab,
  lastAction,
  handleNewOrder,
  handleEditOrder,
  handleDeleteOrder,
  handleDuplicateOrder,
  handleStatusChange,
  handleBatchStatusChange,
  handleDeleteSelectedOrders,
  handleUndoLastAction,
  handleExportDelivery,
  handleExportCmr,
}: OrdersPanelProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const activeTemplate = labelTemplates?.find((t) => t.id === activeLabelTemplateId)
  const selectedOrders = (orders || []).filter((o) => selectedOrderIds.includes(o.id))

  return (
    <TabsContent value="orders" className="space-y-6 pb-32">
      <div className="bg-card border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="hide-delivered"
                checked={hideDelivered}
                onCheckedChange={setHideDelivered}
              />
              <Label htmlFor="hide-delivered" className="cursor-pointer text-sm">
                Kiszállítva elrejtése
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="year-filter"
                checked={yearFilterEnabled}
                onCheckedChange={setYearFilterEnabled}
              />
              <Label htmlFor="year-filter" className="cursor-pointer text-sm">
                Évszám szűrés
              </Label>
            </div>

            {yearFilterEnabled && yearOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Év:</span>
                <div className="flex gap-2 flex-wrap">
                  {yearOptions.map((year) => (
                    <Badge
                      key={year}
                      variant={selectedYears.includes(year) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleYear(year)}
                    >
                      {year}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredOrders.length} / {(orders || []).length} rendelés
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Keresés (csak aktív sorokban)"
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as OrderStatus | 'all')}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Funnel className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes státusz</SelectItem>
              <SelectItem value="Felvéve">Felvéve</SelectItem>
              <SelectItem value="Szünetel">Szünetel</SelectItem>
              <SelectItem value="Kiszállítva">Kiszállítva</SelectItem>
              <SelectItem value="Csomagolás alatt">Csomagolás alatt</SelectItem>
              <SelectItem value="Folyamatban">Folyamatban</SelectItem>
              <SelectItem value="Előkészítve">Előkészítve</SelectItem>
              <SelectItem value="Javítás alatt">Javítás alatt</SelectItem>
              <SelectItem value="Elkészült">Elkészült</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button onClick={handleNewOrder}>
            <Plus className="w-5 h-5 mr-2" />
            Új rendelés
          </Button>
          {/* ── Expo-Impo lenyíló: tömeges import + sablon + export ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Export className="w-4 h-4" />
                Expo-Impo
                <CaretDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onSelect={() => setOrderBulkImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Tömeges Import (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  try {
                    await downloadOrderImportTemplate()
                    toast.success('Import sablon letöltve')
                  } catch {
                    toast.error('Sablon letöltése sikertelen')
                  }
                }}
              >
                <DownloadSimple className="w-4 h-4 mr-2" />
                Import sablon letöltése (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  if (!filteredOrders || filteredOrders.length === 0) {
                    toast.error('Nincs exportálható rendelés')
                    return
                  }
                  try {
                    await exportOrdersToExcel(filteredOrders)
                    toast.success(`${filteredOrders.length} rendelés exportálva`)
                  } catch {
                    toast.error('Export sikertelen')
                  }
                }}
              >
                <Export className="w-4 h-4 mr-2" />
                Összes rendelés exportálása
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedOrderIds.length === 0}
                onSelect={async () => {
                  const selected = (filteredOrders || []).filter((o) =>
                    selectedOrderIds.includes(o.id)
                  )
                  if (selected.length === 0) {
                    toast.error('Nincsenek kiválasztott rendelések')
                    return
                  }
                  try {
                    const today = new Date()
                    const d = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
                    await exportOrdersToExcel(selected, `rendeles_export_kivalasztott_${d}.xlsx`)
                    toast.success(`${selected.length} rendelés exportálva`)
                  } catch {
                    toast.error('Export sikertelen')
                  }
                }}
              >
                <Export className="w-4 h-4 mr-2" />
                Kijelölt rendelések exportálása
                {selectedOrderIds.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {selectedOrderIds.length} db
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Funnel className="w-4 h-4" />
                {activeOrderFilterId
                  ? orderColumnFilters?.find((f) => f.id === activeOrderFilterId)?.name ||
                    'Oszlop szűrő'
                  : 'Oszlop szűrő'}
                <CaretDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => setActiveOrderFilterId(null)}>
                Összes oszlop (alapértelmezett)
              </DropdownMenuItem>
              {(orderColumnFilters || []).map((filter) => (
                <DropdownMenuItem
                  key={filter.id}
                  onSelect={() => setActiveOrderFilterId(filter.id)}
                >
                  {filter.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" onClick={() => setNewOrderFilterDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Új szűrő
          </Button>

          {activeOrderFilterId && (
            <Button
              variant="destructive"
              onClick={() => {
                setOrderColumnFilters((current) =>
                  (current || []).filter((f) => f.id !== activeOrderFilterId)
                )
                setActiveOrderFilterId(null)
                toast.success('Szűrő törölve')
              }}
            >
              Szűrő törlése
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {selectedOrderIds.length > 0 && (
            <>
              {/* Dokumentáció készítés lenyíló */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Dokumentáció készítés
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled
                    className="font-semibold text-foreground opacity-100"
                  >
                    Szállítási dokumentumok
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleExportDelivery}
                    className="pl-6 gap-2 text-accent-foreground bg-accent/10 hover:bg-accent/20 focus:bg-accent/20"
                  >
                    <Truck className="w-4 h-4" />
                    Szállító (HTML)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleExportCmr}
                    className="pl-6 gap-2 text-secondary-foreground bg-secondary/10 hover:bg-secondary/20 focus:bg-secondary/20"
                  >
                    <FileText className="w-4 h-4" />
                    CMR (HTML)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      const { exportLabelsAsPDF } = await import('@/lib/labelExportFormats')
                      await exportLabelsAsPDF(
                        selectedOrders,
                        customers || [],
                        products || [],
                        activeTemplate,
                        labelTemplates || []
                      )
                    }}
                    className="pl-6 gap-2 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:bg-orange-100 dark:text-orange-300 dark:bg-orange-950/30 dark:hover:bg-orange-950/50"
                  >
                    <FilePdf className="w-4 h-4" />
                    Címke export PDF-be
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    className="font-semibold text-foreground opacity-100 mt-1"
                  >
                    Címke készítés
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setLabelPrintSettingsDialogOpen(true)}
                    className="pl-6"
                  >
                    Címkék nyomtatása (beállítások)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      generateLabels(
                        selectedOrders,
                        customers || [],
                        products || [],
                        activeTemplate
                      )
                    }}
                    className="pl-6"
                  >
                    Címkék generálása (HTML)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      await generateLabelsByCustomer(
                        selectedOrders,
                        customers || [],
                        products || [],
                        labelTemplates || []
                      )
                    }}
                    className="pl-6"
                  >
                    Címkék vevőnként (külön fájlok)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    className="font-semibold text-foreground opacity-100 mt-1"
                  >
                    Raklap cimke
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      generatePalletLabels(
                        selectedOrders,
                        customers || [],
                        products || [],
                        savedDeliveryTemplates || undefined
                      )
                    }}
                    className="pl-6 gap-2 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:bg-blue-100 dark:text-blue-300 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
                  >
                    <Package className="w-4 h-4" />
                    Raklap cimke nyomtatás
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {lastAction && (
            <Button variant="secondary" onClick={handleUndoLastAction}>
              <ArrowCounterClockwise className="w-5 h-5 mr-2" />
              Undo
            </Button>
          )}
          {selectedOrderIds.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default">
                    Státusz váltása ({selectedOrderIds.length})
                    <CaretDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Felvéve')
                      toast.success(`${selectedOrderIds.length} rendelés státusza: Felvéve`)
                    }}
                  >
                    Felvéve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Folyamatban')
                      toast.success(`${selectedOrderIds.length} rendelés státusza: Folyamatban`)
                    }}
                  >
                    Folyamatban
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Előkészítve')
                      toast.success(`${selectedOrderIds.length} rendelés státusza: Előkészítve`)
                    }}
                  >
                    Előkészítve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Csomagolás alatt')
                      toast.success(
                        `${selectedOrderIds.length} rendelés státusza: Csomagolás alatt`
                      )
                    }}
                  >
                    Csomagolás alatt
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Kiszállítva')
                      toast.success(`${selectedOrderIds.length} rendelés státusza: Kiszállítva`)
                    }}
                  >
                    Kiszállítva
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Szünetel')
                      toast.success(`${selectedOrderIds.length} rendelés státusza: Szünetel`)
                    }}
                  >
                    Szünetel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      handleBatchStatusChange(selectedOrderIds, 'Javítás alatt')
                      toast.success(`${selectedOrderIds.length} rendelés státusza: Javítás alatt`)
                    }}
                  >
                    Javítás alatt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="secondary" onClick={() => setSelectedOrderIds([])}>
                <X className="w-5 h-5 mr-2" />
                Kijelölés törlése
              </Button>
              <Button
                variant="secondary"
                onClick={handleEditOrder.bind(null, selectedOrderIds[0])}
                disabled={selectedOrderIds.length !== 1}
              >
                Kijelölt szerkesztése
              </Button>
              <Button
                variant="secondary"
                onClick={handleDuplicateOrder.bind(null, selectedOrderIds[0])}
                disabled={selectedOrderIds.length !== 1}
              >
                <CopySimple className="w-5 h-5 mr-2" />
                Kijelölt duplikálása
              </Button>
              <div className="ml-auto">
                <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                  Kijelöltek törlése ({selectedOrderIds.length})
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <OrdersTable
        orders={filteredOrders}
        products={products || []}
        onEdit={handleEditOrder}
        onDelete={handleDeleteOrder}
        onDuplicate={handleDuplicateOrder}
        onStatusChange={handleStatusChange}
        selectedIds={selectedOrderIds}
        onSelectionChange={setSelectedOrderIds}
        visibleColumns={
          activeOrderFilterId
            ? orderColumnFilters?.find((f) => f.id === activeOrderFilterId)?.columns
            : undefined
        }
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Törlés megerősítése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztos törölni akarod{' '}
              {selectedOrderIds.length === 1
                ? 'a kijelölt tételt'
                : `a kijelölt ${selectedOrderIds.length} tételt`}
              ? Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégsem</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                handleDeleteSelectedOrders()
                setDeleteConfirmOpen(false)
              }}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  )
}
