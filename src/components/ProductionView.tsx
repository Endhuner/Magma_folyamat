import { useMemo, useState } from 'react'
import { Order, OrderStatus, Product, ProductionShift, ProductionDefect } from '@/lib/types'
import { getPlannedHoursForOrder } from '@/lib/orderService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Package,
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Wrench,
  MagnifyingGlass,
  Funnel,
  Factory,
  Warning,
  Hammer,
  Info,
  CheckFat,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  detectMissingShifts,
  countMissingShiftsForOrder,
  type MissingShift,
} from '@/lib/shiftValidation'
import { ShiftValidationBanner } from '@/components/ShiftValidationBanner'
import { ProductionDetailDialog } from '@/components/production/ProductionDetailDialog'
import { QuickShiftEntryDialog } from '@/components/QuickShiftEntryDialog'
import {
  fmtInt,
  findProductForOrder,
  filterProductionOrders,
  searchOrders,
  filterByPriority,
  sortByDueDate,
  buildShiftsByOrder,
  groupOrdersByStatus,
  type PriorityFilter,
} from '@/lib/productionHelpers'

interface ProductionViewProps {
  orders: Order[]
  products: Product[]
  shifts: ProductionShift[]
  onStatusChange: (id: string, status: OrderStatus) => void
  onEdit: (id: string) => void
  onSaveShift: (shift: ProductionShift) => void
  onDeleteShift: (shiftId: string) => void
  /** Selejt-rögzítések — opcionálisan átfut a rendelési részlet ablakba. */
  defects?: ProductionDefect[]
  onSaveDefect?: (defect: ProductionDefect) => void
  onDeleteDefect?: (defectId: string) => void
  userId?: string
  machines?: import('@/lib/types').Machine[]
}

