import { useMemo, useState } from 'react'
import { CheckCircle, Circle, MagnifyingGlass, Printer } from '@phosphor-icons/react'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { generateBoxLabels } from '@/lib/boxLabelExport'
import { generatePalletLabels } from '@/lib/palletLabelExport'
import { isDelivered, isInvoiced, parseYear, stripDiacritics } from '@/lib/helpers'
import type { Order, OrderStatus } from '@/lib/types'

/** Ugyanaz a státuszsor, mint a Rendeléseknél. */
const ORDER_STATUSES: OrderStatus[] = [
  'Felvéve', 'Szünetel', 'Kiszállítva', 'Kiszállítva/Számlázva', 'Csomagolás alatt',
  'Folyamatban', 'Előkészítve', 'Javítás alatt', 'Elkészült',
]

/** A négy dokumentumtípus — kettő állapota a rendelés mezőjében, kettő a
 *  szállítólevél/CMR számában él. */
type DocKey = 'label' | 'pallet' | 'delivery' | 'cmr'
const DOC_COLS: Array<{ key: DocKey; label: string }> = [
  { key: 'label', label: 'Etikett' },
  { key: 'pallet', label: 'Raklapcímke' },
  { key: 'delivery', label: 'Szállítólevél' },
  { key: 'cmr', label: 'CMR' },
]

const isDone = (o: Order, key: DocKey): boolean => {
  switch (key) {
    case 'label': return !!o.labelDoneAt
    case 'pallet': return !!o.palletLabelDoneAt
    case 'delivery': return !!o.deliveryNote
    case 'cmr': return !!o.cmr
  }
}
const doneDate = (o: Order, key: DocKey): string => {
  switch (key) {
    case 'label': return o.labelDoneAt ?? ''
    case 'pallet': return o.palletLabelDoneAt ?? ''
    case 'delivery': return o.deliveryNote
    case 'cmr': return o.cmr
  }
}

