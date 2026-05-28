/**
 * Gyártás előzmények — az összes rögzített műszak táblázata.
 * Szűrhető: dátum-intervallum, gép, vevő, rendelés.
 * Rendezhető: dátum, lövésszám, darabszám.
 */
import { useMemo, useState } from 'react'
import type { Machine, Order, Product, ProductionShift } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  Factory,
  X,
} from '@phosphor-icons/react'
import { shiftLabel } from '@/lib/shiftValidation'

type SortKey = 'date' | 'shotsCount' | 'producedQuantity'
type SortDir = 'asc' | 'desc'

interface Props {
  shifts: ProductionShift[]
  orders: Order[]
  products: Product[]
  machines: Machine[]
}

function SortBtn({
  col,
  current,
  dir,
  onSort,
}: {
  col: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = col === current
  return (
    <button
      className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground"
      onClick={() => onSort(col)}
    >
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" weight="bold" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" weight="bold" />
        )
      ) : (
        <ArrowsDownUp className="w-3.5 h-3.5 opacity-40" />
      )}
    </button>
  )
}

export function ProductionHistoryView({ shifts, orders, products, machines }: Props) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterMachine, setFilterMachine] = useState('all')
  const [filterCustomer, setFilterCustomer] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Pre-built lookups
  const orderMap = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines])

  const uniqueCustomers = useMemo(
    () => [...new Set(orders.map((o) => o.customer).filter(Boolean))].sort(),
    [orders]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let rows = [...shifts]

    if (dateFrom) rows = rows.filter((s) => s.date >= dateFrom)
    if (dateTo) rows = rows.filter((s) => s.date <= dateTo)
    if (filterMachine !== 'all') rows = rows.filter((s) => s.machineId === filterMachine)
    if (filterCustomer !== 'all') {
      rows = rows.filter((s) => orderMap.get(s.orderId)?.customer === filterCustomer)
    }
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase()
      rows = rows.filter((s) => {
        const o = orderMap.get(s.orderId)
        return (
          o?.productName?.toLowerCase().includes(q) ||
          o?.customer?.toLowerCase().includes(q) ||
          o?.orderNumber?.toLowerCase().includes(q) ||
          o?.designation?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q) ||
          machineMap.get(s.machineId ?? '')?.name?.toLowerCase().includes(q)
        )
      })
    }

    rows.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'date') {
        va = a.date + a.shift
        vb = b.date + b.shift
      } else if (sortKey === 'shotsCount') {
        va = a.shotsCount
        vb = b.shotsCount
      } else {
        va = a.producedQuantity
        vb = b.producedQuantity
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [shifts, dateFrom, dateTo, filterMachine, filterCustomer, filterSearch, sortKey, sortDir, orderMap, machineMap])

  const totalShots = useMemo(() => filtered.reduce((s, r) => s + r.shotsCount, 0), [filtered])
  const totalProduced = useMemo(() => filtered.reduce((s, r) => s + r.producedQuantity, 0), [filtered])

  const fmt = (n: number) => Math.round(n).toLocaleString('hu-HU')

  const hasFilters =
    dateFrom || dateTo || filterMachine !== 'all' || filterCustomer !== 'all' || filterSearch

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setFilterMachine('all')
    setFilterCustomer('all')
    setFilterSearch('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Factory className="w-6 h-6 text-accent" weight="duotone" />
        <h2 className="text-xl font-semibold">Gyártás előzmények</h2>
        <Badge variant="secondary" className="font-mono">{filtered.length} műszak</Badge>
      </div>

      {/* Szűrők */}
      <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dátumtól</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dátumig</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gép</Label>
            <Select value={filterMachine} onValueChange={setFilterMachine}>
              <SelectTrigger>
                <SelectValue placeholder="Mind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Mind —</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vevő</Label>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Mind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Mind —</SelectItem>
                {uniqueCustomers.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <Input
            placeholder="Keresés (termék, rendelés, megjegyzés…)"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="max-w-xs"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="w-4 h-4" />
              Szűrők törlése
            </Button>
          )}
        </div>
      </div>

      {/* Összesítő */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Összes műszak</div>
            <div className="text-2xl font-bold font-mono">{filtered.length}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Összes lövés</div>
            <div className="text-2xl font-bold font-mono">{fmt(totalShots)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Gyártott db</div>
            <div className="text-2xl font-bold font-mono text-accent">{fmt(totalProduced)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Átlag lövés/műszak</div>
            <div className="text-2xl font-bold font-mono">
              {filtered.length > 0 ? fmt(totalShots / filtered.length) : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Táblázat */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">
                <span className="flex items-center gap-1">
                  Dátum
                  <SortBtn col="date" current={sortKey} dir={sortDir} onSort={handleSort} />
                </span>
              </TableHead>
              <TableHead>Műszak</TableHead>
              <TableHead>Gép</TableHead>
              <TableHead>Vevő</TableHead>
              <TableHead>Termék</TableHead>
              <TableHead>Rend. szám</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                <span className="flex items-center justify-end gap-1">
                  Lövés
                  <SortBtn col="shotsCount" current={sortKey} dir={sortDir} onSort={handleSort} />
                </span>
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                <span className="flex items-center justify-end gap-1">
                  Darab
                  <SortBtn col="producedQuantity" current={sortKey} dir={sortDir} onSort={handleSort} />
                </span>
              </TableHead>
              <TableHead>Megjegyzés</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  Nincs a szűrőknek megfelelő műszak
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const order = orderMap.get(s.orderId)
                const product = order?.productId ? productMap.get(order.productId) : undefined
                const machine = s.machineId ? machineMap.get(s.machineId) : undefined
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.shift === 'du' ? 'bg-accent/10' : ''}>
                        {shiftLabel(s.shift)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {machine ? (
                        <span className="font-medium">{machine.name}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{order?.customer ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">
                      {order?.productName ?? '—'}
                      {product?.drawingNumber && (
                        <span className="text-muted-foreground ml-1 text-xs">({product.drawingNumber})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{order?.orderNumber ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(s.shotsCount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-accent">{fmt(s.producedQuantity)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {s.notes || '—'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
