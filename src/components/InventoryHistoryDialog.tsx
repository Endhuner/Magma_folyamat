import { useMemo, useState } from 'react'
import type { InventoryItem, InventoryTransaction, Order } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUp, ArrowDown, Wrench, Download, Clock } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface InventoryHistoryDialogProps {
  open: boolean
  onClose: () => void
  item: InventoryItem | null
  transactions: InventoryTransaction[]
  orders: Order[]
}

type TypeFilter = 'all' | 'in' | 'out' | 'adjustment'

/**
 * Naplónézet egy készletcikkhez: az összes `InventoryTransaction` bejegyzés
 * dátum + típus szerint szűrhetően, és exportálhatóan (CSV).
 */
export function InventoryHistoryDialog({
  open,
  onClose,
  item,
  transactions,
  orders,
}: InventoryHistoryDialogProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const ordersById = useMemo(() => {
    const m = new Map<string, Order>()
    for (const o of orders) m.set(o.id, o)
    return m
  }, [orders])

  const itemTransactions = useMemo(() => {
    if (!item) return [] as InventoryTransaction[]
    let list = transactions.filter((t) => t.inventoryItemId === item.id)

    if (typeFilter !== 'all') {
      list = list.filter((t) => t.type === typeFilter)
    }
    if (fromDate) {
      const from = new Date(fromDate + 'T00:00:00').getTime()
      list = list.filter((t) => new Date(t.createdAt).getTime() >= from)
    }
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59').getTime()
      list = list.filter((t) => new Date(t.createdAt).getTime() <= to)
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [item, transactions, typeFilter, fromDate, toDate])

  const totals = useMemo(() => {
    let inQty = 0
    let outQty = 0
    let adjQty = 0
    for (const t of itemTransactions) {
      if (t.type === 'in') inQty += t.quantity
      else if (t.type === 'out') outQty += t.quantity
      else adjQty += t.quantity
    }
    return { inQty, outQty, adjQty, net: inQty - outQty + adjQty }
  }, [itemTransactions])

  const handleExportCsv = () => {
    if (!item || itemTransactions.length === 0) {
      toast.info('Nincs exportálható mozgás')
      return
    }
    const header = [
      'Dátum',
      'Idő',
      'Típus',
      'Mennyiség',
      'Rendelés',
      'Megjegyzés',
    ].join(';')
    const rows = itemTransactions.map((t) => {
      const d = new Date(t.createdAt)
      const typeLabel =
        t.type === 'in' ? 'Bevét' : t.type === 'out' ? 'Kivét' : 'Korrekció'
      const orderRef = t.orderId ? ordersById.get(t.orderId)?.orderNumber || t.orderId : ''
      return [
        format(d, 'yyyy-MM-dd'),
        format(d, 'HH:mm'),
        typeLabel,
        t.quantity,
        orderRef,
        (t.notes || '').replace(/;/g, ','),
      ].join(';')
    })
    const csv = '\ufeff' + [header, ...rows].join('\n') // BOM az Excel-kompatibilis magyar karakterekhez
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keszletnaplo-${item.drawingNumber || item.productName}-${format(new Date(), 'yyyyMMdd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Napló exportálva')
  }

  const resetFilters = () => {
    setTypeFilter('all')
    setFromDate('')
    setToDate('')
  }

  if (!item) return null

  const typeIcon = (type: InventoryTransaction['type']) => {
    switch (type) {
      case 'in':
        return <ArrowUp className="w-3.5 h-3.5 text-success" weight="bold" />
      case 'out':
        return <ArrowDown className="w-3.5 h-3.5 text-destructive" weight="bold" />
      case 'adjustment':
        return <Wrench className="w-3.5 h-3.5 text-muted-foreground" weight="bold" />
    }
  }

  const typeBadge = (type: InventoryTransaction['type']) => {
    const cls =
      type === 'in'
        ? 'bg-success/15 text-success-foreground border-success/30'
        : type === 'out'
          ? 'bg-destructive/15 text-destructive border-destructive/30'
          : 'bg-muted text-muted-foreground border-border'
    const label = type === 'in' ? 'Bevét' : type === 'out' ? 'Kivét' : 'Korrekció'
    return (
      <Badge variant="outline" className={`text-[10px] ${cls}`}>
        {label}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" weight="duotone" />
            Készletmozgás napló — {item.productName}
          </DialogTitle>
          <DialogDescription>
            Rajzszám: {item.drawingNumber || '-'} · Vevő: {item.customer || '-'} · Jelenlegi
            készlet: {item.quantity} db
          </DialogDescription>
        </DialogHeader>

        {/* Aggregált összesítő */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Bevétek</div>
            <div className="text-lg font-bold font-mono text-success">
              +{totals.inQty}
            </div>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Kivétek</div>
            <div className="text-lg font-bold font-mono text-destructive">
              −{totals.outQty}
            </div>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Korrekciók</div>
            <div className="text-lg font-bold font-mono">
              {totals.adjQty >= 0 ? '+' : ''}
              {totals.adjQty}
            </div>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Nettó</div>
            <div className="text-lg font-bold font-mono">
              {totals.net >= 0 ? '+' : ''}
              {totals.net}
            </div>
          </div>
        </div>

        {/* Szűrők */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-2">
          <div className="grid gap-1.5">
            <Label htmlFor="hist-type">Típus</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <SelectTrigger id="hist-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes</SelectItem>
                <SelectItem value="in">Bevét</SelectItem>
                <SelectItem value="out">Kivét</SelectItem>
                <SelectItem value="adjustment">Korrekció</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hist-from">Dátumtól</Label>
            <Input
              id="hist-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hist-to">Dátumig</Label>
            <Input
              id="hist-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="ghost" onClick={resetFilters} className="flex-1">
              Szűrők törlése
            </Button>
            <Button variant="outline" onClick={handleExportCsv} title="Export CSV">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lista */}
        <ScrollArea className="max-h-[400px] border rounded-md">
          {itemTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nincs mozgás a megadott szűrőfeltételekkel
            </div>
          ) : (
            <div className="divide-y">
              {itemTransactions.map((t) => {
                const ref = t.orderId ? ordersById.get(t.orderId) : undefined
                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 text-sm hover:bg-muted/40"
                  >
                    <div className="col-span-3 md:col-span-2 font-mono text-xs">
                      {format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm')}
                    </div>
                    <div className="col-span-3 md:col-span-2 flex items-center gap-1.5">
                      {typeIcon(t.type)}
                      {typeBadge(t.type)}
                    </div>
                    <div className="col-span-2 md:col-span-2 text-right font-mono font-semibold">
                      {t.type === 'out' ? '−' : t.type === 'in' ? '+' : ''}
                      {t.quantity}
                    </div>
                    <div className="col-span-4 md:col-span-3 text-xs text-muted-foreground truncate">
                      {ref ? `Rend: ${ref.orderNumber || ref.id}` : t.shiftId ? 'Műszakból' : ''}
                    </div>
                    <div className="col-span-12 md:col-span-3 text-xs text-muted-foreground truncate">
                      {t.notes || '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
