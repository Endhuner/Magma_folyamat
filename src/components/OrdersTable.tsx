import { CSSProperties, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { kvStore } from '@/lib/kvStore'
import { cn } from '@/lib/utils'
import { buildProductIndex, pricesForOrder, type OrderPiecePrices } from '@/lib/materialPriceCalc'
import type { PriceList } from '@/lib/types'

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
  /** Vevői árlisták — az aktuális darabár és a rendelt érték oszlopokhoz. */
  priceLists?: PriceList[]
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

/**
 * Oszlop-definíciók megjelenítési sorrendben — a fejléc ebből renderel,
 * és a rögzített (sticky) oszlopok bal-offszete is ebben a sorrendben
 * halmozódik. A cellák tartalma egyedi, az a törzsben marad kézzel írva.
 */
const COLUMNS: Array<{ id: string; label: string; sortable?: boolean; headClass?: string }> = [
  { id: 'customer', label: 'Vevő' },
  { id: 'productName', label: 'Termék neve' },
  { id: 'designation', label: 'Megnevezése' },
  { id: 'notes', label: 'Megjegyzés', sortable: false },
  { id: 'pos', label: 'Pos' },
  { id: 'ownOrderNumber', label: 'Saját rendelési szám' },
  { id: 'material', label: 'Anyag' },
  { id: 'orderNumber', label: 'Vevő rendelési száma' },
  { id: 'amountPc', label: 'Mennyiség (db)' },
  { id: 'currentUnitPrice', label: 'Aktuális ár (€/db)', sortable: false },
  { id: 'currentValue', label: 'Rendelt érték (€)', sortable: false },
  { id: 'currentLaborValue', label: 'Rendelt munkadíj (€)', sortable: false },
  { id: 'orderDate', label: 'Rendelés dátuma' },
  { id: 'requiredDate', label: 'Szükséges szállítási dátum' },
  { id: 'pickupDate', label: 'CMR / Szállítólevél dátuma' },
  { id: 'invoiced', label: 'Számlázva' },
  { id: 'ready', label: 'Szállításra kész' },
  { id: 'surfaceTreatment', label: 'Felületkezelés' },
  { id: 'boxesCount', label: 'Dobozok száma' },
  { id: 'palletsCount', label: 'Össz raklapok száma' },
  { id: 'grossWeightKg', label: 'Össz bruttó súly' },
  { id: 'requiredMaterialKg', label: 'Szükséges anyagmennyiség' },
  { id: 'plannedProductionHours', label: 'Tervezett gyártási idő' },
  { id: 'deliveryNote', label: 'Szállítólevél' },
  { id: 'cmr', label: 'CMR' },
  { id: 'status', label: 'Státusz', sortable: false, headClass: 'min-w-[200px]' },
]

function OrdersTableImpl({ orders, products, onEdit, onDelete, onDuplicate, onStatusChange, selectedIds, onSelectionChange, visibleColumns, materialEstimateKg, priceLists }: OrdersTableProps) {
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
   * Rögzített oszlopok: vízszintes görgetésnél a bal szélre tapadnak
   * (CSS: .pinned-col az index.css-ben), több oszlop egymás mellé áll.
   * Perzisztens, gépenként. A korábbi egy-oszlopos beállítást
   * ('orders-pinned-product-column') első futáskor átvesszük.
   */
  const [pinnedCols, setPinnedCols] = useKV<string[]>(
    'orders-pinned-columns',
    kvStore.get<boolean>('orders-pinned-product-column') ? ['productName'] : []
  )
  const pinnedSet = useMemo(() => new Set(pinnedCols), [pinnedCols])

  const isColumnVisible = (columnId: string) => {
    if (!visibleColumns || visibleColumns.length === 0) return true
    return visibleColumns.includes(columnId)
  }

  const togglePin = (id: string) =>
    setPinnedCols((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]))

  /** Rögzített ÉS látható oszlopok, megjelenítési sorrendben. */
  const pinnedVisible = COLUMNS.filter((c) => pinnedSet.has(c.id) && isColumnVisible(c.id)).map((c) => c.id)
  const lastPinnedId = pinnedVisible[pinnedVisible.length - 1]

  const pinCls = (id: string) =>
    pinnedSet.has(id) ? (id === lastPinnedId ? 'pinned-col pinned-col-last' : 'pinned-col') : undefined
  const pinStyle = (id: string): CSSProperties | undefined =>
    pinnedSet.has(id) ? { left: `var(--pin-l-${id}, 0px)` } : undefined

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

  /**
   * A rögzített oszlopok bal-offszetjei: mindegyik annyival beljebb tapad,
   * amekkora az előtte rögzített oszlopok összszélessége. A szélességeket a
   * fejléc-cellákról mérjük, és CSS-változóként tesszük a táblázat köré —
   * így soronként nem kell semmit számolni. ResizeObserver követi, ha a
   * tartalom miatt változik egy oszlop szélessége; a `visibleOrders` függőség
   * pedig azt fedi le, amikor a táblázat (újra) felépül az adatok érkezésekor.
   */
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const wrap = tableWrapRef.current
    if (!wrap || pinnedVisible.length === 0) return
    const ths = pinnedVisible
      .map((id) => [id, wrap.querySelector<HTMLElement>(`th[data-col="${id}"]`)] as const)
      .filter((pair): pair is [string, HTMLElement] => !!pair[1])
    const update = () => {
      let acc = 0
      for (const [id, th] of ths) {
        wrap.style.setProperty(`--pin-l-${id}`, `${acc}px`)
        acc += th.getBoundingClientRect().width
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ths.forEach(([, th]) => ro.observe(th))
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedVisible.join('|'), visibleColumns, visibleOrders])

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

  // Rendelésenkénti aktuális darabár a vevői árlistákból (élő termék-súllyal).
  const priceByOrderId = useMemo(() => {
    const map = new Map<string, OrderPiecePrices>()
    if (!priceLists || priceLists.length === 0) return map
    const idx = buildProductIndex(products || [])
    for (const o of orders) {
      const prices = pricesForOrder(o, priceLists, idx)
      if (prices != null) map.set(o.id, prices)
    }
    return map
  }, [orders, products, priceLists])

  const summary = useMemo(() => {
    const ordersToSummarize = selectedIds.length > 0 
      ? sortedOrders.filter(o => selectedIds.includes(o.id))
      : sortedOrders
    
    const totalAmount = ordersToSummarize.reduce((sum, o) => sum + (o.amountPc || 0), 0)
    // Rendelt érték: aktuális darabár × mennyiség (csak az áras rendeléseknél).
    let totalValueEur = 0
    let totalLaborEur = 0
    let pricedCount = 0
    for (const o of ordersToSummarize) {
      const price = priceByOrderId.get(o.id)
      if (price != null && o.amountPc) {
        totalValueEur += price.currentPerPiece * o.amountPc
        totalLaborEur += price.laborPerPiece * o.amountPc
        pricedCount++
      }
    }
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
      totalValueEur,
      totalLaborEur,
      pricedCount,
      totalAmount,
      totalBoxes,
      totalPallets,
      totalGrossWeight: totalGrossWeight.toFixed(1) + ' kg',
      totalRequiredMaterial: totalRequiredMaterial.toFixed(1) + ' kg',
      totalPlannedHours: Math.round(totalPlannedHours) + ' óra',
    }
  }, [sortedOrders, selectedIds, priceByOrderId])

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


      <div className="border rounded-lg mb-4" ref={tableWrapRef}>
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
                {COLUMNS.map((col) => {
                  if (!isColumnVisible(col.id)) return null
                  const pinned = pinnedSet.has(col.id)
                  return (
                    <TableHead
                      key={col.id}
                      data-col={col.id}
                      className={cn('group', col.headClass, col.sortable !== false && 'cursor-pointer', pinCls(col.id))}
                      style={pinStyle(col.id)}
                      onClick={col.sortable !== false ? () => handleSort(col.id as keyof Order) : undefined}
                    >
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        {col.label}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('h-6 w-6 p-0 shrink-0', !pinned && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
                          title={pinned ? 'Oszlop rögzítésének feloldása' : 'Oszlop rögzítése görgetéskor'}
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePin(col.id)
                          }}
                        >
                          <PushPin
                            className={pinned ? 'w-4 h-4 text-accent' : 'w-4 h-4 text-muted-foreground'}
                            weight={pinned ? 'fill' : 'regular'}
                          />
                        </Button>
                      </span>
                    </TableHead>
                  )
                })}
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
                    {isColumnVisible('customer') && <TableCell className={cn('font-medium', pinCls('customer'))} style={pinStyle('customer')}>{order.customer}</TableCell>}
                    {isColumnVisible('productName') && <TableCell className={pinCls('productName')} style={pinStyle('productName')}>{liveProduct?.drawingNumber || order.productName}</TableCell>}
                    {isColumnVisible('designation') && <TableCell className={pinCls('designation')} style={pinStyle('designation')}>{liveProduct?.productName || order.designation}</TableCell>}
                  {isColumnVisible('notes') && <TableCell className={cn('max-w-[200px]', pinCls('notes'))} style={pinStyle('notes')}>
                    <div className="truncate" title={order.notes}>{order.notes}</div>
                  </TableCell>}
                  {isColumnVisible('pos') && <TableCell className={cn('text-center font-mono', pinCls('pos'))} style={pinStyle('pos')}>{order.pos ?? ''}</TableCell>}
                  {isColumnVisible('ownOrderNumber') && <TableCell className={pinCls('ownOrderNumber')} style={pinStyle('ownOrderNumber')}>{order.ownOrderNumber}</TableCell>}
                  {isColumnVisible('material') && <TableCell className={pinCls('material')} style={pinStyle('material')}>{order.material}</TableCell>}
                  {isColumnVisible('orderNumber') && <TableCell className={cn('font-mono text-sm', pinCls('orderNumber'))} style={pinStyle('orderNumber')}>{order.orderNumber}</TableCell>}
                  {isColumnVisible('amountPc') && <TableCell className={cn('font-mono', pinCls('amountPc'))} style={pinStyle('amountPc')}>{order.amountPc != null ? order.amountPc.toLocaleString('hu-HU') : ''}</TableCell>}
                  {isColumnVisible('currentUnitPrice') && <TableCell className={cn('font-mono text-right tabular-nums', pinCls('currentUnitPrice'))} style={pinStyle('currentUnitPrice')} title="Aktuális darabár a vevői árlistából (élő anyagárral)">{priceByOrderId.has(order.id) ? priceByOrderId.get(order.id)!.currentPerPiece.toLocaleString('hu-HU', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : ''}</TableCell>}
                  {isColumnVisible('currentValue') && <TableCell className={cn('font-mono text-right tabular-nums font-medium', pinCls('currentValue'))} style={pinStyle('currentValue')} title="Aktuális ár × rendelt mennyiség">{priceByOrderId.has(order.id) && order.amountPc ? (priceByOrderId.get(order.id)!.currentPerPiece * order.amountPc).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</TableCell>}
                  {isColumnVisible('currentLaborValue') && <TableCell className={cn('font-mono text-right tabular-nums text-destructive', pinCls('currentLaborValue'))} style={pinStyle('currentLaborValue')} title="Munkadíj (anyagár nélkül) × rendelt mennyiség">{priceByOrderId.has(order.id) && order.amountPc ? (priceByOrderId.get(order.id)!.laborPerPiece * order.amountPc).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</TableCell>}
                  {isColumnVisible('orderDate') && <TableCell className={pinCls('orderDate')} style={pinStyle('orderDate')}>{order.orderDate}</TableCell>}
                  {isColumnVisible('requiredDate') && <TableCell className={pinCls('requiredDate')} style={pinStyle('requiredDate')}>{order.requiredDate}</TableCell>}
                  {isColumnVisible('pickupDate') && <TableCell className={pinCls('pickupDate')} style={pinStyle('pickupDate')}>{order.pickupDate}</TableCell>}
                  {isColumnVisible('invoiced') && <TableCell className={pinCls('invoiced')} style={pinStyle('invoiced')}>{order.invoiced}</TableCell>}
                  {isColumnVisible('ready') && <TableCell className={pinCls('ready')} style={pinStyle('ready')}>{order.ready}</TableCell>}
                  {isColumnVisible('surfaceTreatment') && <TableCell className={pinCls('surfaceTreatment')} style={pinStyle('surfaceTreatment')}>{order.surfaceTreatment}</TableCell>}
                  {isColumnVisible('boxesCount') && <TableCell className={pinCls('boxesCount')} style={pinStyle('boxesCount')}>{order.boxesCount}</TableCell>}
                  {isColumnVisible('palletsCount') && <TableCell className={pinCls('palletsCount')} style={pinStyle('palletsCount')}>{order.palletsCount}</TableCell>}
                  {isColumnVisible('grossWeightKg') && <TableCell className={pinCls('grossWeightKg')} style={pinStyle('grossWeightKg')}>{order.grossWeightKg}</TableCell>}
                  {isColumnVisible('requiredMaterialKg') && <TableCell className={pinCls('requiredMaterialKg')} style={pinStyle('requiredMaterialKg')}>{order.requiredMaterialKg}</TableCell>}
                  {isColumnVisible('plannedProductionHours') && <TableCell className={pinCls('plannedProductionHours')} style={pinStyle('plannedProductionHours')}>{getPlannedHoursForOrder(order, products ?? [])}</TableCell>}
                  {isColumnVisible('deliveryNote') && <TableCell className={pinCls('deliveryNote')} style={pinStyle('deliveryNote')}>{order.deliveryNote}</TableCell>}
                  {isColumnVisible('cmr') && <TableCell className={pinCls('cmr')} style={pinStyle('cmr')}>{order.cmr}</TableCell>}
                  {isColumnVisible('status') && <TableCell className={pinCls('status')} style={pinStyle('status')}>
                    <Select
                      value={order.status}
                      onValueChange={(value) => onStatusChange(order.id, value as OrderStatus)}
                    >
                      <SelectTrigger
                        className="min-w-[200px]"
                        style={{
                          backgroundColor: STATUS_COLORS[order.status] || '#ffffff',
                          // A státuszháttér világos marad sötét módban is, ezért a
                          // szöveget (és a nyíl-ikont) fixen sötétre kényszerítjük,
                          // különben a dark-mód világos betűszíne olvashatatlan lenne.
                          color: 'oklch(0.22 0.02 265)',
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
          {summary.pricedCount > 0 && (
            <>
              <span className="whitespace-nowrap">
                <b className="font-mono">{summary.totalValueEur.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b>{' '}
                <span className="text-muted-foreground">
                  rendelt érték{summary.pricedCount < summary.count ? ` (${summary.pricedCount}/${summary.count} áras)` : ''}
                </span>
              </span>
              <span className="whitespace-nowrap text-destructive">
                <b className="font-mono">{summary.totalLaborEur.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b>{' '}
                <span>rendelt munkadíj</span>
              </span>
            </>
          )}
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