export function ProductionView({
  orders,
  products,
  shifts,
  onStatusChange,
  onEdit,
  onSaveShift,
  onDeleteShift,
  defects,
  onSaveDefect,
  onDeleteDefect,
  userId,
  machines,
}: ProductionViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [summaryOpen, setSummaryOpen] = useState(true)

  // Dialógus-állapotok a nézeten belül — egyszerűbb így, mint prop-ban felhúzni az App.tsx-ig.
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [quickEntry, setQuickEntry] = useState<MissingShift | null>(null)

  const findProduct = (order: Order): Product | undefined =>
    findProductForOrder(order, products)

  const productionOrders = useMemo(() => filterProductionOrders(orders), [orders])

  const missingShifts = useMemo(
    () => detectMissingShifts(orders, shifts),
    [orders, shifts]
  )

  const shiftsByOrder = useMemo(() => buildShiftsByOrder(shifts), [shifts])

  const filteredOrders = useMemo(() => {
    const searched = searchOrders(productionOrders, searchQuery)
    const prioritized = filterByPriority(searched, priorityFilter)
    return sortByDueDate(prioritized)
  }, [productionOrders, searchQuery, priorityFilter])

  const groupedOrders = useMemo(
    () => groupOrdersByStatus(filteredOrders),
    [filteredOrders]
  )

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'Felvéve':
        return 'bg-muted text-muted-foreground'
      case 'Folyamatban':
        return 'bg-accent text-accent-foreground'
      case 'Előkészítve':
        return 'bg-success text-success-foreground'
      case 'Szünetel':
        return 'bg-warning text-warning-foreground'
      case 'Javítás alatt':
        return 'bg-destructive text-destructive-foreground'
      case 'Elkészült':
        return 'bg-green-700 text-white'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'Felvéve':
        return <Clock className="w-4 h-4" weight="duotone" />
      case 'Folyamatban':
        return <PlayCircle className="w-4 h-4" weight="duotone" />
      case 'Előkészítve':
        return <CheckCircle className="w-4 h-4" weight="duotone" />
      case 'Szünetel':
        return <PauseCircle className="w-4 h-4" weight="duotone" />
      case 'Javítás alatt':
        return <Wrench className="w-4 h-4" weight="duotone" />
      case 'Elkészült':
        return <CheckFat className="w-4 h-4" weight="duotone" />
      default:
        return <Package className="w-4 h-4" weight="duotone" />
    }
  }

  const getPriorityBadge = (order: Order) => {
    if (!order.requiredDate) return null
    const requiredDate = new Date(order.requiredDate)
    const today = new Date()
    const daysUntilDue = Math.ceil(
      (requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilDue < 0) {
      return (
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Részletek megtekintése"
          onClick={() => setDetailOrderId(order.id)}
        >
          <Info className="w-5 h-5" weight="duotone" />
        </button>
      )
    } else if (daysUntilDue <= 3) {
      return <Badge variant="destructive" className="text-xs">Sürgős</Badge>
    } else if (daysUntilDue <= 7) {
      return (
        <Badge
          variant="default"
          className="text-xs bg-warning text-warning-foreground"
        >
          Fontos
        </Badge>
      )
    }
    return null
  }

  const renderOrderCard = (order: Order) => {
    const product = findProduct(order)
    const orderShifts = shiftsByOrder.get(order.id) ?? []
    const producedQty = orderShifts.reduce(
      (sum, s) => sum + (s.producedQuantity || 0),
      0
    )
    const totalShotsForOrder = orderShifts.reduce(
      (sum, s) => sum + (s.shotsCount || 0),
      0
    )
    const missingCount = countMissingShiftsForOrder(order.id, missingShifts)
    const progress =
      order.amountPc > 0
        ? Math.min(100, Math.round((producedQty / order.amountPc) * 100))
        : 0

    return (
      <Card key={order.id} className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[19px] font-bold truncate">
                {order.productName}
              </CardTitle>
              <p className="text-sm text-muted-foreground truncate">{order.customer}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {missingCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs border-warning/60 text-warning-foreground bg-warning/15"
                  title={`${missingCount} hiányzó műszakadat`}
                >
                  <Warning className="w-3 h-3 mr-1" weight="fill" />
                  {missingCount}
                </Badge>
              )}
              {getPriorityBadge(order)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rendelés szám:</span>
              <span className="font-mono font-medium">{order.orderNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saját szám:</span>
              <span className="font-mono font-medium">{order.ownOrderNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mennyiség:</span>
              <span className="font-semibold">{fmtInt(order.amountPc)} db</span>
            </div>
            {product && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rajzszám:</span>
                <span className="font-mono text-xs">{product.drawingNumber}</span>
              </div>
            )}

            {/* Gyártási haladás — csak akkor, ha van műszakadat */}
            {(orderShifts.length > 0 || order.amountPc > 0) && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Haladás</span>
                  <span className="font-mono">
                    {fmtInt(producedQty)} / {fmtInt(order.amountPc)} db
                    {order.amountPc > 0 && (
                      <span className="text-muted-foreground"> ({progress}%)</span>
                    )}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
                {totalShotsForOrder > 0 && (
                  <div className="text-[11px] text-muted-foreground">
                    {fmtInt(orderShifts.length)} műszak · {fmtInt(totalShotsForOrder)} lövés
                  </div>
                )}
              </div>
            )}

            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-[19px] font-bold text-muted-foreground">Határidő:</span>
              <span className="text-[19px] font-bold">
                {order.requiredDate
                  ? format(new Date(order.requiredDate), 'yyyy-MM-dd')
                  : '-'}
              </span>
            </div>
            {(() => { const ph = getPlannedHoursForOrder(order, products); return ph ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tervezett óra:</span>
                <span className="font-mono">{ph}h</span>
              </div>
            ) : null })()}
          </div>

          <div className="flex items-center gap-1 pt-2">
            {getStatusIcon(order.status)}
            <Badge className={getStatusColor(order.status)} variant="secondary">
              {order.status}
            </Badge>
          </div>

          <div className="pt-2">
            <Button
              size="lg"
              onClick={() => setDetailOrderId(order.id)}
              title="Gyártási műszakadatok rögzítése"
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              <Hammer className="w-5 h-5 mr-2" weight="fill" />
              Gyártás
              {missingCount > 0 && (
                <Badge
                  variant="outline"
                  className="ml-2 border-white/60 bg-white/15 text-white"
                  title={`${missingCount} hiányzó műszakadat`}
                >
                  <Warning className="w-3 h-3 mr-1" weight="fill" />
                  {missingCount}
                </Badge>
              )}
            </Button>
          </div>

          {order.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                {order.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderSection = (
    title: string,
    orders: Order[],
    icon: React.ReactNode,
    accentClass: string
  ) => (
    <section className="bg-card border rounded-lg overflow-hidden">
      <header
        className={`flex items-center gap-2 px-4 py-3 border-b ${accentClass}`}
      >
        {icon}
        <h3 className="font-semibold text-base">{title}</h3>
        <Badge variant="outline" className="ml-auto bg-background/80">
          {orders.length}
        </Badge>
      </header>
      <div className="p-4">
        {orders.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nincs {title.toLowerCase()} rendelés
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {orders.map(renderOrderCard)}
          </div>
        )}
      </div>
    </section>
  )

  const detailOrder = detailOrderId ? orders.find((o) => o.id === detailOrderId) ?? null : null
  const quickEntryOrder = quickEntry
    ? orders.find((o) => o.id === quickEntry.orderId) ?? null
    : null

  // ── Rendelésállomány összesítő ───────────────────────────────────────────
  // Termékenkénti aggregálás: mennyiség, szükséges anyag, kalkulált gyártási idő
  const summaryRows = useMemo(() => {
    const map = new Map<string, {
      productName: string
      totalQty: number
      totalMaterialKg: number
      totalHours: number
    }>()

    for (const order of productionOrders) {
      const key = order.productId || order.productName
      const existing = map.get(key)
      const product = findProduct(order)

      // Idő kalkuláció: dinamikusan a termék aktuális adataiból
      const plannedHoursStr = getPlannedHoursForOrder(order, products)
      const hours = parseFloat(plannedHoursStr) || 0

      const materialKg = parseFloat(order.requiredMaterialKg) || 0

      if (existing) {
        existing.totalQty += order.amountPc
        existing.totalMaterialKg += materialKg
        existing.totalHours += hours
      } else {
        map.set(key, {
          productName: order.productName,
          totalQty: order.amountPc,
          totalMaterialKg: materialKg,
          totalHours: hours,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty)
  }, [productionOrders, products])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Gyártás</h2>
          <p className="text-muted-foreground">
            Folyamatban lévő rendelések nyomon követése és műszakadatok rögzítése
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Factory className="w-5 h-5 mr-2" weight="duotone" />
            {productionOrders.length} aktív munka
          </Badge>
        </div>
      </div>

      <ShiftValidationBanner
        missing={missingShifts}
        onQuickEntry={(m) => setQuickEntry(m)}
      />

      {/* ── Rendelésállomány összesítő ── */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 border-b bg-muted/30 hover:bg-muted/50 transition-colors"
          onClick={() => setSummaryOpen((v) => !v)}
        >
          <div className="flex items-center gap-2 font-semibold text-base">
            <Factory className="w-5 h-5 text-accent" weight="duotone" />
            Rendelésállomány összesítő
            <span className="text-muted-foreground font-normal text-sm ml-1">
              ({summaryRows.length} termék)
            </span>
          </div>
          {summaryOpen
            ? <CaretUp className="w-4 h-4 text-muted-foreground" />
            : <CaretDown className="w-4 h-4 text-muted-foreground" />
          }
        </button>
        {summaryOpen && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Termék</th>
                  <th className="text-right px-4 py-2 font-medium">Rendelt (db)</th>
                  <th className="text-right px-4 py-2 font-medium">Szükséges anyag (kg)</th>
                  <th className="text-right px-4 py-2 font-medium">Kalkulált idő</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted-foreground">
                      Nincs aktív gyártási rendelés
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium">{row.productName}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtInt(row.totalQty)}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {row.totalMaterialKg > 0 ? `${row.totalMaterialKg.toFixed(1)} kg` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {row.totalHours > 0
                          ? row.totalHours >= 1
                            ? `${Math.round(row.totalHours)} ó`
                            : `${Math.round(row.totalHours * 60)} perc`
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {summaryRows.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/20 font-semibold">
                    <td className="px-4 py-2">Összesen</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {fmtInt(summaryRows.reduce((s, r) => s + r.totalQty, 0))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {summaryRows.reduce((s, r) => s + r.totalMaterialKg, 0) > 0
                        ? `${summaryRows.reduce((s, r) => s + r.totalMaterialKg, 0).toFixed(1)} kg`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {summaryRows.reduce((s, r) => s + r.totalHours, 0) > 0
                        ? `${Math.round(summaryRows.reduce((s, r) => s + r.totalHours, 0))} ó`
                        : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Keresés termék, vevő vagy rendelésszám szerint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={priorityFilter}
            onValueChange={(value: 'all' | 'urgent' | 'normal') =>
              setPriorityFilter(value)
            }
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Funnel className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes prioritás</SelectItem>
              <SelectItem value="urgent">Sürgős (7 nap)</SelectItem>
              <SelectItem value="normal">Normál (7+ nap)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {renderSection(
          'Folyamatban',
          groupedOrders.inProgress,
          <PlayCircle className="w-5 h-5 text-accent" weight="duotone" />,
          'bg-accent/10'
        )}
        {renderSection(
          'Felvéve',
          groupedOrders.pending,
          <Clock className="w-5 h-5 text-muted-foreground" weight="duotone" />,
          'bg-muted/40'
        )}
        {renderSection(
          'Előkészítve',
          groupedOrders.ready,
          <CheckCircle className="w-5 h-5 text-success" weight="duotone" />,
          'bg-success/10'
        )}
        {renderSection(
          'Szünetel',
          groupedOrders.paused,
          <PauseCircle className="w-5 h-5 text-warning" weight="duotone" />,
          'bg-warning/10'
        )}
        {renderSection(
          'Javítás alatt',
          groupedOrders.repair,
          <Wrench className="w-5 h-5 text-destructive" weight="duotone" />,
          'bg-destructive/10'
        )}
        {renderSection(
          'Elkészült',
          groupedOrders.done,
          <CheckFat className="w-5 h-5 text-green-600" weight="duotone" />,
          'bg-green-700/10'
        )}
      </div>

      {filteredOrders.length === 0 && searchQuery && (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Package
            className="w-16 h-16 text-muted-foreground mx-auto mb-4"
            weight="duotone"
          />
          <h3 className="text-xl font-semibold mb-2">Nincs találat</h3>
          <p className="text-muted-foreground">Próbáljon más keresési feltételt</p>
        </div>
      )}

      <ProductionDetailDialog
        open={!!detailOrder}
        onClose={() => setDetailOrderId(null)}
        order={detailOrder}
        product={detailOrder ? findProduct(detailOrder) : undefined}
        shifts={shifts}
        orders={orders}
        onSaveShift={onSaveShift}
        onDeleteShift={onDeleteShift}
        onStatusChange={onStatusChange}
        defects={defects}
        onSaveDefect={onSaveDefect}
        onDeleteDefect={onDeleteDefect}
        userId={userId}
        machines={machines}
      />

      <QuickShiftEntryDialog
        open={!!quickEntry}
        onClose={() => setQuickEntry(null)}
        order={quickEntryOrder}
        product={quickEntryOrder ? findProduct(quickEntryOrder) : undefined}
        date={quickEntry?.date ?? ''}
        shift={quickEntry?.shift ?? 'de'}
        onSave={(s) => {
          onSaveShift(s)
          setQuickEntry(null)
        }}
        userId={userId}
      />
    </div>
  )
}