export default function EtikettPage() {
  const s = useAppShell()
  const [query, setQuery] = useState('')
  const isAdmin = s.auth.status === 'bypass' || s.auth.user?.role === 'admin'

  // Saját szűrő-állapot — ugyanazok a szűrők, mint a Rendeléseknél
  // (egyéni oszlopszűrők nélkül). Nem osztozik a Rendelések nézettel.
  const [hideDelivered, setHideDelivered] = useState(true)
  const [hideInvoiced, setHideInvoiced] = useState(true)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [yearFilterEnabled, setYearFilterEnabled] = useState(false)
  const [selectedYears, setSelectedYears] = useState<number[]>([])

  const yearOptions = useMemo(() => {
    const set = new Set<number>()
    for (const o of s.orders) {
      const y = parseYear(o.orderDate)
      if (y != null) set.add(y)
    }
    return [...set].sort((a, b) => b - a)
  }, [s.orders])

  const rows = useMemo(() => {
    let list = s.orders
    if (hideDelivered) list = list.filter((o) => !isDelivered(o.status))
    if (hideInvoiced) list = list.filter((o) => !isInvoiced(o.status))
    if (yearFilterEnabled && selectedYears.length > 0) {
      const ys = new Set(selectedYears)
      list = list.filter((o) => {
        const y = parseYear(o.orderDate)
        return y != null && ys.has(y)
      })
    }
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    if (query) {
      const q = stripDiacritics(query)
      list = list.filter((o) =>
        stripDiacritics(`${o.customer} ${o.productName} ${o.designation ?? ''} ${o.orderNumber ?? ''}`).includes(q))
    }
    return [...list].sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1))
  }, [s.orders, hideDelivered, hideInvoiced, yearFilterEnabled, selectedYears, statusFilter, query])

  // A kijelölt aktív sablont előre soroljuk (mint a Rendeléseknél), különben a
  // generátor a tömb ELSŐ egyező sablonját venné — akár rossz sablont.
  const templatesFor = (kind: 'pallet' | 'box-label') => {
    const list = s.savedDeliveryTemplates
    if (!list) return undefined
    const activeId = s.activeTemplates?.[kind]
    if (!activeId) return list
    return [...list].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : 0))
  }

  const genLabel = (o: Order) => {
    // A pipa csak akkor kerül ki, ha a generálás tényleg sikerült (nyílt ablak,
    // volt egyező sablon/termék) — különben hamis „kész" jelzés maradna.
    if (generateBoxLabels([o], s.customers, s.products, templatesFor('box-label')))
      s.handleSetOrderLabelFlag(o.id, 'labelDoneAt', true)
  }
  const genPallet = (o: Order) => {
    if (generatePalletLabels([o], s.customers, s.products, templatesFor('pallet')))
      s.handleSetOrderLabelFlag(o.id, 'palletLabelDoneAt', true)
  }
  const genDelivery = (o: Order) => {
    void s.handleExportDelivery([o.id])
  }
  const genCmr = (o: Order) => {
    void s.handleExportCmr([o.id])
  }
  const generate: Record<DocKey, (o: Order) => void> = {
    label: genLabel, pallet: genPallet, delivery: genDelivery, cmr: genCmr,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Etikett</h2>
        <p className="text-muted-foreground">
          A megrendelt tételek dokumentum-készültsége. Zöld pipa = elkészült.
          {isAdmin
            ? ' A nyomtató-gombbal itt is legenerálhatod; az etikett/raklapcímke pipája kézzel is állítható.'
            : ' (Csak megtekintés — a generálás és a jelölés adminjog.)'}
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="relative max-w-lg">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Keresés vevő, termék vagy rendelésszám szerint..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch id="et-hide-delivered" checked={hideDelivered} onCheckedChange={setHideDelivered} />
            <Label htmlFor="et-hide-delivered" className="cursor-pointer text-sm">Kiszállítva elrejtése</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="et-hide-invoiced" checked={hideInvoiced} onCheckedChange={setHideInvoiced} />
            <Label htmlFor="et-hide-invoiced" className="cursor-pointer text-sm">Kiszállítva/Számlázva elrejtése</Label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Státusz:</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes státusz</SelectItem>
                {ORDER_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {yearOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Switch id="et-year" checked={yearFilterEnabled} onCheckedChange={setYearFilterEnabled} />
              <Label htmlFor="et-year" className="cursor-pointer text-sm">Évszám szűrés</Label>
              {yearFilterEnabled && (
                <div className="flex gap-1 flex-wrap">
                  {yearOptions.map((y) => (
                    <Badge
                      key={y}
                      variant={selectedYears.includes(y) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedYears((prev) =>
                        prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y])}
                    >
                      {y}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vevő</TableHead>
              <TableHead>Termék</TableHead>
              <TableHead className="text-right">Menny. (db)</TableHead>
              {DOC_COLS.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3 + DOC_COLS.length} className="text-center text-muted-foreground py-10">
                  {s.orders.length === 0 ? 'Nincs rendelés.' : 'Nincs találat.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.customer}</TableCell>
                <TableCell className="max-w-72 truncate" title={`${o.productName} ${o.designation ?? ''}`}>
                  <span className="font-medium">{o.productName}</span>
                  {o.designation ? <span className="text-muted-foreground"> — {o.designation}</span> : null}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {o.amountPc != null ? o.amountPc.toLocaleString('hu-HU') : ''}
                </TableCell>
                {DOC_COLS.map((c) => {
                  const done = isDone(o, c.key)
                  // Az etikett/raklap pipája adminként kézzel is váltható; a
                  // szállítólevél/CMR pipa csak jelző (a dokumentum-rekord állítja).
                  const toggleable = isAdmin && (c.key === 'label' || c.key === 'pallet')
                  return (
                    <TableCell key={c.key} className="text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          disabled={!toggleable}
                          className={toggleable ? 'cursor-pointer' : 'cursor-default'}
                          title={toggleable
                            ? (done ? 'Jelölés visszavonása' : 'Kész-re jelölés')
                            : (done ? doneDate(o, c.key) : 'Még nincs')}
                          onClick={() => {
                            if (!toggleable) return
                            const field = c.key === 'label' ? 'labelDoneAt' : 'palletLabelDoneAt'
                            s.handleSetOrderLabelFlag(o.id, field, !done)
                          }}
                        >
                          {done
                            ? <CheckCircle className="w-6 h-6 text-success" weight="fill" />
                            : <Circle className="w-6 h-6 text-muted-foreground/40" />}
                        </button>
                        {done && (
                          <span className="text-[10px] font-mono text-muted-foreground">{doneDate(o, c.key)}</span>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost" size="sm" className="h-6 px-1.5"
                            title={`${c.label} generálása`}
                            onClick={() => generate[c.key](o)}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
