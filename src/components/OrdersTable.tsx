import { useMemo, useState } from 'react'
import { Order, OrderStatus, Product } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash, Package, CopySimple } from '@phosphor-icons/react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { parseYear } from '@/lib/helpers'

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
}

const STATUS_OPTIONS: OrderStatus[] = [
  'Felvéve',
  'Szünetel',
  'Kiszállítva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
]

const STATUS_COLORS: Record<OrderStatus, string> = {
  'Felvéve': 'oklch(0.95 0.05 85)',
  'Szünetel': 'oklch(0.95 0.05 85)',
  'Kiszállítva': 'oklch(0.92 0.08 145)',
  'Csomagolás alatt': 'oklch(0.93 0.08 55)',
  'Folyamatban': 'oklch(0.90 0.08 155)',
  'Előkészítve': 'oklch(0.91 0.08 230)',
  'Javítás alatt': 'oklch(0.93 0.08 350)',
}

function stripDiacritics(s: string | undefined | null): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isDelivered(status: string): boolean {
  const st = stripDiacritics(status)
  return st === 'kiszallitva' || st.includes('kiszallitva')
}

export function OrdersTable({ orders, products, onEdit, onDelete, onDuplicate, onStatusChange, selectedIds, onSelectionChange, visibleColumns }: OrdersTableProps) {
  const [sortField, setSortField] = useState<keyof Order | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const isColumnVisible = (columnId: string) => {
    if (!visibleColumns || visibleColumns.length === 0) return true
    return visibleColumns.includes(columnId)
  }

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
    const totalPlannedHours = ordersToSummarize.reduce((sum, o) => sum + parseHours(o.plannedProductionHours), 0)
    
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
      <div className="bg-muted/50 border border-accent/30 rounded-lg p-3 mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">📋 Gyors referencia - Sablon változók:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono">
          <div><span className="text-accent font-semibold">{'{{customer}}'}</span> - Vevő</div>
          <div><span className="text-accent font-semibold">{'{{productName}}'}</span> - Termék neve</div>
          <div><span className="text-accent font-semibold">{'{{designation}}'}</span> - Megnevezése</div>
          <div><span className="text-accent font-semibold">{'{{notes}}'}</span> - Megjegyzés</div>
          <div><span className="text-accent font-semibold">{'{{ownOrderNumber}}'}</span> - Saját rendelési szám</div>
          <div><span className="text-accent font-semibold">{'{{material}}'}</span> - Anyag</div>
          <div><span className="text-accent font-semibold">{'{{orderNumber}}'}</span> - Vevő rendelési száma</div>
          <div><span className="text-accent font-semibold">{'{{amountPc}}'}</span> - Mennyiség (db)</div>
          <div><span className="text-accent font-semibold">{'{{orderDate}}'}</span> - Rendelés dátuma</div>
          <div><span className="text-accent font-semibold">{'{{requiredDate}}'}</span> - Szükséges szállítási dátum</div>
          <div><span className="text-accent font-semibold">{'{{pickupDate}}'}</span> - Tényleges átvételi dátum</div>
          <div><span className="text-accent font-semibold">{'{{invoiced}}'}</span> - Számlázva</div>
          <div><span className="text-accent font-semibold">{'{{ready}}'}</span> - Szállításra kész</div>
          <div><span className="text-accent font-semibold">{'{{surfaceTreatment}}'}</span> - Felületkezelés</div>
          <div><span className="text-accent font-semibold">{'{{boxesCount}}'}</span> - Dobozok száma</div>
          <div><span className="text-accent font-semibold">{'{{palletsCount}}'}</span> - Össz raklapok száma</div>
          <div><span className="text-accent font-semibold">{'{{grossWeightKg}}'}</span> - Össz bruttó súly</div>
          <div><span className="text-accent font-semibold">{'{{requiredMaterialKg}}'}</span> - Szükséges anyagmennyiség</div>
          <div><span className="text-accent font-semibold">{'{{plannedProductionHours}}'}</span> - Tervezett gyártási idő</div>
          <div><span className="text-accent font-semibold">{'{{deliveryNote}}'}</span> - Szállítólevél</div>
          <div><span className="text-accent font-semibold">{'{{cmr}}'}</span> - CMR</div>
          <div><span className="text-accent font-semibold">{'{{status}}'}</span> - Státusz</div>
        </div>
      </div>

      <div className="border rounded-lg mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
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
                {isColumnVisible('productName') && <TableHead className="cursor-pointer" onClick={() => handleSort('productName')}>Termék neve</TableHead>}
                {isColumnVisible('designation') && <TableHead className="cursor-pointer" onClick={() => handleSort('designation')}>Megnevezése</TableHead>}
                {isColumnVisible('notes') && <TableHead>Megjegyzés</TableHead>}
                {isColumnVisible('ownOrderNumber') && <TableHead className="cursor-pointer" onClick={() => handleSort('ownOrderNumber')}>Saját rendelési szám</TableHead>}
                {isColumnVisible('material') && <TableHead className="cursor-pointer" onClick={() => handleSort('material')}>Anyag</TableHead>}
                {isColumnVisible('orderNumber') && <TableHead className="cursor-pointer" onClick={() => handleSort('orderNumber')}>Vevő rendelési száma</TableHead>}
                {isColumnVisible('amountPc') && <TableHead className="cursor-pointer" onClick={() => handleSort('amountPc')}>Mennyiség (db)</TableHead>}
                {isColumnVisible('orderDate') && <TableHead className="cursor-pointer" onClick={() => handleSort('orderDate')}>Rendelés dátuma</TableHead>}
                {isColumnVisible('requiredDate') && <TableHead className="cursor-pointer" onClick={() => handleSort('requiredDate')}>Szükséges szállítási dátum</TableHead>}
                {isColumnVisible('pickupDate') && <TableHead className="cursor-pointer" onClick={() => handleSort('pickupDate')}>Tényleges átvételi dátum</TableHead>}
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
              {sortedOrders.map((order, index) => {
                return (
                  <TableRow key={order.id} className="even:bg-[oklch(0.94_0.015_250)] hover:bg-[oklch(0.88_0.02_250)]">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(order.id)}
                        onCheckedChange={() => toggleSelection(order.id)}
                      />
                    </TableCell>
                    {isColumnVisible('customer') && <TableCell className="font-medium">{order.customer}</TableCell>}
                    {isColumnVisible('productName') && <TableCell>{order.productName}</TableCell>}
                    {isColumnVisible('designation') && <TableCell>{order.designation}</TableCell>}
                  {isColumnVisible('notes') && <TableCell className="max-w-[200px]">
                    <div className="truncate" title={order.notes}>{order.notes}</div>
                  </TableCell>}
                  {isColumnVisible('ownOrderNumber') && <TableCell>{order.ownOrderNumber}</TableCell>}
                  {isColumnVisible('material') && <TableCell>{order.material}</TableCell>}
                  {isColumnVisible('orderNumber') && <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>}
                  {isColumnVisible('amountPc') && <TableCell>{order.amountPc}</TableCell>}
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
                  {isColumnVisible('plannedProductionHours') && <TableCell>{order.plannedProductionHours}</TableCell>}
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
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-accent/30 border-t-2 border-accent/50 backdrop-blur-sm z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold">
              Összesítés - {selectedIds.length > 0 ? `${summary.count} kijelölt rendelés` : `${summary.count} szűrt rendelés`}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Összes darab</p>
              <p className="text-xl font-bold font-mono">{summary.totalAmount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Dobozok száma</p>
              <p className="text-xl font-bold font-mono">{summary.totalBoxes}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Raklapok száma</p>
              <p className="text-xl font-bold font-mono">{summary.totalPallets}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Bruttó súly</p>
              <p className="text-xl font-bold font-mono">{summary.totalGrossWeight}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Szükséges anyag</p>
              <p className="text-xl font-bold font-mono">{summary.totalRequiredMaterial}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Gyártási idő</p>
              <p className="text-xl font-bold font-mono">{summary.totalPlannedHours}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
