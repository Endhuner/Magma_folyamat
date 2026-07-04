/**
 * Mobil-optimalizált Gyártás nézet (PWA / kis kijelző).
 *
 * A workshopban dolgozók számára:
 *  - Egy oszlopos, érintőbarát kártyalista
 *  - Csoportonkénti redukálható szekciók (Folyamatban / Felvéve / ...)
 *  - Nagy "Gyártás" gomb minden kártyán → ProductionDetailDialog
 *  - Gyors "Megjegyzés" / javítás-jelzés rövid bottom-sheet-ből
 *  - Lebegő FAB a hibajelzés gyors rögzítéséhez (jelölhető rendelés)
 *
 * Az adatfolyam azonos a ProductionView-val (ugyanazok a propok), így a
 * cserélő logika App.tsx-ben (vagy egy „shell"-ben) csak képernyőméret szerint
 * dönti el, melyik komponens jelenjen meg.
 */
import { useMemo, useState } from 'react'
import { Order, OrderStatus, Product, ProductionShift, ProductionDefect } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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
  CaretDown,
  CaretUp,
  ChatCircle,
  StopCircle,
} from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  detectMissingShifts,
  countMissingShiftsForOrder,
  type MissingShift,
} from '@/lib/shiftValidation'
import { ShiftValidationBanner } from '@/components/ShiftValidationBanner'
import { ProductionDetailDialog } from '@/components/production/ProductionDetailDialog'
import { QuickShiftEntryDialog } from '@/components/QuickShiftEntryDialog'
import { useAppSetting } from '@/hooks/useAppSetting'
import { DEFAULT_WORK_CALENDAR, type WorkCalendarSettings } from '@/lib/workCalendar'
import {
  fmtInt,
  findProductForOrder,
  filterProductionOrders,
  searchOrders,
  filterByPriority,
  sortByDueDate,
  buildShiftsByOrder,
  type PriorityFilter,
} from '@/lib/productionHelpers'

interface MobileProductionViewProps {
  orders: Order[]
  products: Product[]
  shifts: ProductionShift[]
  onStatusChange: (id: string, status: OrderStatus) => void
  onEdit: (id: string) => void
  onSaveShift: (shift: ProductionShift) => void
  onDeleteShift: (shiftId: string) => void
  onUpdateOrderNotes?: (orderId: string, notes: string) => void
  /** Selejt-rögzítések (opcionális) — átfutnak a részletes nézetbe. */
  defects?: ProductionDefect[]
  onSaveDefect?: (defect: ProductionDefect) => void
  onDeleteDefect?: (defectId: string) => void
  userId?: string
}

const STATUS_GROUPS: Array<{
  key: 'inProgress' | 'pending' | 'ready' | 'paused' | 'repair' | 'done'
  title: string
  status: OrderStatus
  icon: React.ReactNode
  accent: string
}> = [
  {
    key: 'inProgress',
    title: 'Folyamatban',
    status: 'Folyamatban',
    icon: <PlayCircle className="w-5 h-5 text-accent" weight="duotone" />,
    accent: 'bg-accent/10',
  },
  {
    key: 'pending',
    title: 'Felvéve',
    status: 'Felvéve',
    icon: <Clock className="w-5 h-5 text-muted-foreground" weight="duotone" />,
    accent: 'bg-muted/40',
  },
  {
    key: 'ready',
    title: 'Előkészítve',
    status: 'Előkészítve',
    icon: <CheckCircle className="w-5 h-5 text-success" weight="duotone" />,
    accent: 'bg-success/10',
  },
  {
    key: 'paused',
    title: 'Szünetel',
    status: 'Szünetel',
    icon: <PauseCircle className="w-5 h-5 text-warning" weight="duotone" />,
    accent: 'bg-warning/10',
  },
  {
    key: 'repair',
    title: 'Javítás alatt',
    status: 'Javítás alatt',
    icon: <Wrench className="w-5 h-5 text-destructive" weight="duotone" />,
    accent: 'bg-destructive/10',
  },
  {
    key: 'done',
    title: 'Elkészült',
    status: 'Elkészült',
    icon: <CheckCircle className="w-5 h-5 text-green-600" weight="fill" />,
    accent: 'bg-green-700/10',
  },
]

