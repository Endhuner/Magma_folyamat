import { memo, useEffect, useMemo, useState } from 'react'
import { Order, OrderStatus, Product } from '@/lib/types'
import { getPlannedHoursForOrder } from '@/lib/orderService'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash, Package, CopySimple, PushPin } from '@phosphor-icons/react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { ORDERS_TABLE_PAGE_SIZE, VIRTUAL_ROW_STYLE } from '@/lib/virtualRow'
import { useKV } from '@/hooks/useKV'

interface OrdersTableProps {
  orders: Order[]
  products?: Product[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onStatusChange: (id: string, status: OrderStatus) => void
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  visibleColumns?: string[]
  /** Becsült alapanyag-készlet (kg) — az összesítő sáv fedezet-jelzéséhez. */
  materialEstimateKg?: number | null
}

const STATUS_OPTIONS: OrderStatus[] = [
  'Felvéve',
  'Szünetel',
  'Kiszállítva',
  'Kiszállítva/Számlázva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
  'Elkészült',
]

const STATUS_COLORS: Record<OrderStatus, string> = {
  'Felvéve': 'oklch(0.95 0.05 85)',
  'Szünetel': 'oklch(0.95 0.05 85)',
  'Kiszállítva': 'oklch(0.92 0.08 145)',
  'Kiszállítva/Számlázva': 'oklch(0.88 0.12 145)',
  'Csomagolás alatt': 'oklch(0.93 0.08 55)',
  'Folyamatban': 'oklch(0.90 0.08 155)',
  'Előkészítve': 'oklch(0.91 0.08 230)',
  'Javítás alatt': 'oklch(0.93 0.08 350)',
  'Elkészült': 'oklch(0.88 0.10 145)',
}

function OrdersTableImpl({ orders, products, onEdit, onDelete, onDuplicate, onStatusChange, selectedIds, onSelectionChange, visibleColumns, materialEstimateKg }: OrdersTableProps) {
  const [sortField, setSortField] = useState<keyof Order | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  /**
   * Soft pagináció: ha a rendelések száma `ORDERS_TABLE_PAGE_SIZE` fölött van,
   * elsőre csak az első N sort rendereljük, és egy "Mind mutatása" gomb kéri
   * a többit. Ez biztosítja, hogy az első festés gyors maradjon akár 10k+
   * sornál is. A `content-visibility: auto` mellett ez a "biztonsági öv" —
   * ha a böngésző nem támogatja a content-visibility-t, a pagináció akkor is
   * megvédi a felhasználót.
   */
  const [showAll, setShowAll] = useState(false)

  /**
   * "Termék neve" oszlop rögzítése: vízszintes görgetésnél a bal szélre
   * tapad (CSS: .pinned-col az index.css-ben). Perzisztens, gépenként.
   */
  const [pinnedProductCol, setPinnedProductCol] = useKV<boolean>('orders-pinned-product-column', false)

  const isColumnVisible = (columnId: string) => {
    if (!visibleColumns || visibleColumns.length === 0) return true
    return visibleColumns.includes(columnId)
  }

  // Termék-térkép id szerint — a megnevezést/rajzszámot az ÉLŐ termékből
  // olvassuk (mint a címke), nem a rendelésbe régen bemásolt értékből, így a
  // termék szerkesztése azonnal helyesen látszik a táblázatban is.
  const productById = useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p])),
    [products]
  )

  const sortedOrders = useMemo(() => {
    if (!sortField) return orders

    return [...orders].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'hu')
        return sortDirection === 'asc' ? comparison : -comparison
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })
  }, [orders, sortField, sortDirection])

  /**
   * Ha új szűrés / új szortírozás után a sorszám visszaesett a küszöb alá,
   * automatikusan kapcsoljuk vissza az "összes mutatása" módot — különben a
   * gomb megmaradna feleslegesen.
   */
  useEffect(() => {
    if (sortedOrders.length <= ORDERS_TABLE_PAGE_SIZE && showAll) {
      setShowAll(false)
    }
  }, [sortedOrders.length, showAll])

  /** A ténylegesen renderelt (DOM-ba kerülő) sorok — pagináltan vagy mind. */
  const visibleOrders = useMemo(() => {
    if (showAll || sortedOrders.length <= ORDERS_TABLE_PAGE_SIZE) {
      return sortedOrders
    }
    return sortedOrders.slice(0, ORDERS_TABLE_PAGE_SIZE)
  }, [sortedOrders, showAll])

  const hasMoreRows = sortedOrders.length > visibleOrders.length

  const handleSort = (field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedOrders.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(sortedOrders.map(o => o.id))
    }
  }

  const summary = useMemo(() => {
    const ordersToSummarize = selectedIds.length > 0 
      ? sortedOrders.filter(o => selectedIds.includes(o.id))
      : sortedOrders
    
    const totalAmount = ordersToSummarize.reduce((sum, o) => sum + (o.amountPc || 0), 0)
    const totalBoxes = ordersToSummarize.reduce((sum, o) => sum + (o.boxesCount || 0), 0)
    const totalPallets = ordersToSummarize.reduce((sum, o) => sum + (o.palletsCount || 0), 0)
    
    const parseKg = (str: string): number => {
      if (!str) return 0
      const match = String(str).match(/[\d.,]+/)
      if (!match) return 0
      return parseFloat(match[0].replace(',', '.'))
    }
    
    const parseHours = (str: string): number => {
      if (!str) return 0
      const match = String(str).match(/[\d.,]+/)
      if (!match) return 0
      return parseFloat(match[0].replace(',', '.'))
    }
    
    const totalGrossWeight = ordersToSummarize.reduce((sum, o) => sum + parseKg(o.grossWeightKg), 0)
    const totalRequiredMaterial = ordersToSummarize.reduce((sum, o) => sum + parseKg(o.requiredMaterialKg), 0)
    const totalPlannedHours = ordersToSummarize.reduce((sum, o) => sum + parseHours(getPlannedHoursForOrder(o, products ?? [])), 0)
    
    return {
      count: ordersToSummarize.length,
      totalAmount,
      totalBoxes,
      totalPallets,
      totalGrossWeight: totalGrossWeight.toFixed(1) + ' kg',
      totalRequiredMaterial: totalRequiredMaterial.toFixed(1) + ' kg',
      totalPlannedHours: Math.round(totalPlannedHours) + ' óra',
    }
  }, [sortedOrders, selectedIds])

  if (sortedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
        <h3 className="text-xl font-semibold mb-2">Nincs rendelés</h3>
        <p className="text-muted-foreground">Hozzon létre rendeléseket a kereskedelem nyomon követéséhez</p>
      </div>
    )
  }

  return (
    <>


      <div className="border rounded-lg mb-4">
        <ScrollArea className="w-full whitespace-nowrap pin-scroll-host">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedIds.length === sortedOrders.length && sortedOrders.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {isColumnVisible('customer') && <TableHead className="cursor-pointer" onClick={() => handleSort('customer')}>Vevő</TableHead>}
                {isColumnVisible('productName') && (
                  <TableHead
                    className={pinnedProductCol ? 'cursor-pointer pinned-col' : 'cursor-pointer'}
                    onClick={() => handleSort('productName')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Termék neve
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title={pinnedProductCol ? 'Oszlop rögzítésének feloldása' : 'Oszlop rögzítése görgetéskor'}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPinnedProductCol((v) => !v)
                        }}
                      >
                        <PushPin
                          className={pinnedProductCol ? 'w-4 h-4 text-accent' : 'w-4 h-4 text-muted-foreground'}
                          weight={pinnedProductCol ? 'fill' : 'regular'}
                        />
                      </Button>
                    </span>
                  </TableHead>
                )}
                {isColumnVisible('designation') && <TableHead className="cursor-pointer" onClick={() => handleSort('designation')}>Megnevezése</TableHead>}
                {isColumnVisible('notes') && <TableHead>Megjegyzés</TableHead>}
                {isColumnVisible('pos') && <TableHead className="cursor-pointer" onClick={() => handleSort('pos')}>Pos</TableHead>}
                {isColumnVisible('ownOrderNumber') && <TableHead className="cursor-pointer" onClick={() => handleSort('ownOrderNumber')}>Saját rendelési szám</TableHead>}
                {isColumnVisible('material') && <TableHead className="cursor-pointer" onClick={() => handleSort('material')}>Anyag</TableHead>}
                {isColumnVisible('orderNumber') && <TableHead className="cursor-pointer" onClick={() => handleSort('orderNumber')}>Vevő rendelési száma</TableHead>}
                {isColumnVisible('amountPc') && <TableHead className="cursor-pointer" onClick={() => handleSort('amountPc')}>Mennyiség (db)</TableHead>}
                {isColumnVisible('orderDate') && <TableHead className="cursor-pointer" onClick={() => handleSort('orderDate')}>Rendelés dátuma</TableHead>}
                {isColumnVisible('requiredDate') && <TableHead className="cursor-pointer" onClick={() => handleSort('requiredDate')}>Szükséges szállítási dátum</TableHead>}
                {isColumnVisible('pickupDate') && <TableHead className="cursor-pointer" onClick={() => handleSort('pickupDate')}>CMR / Szállítólevél dátuma</TableHead>}
                {isColumnVisible('invoiced') && <TableHead className="cursor-pointer" onClick={() => handleSort('invoiced')}>Számlázva</TableHead>}
                {isColumnVisible('ready') && <TableHead className="cursor-pointer" onClick={() => handleSort('ready')}>Szállításra kész</TableHead>}
                {isColumnVisible('surfaceTreatment') && <TableHead className="cursor-pointer" onClick={() => handleSort('surfaceTreatment')}>Felületkezelés</TableHead>}
                {isColumnVisible('boxesCount') && <TableHead className="cursor-pointer" onClick={() => handleSort('boxesCount')}>Dobozok száma</TableHead>}
                {isColumnVisible('palletsCount') && <TableHead className="cursor-pointer" onClick={() => handleSort('palletsCount')}>Össz raklapok száma</TableHead>}
                {isColumnVisible('grossWeightKg') && <TableHead className="cursor-pointer" onClick={() => handleSort('grossWeightKg')}>Össz bruttó súly</TableHead>}
                {isColumnVisible('requiredMaterialKg') && <TableHead className="cursor-pointer" onClick={() => handleSort('requiredMaterialKg')}>Szükséges anyagmennyiség</TableHead>}
                {isColumnVisible('plannedProductionHours') && <TableHead className="cursor-pointer" onClick={() => handleSort('plannedProductionHours')}>Tervezett gyártási idő</TableHead>}
                {isColumnVisible('deliveryNote') && <TableHead className="cursor-pointer" onClick={() => handleSort('deliveryNote')}>Szállítólevél</TableHead>}
                {isColumnVisible('cmr') && <TableHead className="cursor-pointer" onClick={() => handleSort('cmr')}>CMR</TableHead>}
                {isColumnVisible('status') && <TableHead className="min-w-[200px]">Státusz</TableHead>}
                <TableHead className="w-[120px]">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleOrders.map((order) => {
                // Élő termék a megnevezés/rajzszám kijelzéséhez (fallback: tárolt érték)
                const liveProduct = order.productId ? productById.get(order.productId) : undefined
                return (
                  <TableRow
                    key={order.id}
                    className="even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]"
                    style={VIRTUAL_ROW_STYLE}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(order.id)}
                        onCheckedChange={() => toggleSelection(order.id)}
                      />
                    </TableCell>
                    {isColumnVisible('customer') && <TableCell className="font-medium">{order.customer}</TableCell>}
                    {isColumnVisible('productName') && <TableCell className={pinnedProductCol ? 'pinned-col' : undefined}>{liveProduct?.drawingNumber || order.productName}</TableCell>}
                    {isColumnVisible('designation') && <TableCell>{liveProduct?.productName || order.designation}</TableCell>}
                  {isColumnVisible('notes') && <TableCell className="max-w-[200px]">
                    <div className="truncate" title={order.notes}>{order.notes}</div>
                  </TableCell>}
                  {isColumnVisible('pos') && <TableCell className="text-center font-mono">{order.pos ?? ''}</TableCell>}
                  {isColumnVisible('ownOrderNumber') && <TableCell>{order.ownOrderNumber}</TableCell>}
                  {isColumnVisible('material') && <TableCell>{order.material}</TableCell>}
                  {isColumnVisible('orderNumber') && <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>}
                  {isColumnVisible('amountPc') && <TableCell className="font-mono">{order.amountPc != null ? order.amountPc.toLocaleString('hu-HU') : ''}</TableCell>}
                  {isColumnVisible('orderDate') && <TableCell>{order.orderDate}</TableCell>}
                  {isColumnVisible('requiredDate') && <TableCell>{order.requiredDate}</TableCell>}
                  {isColumnVisible('pickupDate') && <TableCell>{order.pickupDate}</TableCell>}
                  {isColumnVisible('invoiced') && <TableCell>{order.invoiced}</TableCell>}
                  {isColumnVisible('ready') && <TableCell>{order.ready}</TableCell>}
                  {isColumnVisible('surfaceTreatment') && <TableCell>{order.surfaceTreatment}</TableCell>}
                  {isColumnVisible('boxesCount') && <TableCell>{order.boxesCount}</TableCell>}
                  {isColumnVisible('palletsCount') && <TableCell>{order.palletsCount}</TableCell>}
                  {isColumnVisible('grossWeightKg') && <TableCell>{order.grossWeightKg}</TableCell>}
                  {isColumnVisible('requiredMaterialKg') && <TableCell>{order.requiredMaterialKg}</TableCell>}
                  {isColumnVisible('plannedProductionHours') && <TableCell>{getPlannedHoursForOrder(order, products ?? [])}</TableCell>}
                  {isColumnVisible('deliveryNote') && <TableCell>{order.deliveryNote}</TableCell>}
                  {isColumnVisible('cmr') && <TableCell>{order.cmr}</TableCell>}
                  {isColumnVisible('status') && <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(value) => onStatusChange(order.id, value as OrderStatus)}
                    >
                      <SelectTrigger 
                        className="min-w-[200px]" 
                        style={{ 
                          backgroundColor: STATUS_COLORS[order.status] || '#ffffff',
                          border: '1px solid oklch(0.88 0.005 250)',
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(order.id)}
                        title="Szerkesztés"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicate(order.id)}
                        title="Duplikálás"
                      >
                        <CopySimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(order.id)}
                        title="Törlés"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {hasMoreRows && (
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/40 text-sm">
            <span className="text-muted-foreground">
              Az első <strong>{visibleOrders.length}</strong> sor látszik a(z) {sortedOrders.length} szűrt rendelésből.
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
              Mind mutatása ({sortedOrders.length})
            </Button>
          </div>
        )}
      </div>

      {/* Térköz, hogy a táblázat utolsó sorai a lebegő összesítő sáv fölé
          görgethetők legyenek (telefonon a sáv 2 sorba törhet → nagyobb). */}
      <div aria-hidden className="h-20 md:h-12" />

      {/* Kompakt, egysoros összesítő sáv ("A" variáció) — mindig látszik,
          de csak ~40px magas, így nem takarja el a táblázat alját. */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 border-t border-accent/50 backdrop-blur-sm z-10">
        <div className="container mx-auto px-3 md:px-6 py-1.5 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-sm leading-tight">
          <span className="font-semibold whitespace-nowrap">
            {selectedIds.length > 0 ? `${summary.count} kijelölt` : `${summary.count} szűrt`}:
          </span>
          <span className="whitespace-nowrap"><b className="font-mono">{summary.totalAmount}</b> <span className="text-muted-foreground">db</span></span>
          <span className="whitespace-nowrap"><b className="font-mono">{summary.totalBoxes}</b> <span className="text-muted-foreground">doboz</span></span>
          <span className="whitespace-nowrap"><b className="font-mono">{summary.totalPallets}</b> <span className="text-muted-foreground">raklap</span></span>
          <span className="whitespace-nowrap"><b className="font-mono">{summary.totalGrossWeight}</b> <span className="text-muted-foreground">bruttó</span></span>
          <span className="whitespace-nowrap">
            <b className="font-mono">{summary.totalRequiredMaterial}</b>{' '}
            <span className="text-muted-foreground">anyag</span>
            {typeof materialEstimateKg === 'number' && (
              // Anyag-fedezet: a szűrt/kijelölt rendelések igénye vs. a becsült
              // alapanyag-készlet (a MaterialPanel élő becslése alapján).
              <span className={parseFloat(summary.totalRequiredMaterial) <= materialEstimateKg ? 'text-success' : 'text-destructive font-semibold'}>
                {' '}/ ~{materialEstimateKg.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} kg készleten{' '}
                {parseFloat(summary.totalRequiredMaterial) <= materialEstimateKg ? '✓' : '✗'}
              </span>
            )}
          </span>
          <span className="whitespace-nowrap"><b className="font-mono">{summary.totalPlannedHours}</b> <span className="text-muted-foreground">gyártás</span></span>
        </div>
      </div>
    </>
  )
}

/**
 * `React.memo` wrapper — Orders táblázat újrarenderelést csak akkor enged, ha
 * a propsok referenciája változott. Az App.tsx-ben filteredOrders, products,
 * selectedIds, visibleColumns mind useMemo-zott — így ez a memoizáció
 * megakadályozza, hogy egy másik tab (pl. Inventory) state-frissítése
 * újrarajzolja az egész Rendelések táblát.
 */
export const OrdersTable = memo(OrdersTableImpl)