export function MobileProductionView({
  orders,
  products,
  shifts,
  onStatusChange,
  onSaveShift,
  onDeleteShift,
  onUpdateOrderNotes,
  defects,
  onSaveDefect,
  onDeleteDefect,
  userId,
}: MobileProductionViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    inProgress: true,
    pending: false,
    ready: false,
    paused: false,
    repair: false,
    done: false,
  })
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [quickEntry, setQuickEntry] = useState<MissingShift | null>(null)
  const [noteOrderId, setNoteOrderId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const findProduct = (order: Order): Product | undefined =>
    findProductForOrder(order, products)

  const productionOrders = useMemo(() => filterProductionOrders(orders), [orders])

  const [workCalendar] = useAppSetting<WorkCalendarSettings>('work-calendar', DEFAULT_WORK_CALENDAR)
  const missingShifts = useMemo(() => detectMissingShifts(orders, shifts, { calendar: workCalendar }), [orders, shifts, workCalendar])

  const shiftsByOrder = useMemo(() => buildShiftsByOrder(shifts), [shifts])

  const filteredOrders = useMemo(() => {
    const searched = searchOrders(productionOrders, searchQuery)
    const prioritized = filterByPriority(searched, priorityFilter)
    return sortByDueDate(prioritized)
  }, [productionOrders, searchQuery, priorityFilter])

  const grouped = useMemo(
    () =>
      STATUS_GROUPS.reduce<Record<string, Order[]>>((acc, g) => {
        acc[g.key] = filteredOrders.filter((o) => o.status === g.status)
        return acc
      }, {}),
    [filteredOrders]
  )

  const detailOrder = detailOrderId
    ? orders.find((o) => o.id === detailOrderId) ?? null
    : null
  const quickEntryOrder = quickEntry
    ? orders.find((o) => o.id === quickEntry.orderId) ?? null
    : null
  const noteOrder = noteOrderId ? orders.find((o) => o.id === noteOrderId) ?? null : null

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const openNoteDialog = (order: Order) => {
    setNoteDraft(order.notes ?? '')
    setNoteOrderId(order.id)
  }

  const saveNote = () => {
    if (!noteOrderId) return
    if (onUpdateOrderNotes) {
      onUpdateOrderNotes(noteOrderId, noteDraft.trim())
      toast.success('Megjegyzés mentve')
    }
    setNoteOrderId(null)
  }

  const renderStatusQuickAction = (order: Order, label: string, next: OrderStatus) => {
    if (order.status === next) return null
    const colorMap: Record<string, string> = {
      Folyamatban: 'bg-emerald-600 hover:bg-emerald-700',
      Szünetel: 'bg-amber-600 hover:bg-amber-700',
      Előkészítve: 'bg-slate-600 hover:bg-slate-700',
    }
    const cls = colorMap[next] ?? 'bg-blue-600 hover:bg-blue-700'
    return (
      <Button
        size="sm"
        className={`flex-1 h-10 text-white ${cls}`}
        onClick={() => onStatusChange(order.id, next)}
      >
        {label}
      </Button>
    )
  }

  const renderCard = (order: Order) => {
    const product = findProduct(order)
    const orderShifts = shiftsByOrder.get(order.id) ?? []
    const producedQty = orderShifts.reduce((s, x) => s + (x.producedQuantity || 0), 0)
    const totalShots = orderShifts.reduce((s, x) => s + (x.shotsCount || 0), 0)
    const missingCount = countMissingShiftsForOrder(order.id, missingShifts)
    const progress =
      order.amountPc > 0 ? Math.min(100, Math.round((producedQty / order.amountPc) * 100)) : 0

    // Sürgősség
    let priorityChip: React.ReactNode = null
    if (order.requiredDate) {
      const days = Math.ceil(
        (new Date(order.requiredDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      if (days < 0) {
        priorityChip = (
          <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
            Késésben
          </Badge>
        )
      } else if (days <= 3) {
        priorityChip = (
          <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
            Sürgős
          </Badge>
        )
      } else if (days <= 7) {
        priorityChip = (
          <Badge className="text-[10px] uppercase tracking-wide bg-warning text-warning-foreground">
            Fontos
          </Badge>
        )
      }
    }

    return (
      <Card key={order.id} className="overflow-hidden">
        <CardContent className="p-3 space-y-3">
          {/* Fejléc */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base leading-tight truncate">
                {order.productName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {order.customer}
                {product?.drawingNumber ? ` • ${product.drawingNumber}` : ''}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {priorityChip}
              {missingCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-warning/60 text-warning-foreground bg-warning/15"
                >
                  <Warning className="w-3 h-3 mr-0.5" weight="fill" />
                  {missingCount}
                </Badge>
              )}
            </div>
          </div>

          {/* Mennyiség / haladás */}
          {order.amountPc > 0 && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  {fmtInt(producedQty)}{' '}
                  <span className="text-muted-foreground font-normal">
                    / {fmtInt(order.amountPc)} db
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              {totalShots > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {fmtInt(orderShifts.length)} műszak · {fmtInt(totalShots)} lövés
                </div>
              )}
            </div>
          )}

          {/* Határidő + saját szám */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Határidő:{' '}
              <span className="font-semibold text-foreground">
                {order.requiredDate
                  ? format(new Date(order.requiredDate), 'yyyy-MM-dd')
                  : '-'}
              </span>
            </span>
            {order.ownOrderNumber && (
              <span className="font-mono">{order.ownOrderNumber}</span>
            )}
          </div>

          {/* Gyors állapot-váltás */}
          <div className="flex gap-2">
            {renderStatusQuickAction(order, 'Indítás', 'Folyamatban')}
            {renderStatusQuickAction(order, 'Szünet', 'Szünetel')}
            {renderStatusQuickAction(order, 'Leállít', 'Előkészítve')}
          </div>

          {/* Fő gomb: gyártási műszak rögzítés (megnyitja a dialógust) */}
          <div className="flex gap-2">
            <Button
              size="lg"
              onClick={() => setDetailOrderId(order.id)}
              className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow"
            >
              <Hammer className="w-5 h-5 mr-2" weight="fill" />
              Gyártás
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => openNoteDialog(order)}
              className="h-12 px-4"
              aria-label="Megjegyzés / Javítás jelölése"
              title="Megjegyzés / Javítás jelölése"
            >
              <ChatCircle className="w-5 h-5" weight="duotone" />
            </Button>
          </div>

          {order.notes && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground line-clamp-3">
              {order.notes}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const totalActive = productionOrders.length

  return (
    <div className="space-y-4 pb-24">
      {/* Sticky header — kompakt mobilra */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-5 h-5" weight="duotone" />
            Gyártás
          </h2>
          <Badge variant="outline" className="text-sm">
            {totalActive} aktív
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Keresés termék, vevő, rendelésszám..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
              inputMode="search"
            />
          </div>
          <Select
            value={priorityFilter}
            onValueChange={(v: 'all' | 'urgent' | 'normal') => setPriorityFilter(v)}
          >
            <SelectTrigger className="w-full h-10">
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

      {/* Hiányzó műszakadat banner — mobilra is */}
      <ShiftValidationBanner
        missing={missingShifts}
        onQuickEntry={(m) => setQuickEntry(m)}
      />

      {/* Csoportosított szekciók (összecsukható) */}
      {STATUS_GROUPS.map((g) => {
        const list = grouped[g.key] ?? []
        const open = openSections[g.key]
        return (
          <section key={g.key} className="bg-card border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(g.key)}
              className={`w-full flex items-center gap-2 px-3 py-3 ${g.accent} active:opacity-80`}
            >
              {g.icon}
              <span className="font-semibold text-sm flex-1 text-left">{g.title}</span>
              <Badge variant="outline" className="bg-background/80">
                {list.length}
              </Badge>
              {open ? (
                <CaretUp className="w-4 h-4 text-muted-foreground" weight="bold" />
              ) : (
                <CaretDown className="w-4 h-4 text-muted-foreground" weight="bold" />
              )}
            </button>
            {open && (
              <div className="p-3 space-y-3 border-t">
                {list.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Nincs {g.title.toLowerCase()} rendelés
                  </div>
                ) : (
                  list.map(renderCard)
                )}
              </div>
            )}
          </section>
        )
      })}

      {filteredOrders.length === 0 && searchQuery && (
        <div className="text-center py-12 border rounded-lg bg-card">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
          <h3 className="text-base font-semibold mb-1">Nincs találat</h3>
          <p className="text-sm text-muted-foreground">Próbáljon más keresési feltételt</p>
        </div>
      )}

      {/* Műszakadat-rögzítés dialógus (közös a desktop nézettel) */}
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

      {/* Megjegyzés / javítás-jelzés bottom sheet */}
      <Drawer open={!!noteOrder} onOpenChange={(o) => !o && setNoteOrderId(null)}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <ChatCircle className="w-5 h-5" weight="duotone" />
              Megjegyzés / javítás
            </DrawerTitle>
            <DrawerDescription>
              {noteOrder?.productName} — {noteOrder?.customer}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 space-y-3">
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={5}
              placeholder="Pl. szerszámcsere szükséges, idegen anyag a granulátumban, ..."
              className="text-base"
            />
            {noteOrder && (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={() => {
                  if (!noteOrder) return
                  onStatusChange(noteOrder.id, 'Javítás alatt')
                  toast.success('Rendelés javításra állítva')
                  setNoteOrderId(null)
                }}
                disabled={noteOrder.status === 'Javítás alatt'}
              >
                <StopCircle className="w-5 h-5 mr-2" weight="fill" />
                {noteOrder.status === 'Javítás alatt'
                  ? 'Már javítás alatt'
                  : 'Javításra állít'}
              </Button>
            )}
          </div>
          <DrawerFooter className="pt-2">
            <Button onClick={saveNote} className="h-12 text-base">
              Mentés
            </Button>
            <Button
              variant="outline"
              onClick={() => setNoteOrderId(null)}
              className="h-12 text-base"
            >
              Mégse
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
