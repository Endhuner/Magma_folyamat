import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Factory, Warning, ChartBar, Package, DownloadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Order, ProductionShift, ProductionDefect, Machine, Product, InventoryItem } from '@/lib/types'
import { fmtInt, findProductForOrder } from '@/lib/productionHelpers'
import { parseFloatSafe, isDelivered } from '@/lib/helpers'

interface ReportsViewProps {
  orders: Order[]
  shifts: ProductionShift[]
  defects: ProductionDefect[]
  machines: Machine[]
  products: Product[]
  inventory: InventoryItem[]
}

/** 'YYYY-MM' egy dátumstringből (a / és - elválasztót is kezeli). */
function yearMonth(dateStr: string): string {
  if (!dateStr) return ''
  const m = String(dateStr).replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})/)
  if (!m) return ''
  return `${m[1]}-${m[2].padStart(2, '0')}`
}

function currentMonth(): string {
  // Nincs Date.now a modul-szinten tiltva a komponensben — futásidőben hívjuk.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function ReportsView({ orders, shifts, defects, machines, products }: ReportsViewProps) {
  const [month, setMonth] = useState<string>(currentMonth)

  const monthShifts = useMemo(() => shifts.filter((s) => s.date?.startsWith(month)), [shifts, month])
  const monthDefects = useMemo(() => defects.filter((d) => d.date?.startsWith(month)), [defects, month])
  const monthOrders = useMemo(() => orders.filter((o) => yearMonth(o.orderDate) === month), [orders, month])

  // ── Havi összesítők ──────────────────────────────────────────────
  const kpis = useMemo(() => {
    const produced = monthShifts.reduce((s, x) => s + (x.producedQuantity || 0), 0)
    const defectQty = monthDefects.reduce((s, x) => s + (x.quantity || 0), 0)
    const rate = produced > 0 ? Math.round((defectQty / produced) * 1000) / 10 : 0
    const workedOrders = new Set(monthShifts.map((s) => s.orderId)).size
    return { produced, defectQty, rate, workedOrders, newOrders: monthOrders.length }
  }, [monthShifts, monthDefects, monthOrders])

  // ── Vevőnkénti forgalom (a hónap új rendelései) ──────────────────
  const byCustomer = useMemo(() => {
    const map = new Map<string, { count: number; qty: number }>()
    for (const o of monthOrders) {
      const cur = map.get(o.customer) ?? { count: 0, qty: 0 }
      cur.count += 1
      cur.qty += o.amountPc || 0
      map.set(o.customer, cur)
    }
    return [...map.entries()]
      .map(([customer, v]) => ({ customer, ...v }))
      .sort((a, b) => b.qty - a.qty)
  }, [monthOrders])

  // ── Selejt-Pareto (ok szerint, csökkenő) ─────────────────────────
  const defectPareto = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of monthDefects) {
      const reason = (d.reason || 'Egyéb').trim() || 'Egyéb'
      map.set(reason, (map.get(reason) ?? 0) + (d.quantity || 0))
    }
    const rows = [...map.entries()].map(([reason, qty]) => ({ reason, qty })).sort((a, b) => b.qty - a.qty)
    const total = rows.reduce((s, r) => s + r.qty, 0)
    let cum = 0
    return rows.map((r) => {
      cum += r.qty
      return { ...r, cumPct: total > 0 ? Math.round((cum / total) * 100) : 0 }
    })
  }, [monthDefects])

  // ── Gép-kihasználtság ────────────────────────────────────────────
  const machineName = useMemo(() => new Map(machines.map((m) => [m.id, m.name])), [machines])
  const byMachine = useMemo(() => {
    const map = new Map<string, { produced: number; shiftCount: number }>()
    for (const s of monthShifts) {
      const key = s.machineId || '—'
      const cur = map.get(key) ?? { produced: 0, shiftCount: 0 }
      cur.produced += s.producedQuantity || 0
      cur.shiftCount += 1
      map.set(key, cur)
    }
    return [...map.entries()]
      .map(([machineId, v]) => ({ name: machineId === '—' ? 'Nincs gép megadva' : (machineName.get(machineId) || machineId), ...v }))
      .sort((a, b) => b.produced - a.produced)
  }, [monthShifts, machineName])

  // ── Anyagszükséglet (MRP-lite): aktív, még ki nem szállított rendelések ──
  const materialDemand = useMemo(() => {
    const active = orders.filter((o) => !isDelivered(o.status))
    const map = new Map<string, { demandKg: number; orders: number }>()
    for (const o of active) {
      const product = findProductForOrder(o, products)
      const material = (o.material || product?.material || 'Ismeretlen').trim() || 'Ismeretlen'
      // Elsődlegesen a rendelés requiredMaterialKg mezője; ha üres, becslés a
      // darabszám × darabsúly (g→kg) alapján.
      let kg = parseFloatSafe(o.requiredMaterialKg)
      if (kg <= 0 && product) {
        kg = ((o.amountPc || 0) * parseFloatSafe(product.weightPerPiece)) / 1000
      }
      if (kg <= 0) continue
      const cur = map.get(material) ?? { demandKg: 0, orders: 0 }
      cur.demandKg += kg
      cur.orders += 1
      map.set(material, cur)
    }
    return [...map.entries()]
      .map(([material, v]) => ({ material, demandKg: Math.round(v.demandKg * 10) / 10, orders: v.orders }))
      .sort((a, b) => b.demandKg - a.demandKg)
  }, [orders, products])

  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    setExporting(true)
    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.creator = 'ProduktívPro'

      const kpiSheet = wb.addWorksheet('Összesítő')
      kpiSheet.addRows([
        ['Hónap', month],
        ['Gyártott (db)', kpis.produced],
        ['Selejt (db)', kpis.defectQty],
        ['Selejt arány (%)', kpis.rate],
        ['Megmunkált rendelés', kpis.workedOrders],
        ['Új rendelés', kpis.newOrders],
      ])

      const cs = wb.addWorksheet('Vevők')
      cs.addRow(['Vevő', 'Rendelés db', 'Mennyiség (db)'])
      byCustomer.forEach((r) => cs.addRow([r.customer, r.count, r.qty]))

      const ds = wb.addWorksheet('Selejt-Pareto')
      ds.addRow(['Ok', 'Mennyiség (db)', 'Kumulált %'])
      defectPareto.forEach((r) => ds.addRow([r.reason, r.qty, r.cumPct]))

      const ms = wb.addWorksheet('Gép-kihasználtság')
      ms.addRow(['Gép', 'Gyártott (db)', 'Műszakok'])
      byMachine.forEach((r) => ms.addRow([r.name, r.produced, r.shiftCount]))

      const mat = wb.addWorksheet('Anyagszükséglet')
      mat.addRow(['Anyag', 'Szükséglet (kg)', 'Érintett rendelés'])
      materialDemand.forEach((r) => mat.addRow([r.material, r.demandKg, r.orders]))

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Riport_${month}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Riport exportálva')
    } catch (err) {
      console.error('[reports] export hiba:', err)
      toast.error('Az export sikertelen')
    } finally {
      setExporting(false)
    }
  }

  const kpiCards = [
    { label: 'Gyártott', value: fmtInt(kpis.produced), unit: 'db', icon: Factory, color: 'text-accent' },
    { label: 'Selejt', value: fmtInt(kpis.defectQty), unit: 'db', icon: Warning, color: kpis.rate > 5 ? 'text-destructive' : 'text-warning' },
    { label: 'Selejt arány', value: `${kpis.rate}`, unit: '%', icon: ChartBar, color: kpis.rate > 5 ? 'text-destructive' : 'text-success' },
    { label: 'Megmunkált rend.', value: fmtInt(kpis.workedOrders), unit: 'db', icon: Package, color: 'text-primary' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Riportok</h2>
          <p className="text-sm text-muted-foreground">Havi termelési és forgalmi kimutatások</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Hónap</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px]" />
          </div>
          <Button onClick={exportExcel} disabled={exporting} className="gap-2">
            <DownloadSimple className="w-4 h-4" />
            {exporting ? 'Export…' : 'Excel export'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                  {k.value}<span className="text-sm text-muted-foreground ml-1">{k.unit}</span>
                </p>
              </div>
              <k.icon className={`w-6 h-6 ${k.color}`} weight="duotone" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Vevőnkénti forgalom */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Vevőnkénti forgalom (új rendelések)</h3>
          {byCustomer.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nincs adat erre a hónapra.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vevő</TableHead>
                    <TableHead className="text-right">Rendelés</TableHead>
                    <TableHead className="text-right">Mennyiség</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCustomer.slice(0, 10).map((r) => (
                    <TableRow key={r.customer} className="even:bg-[var(--row-stripe)]">
                      <TableCell className="font-medium truncate max-w-[200px]">{r.customer}</TableCell>
                      <TableCell className="text-right font-mono">{r.count}</TableCell>
                      <TableCell className="text-right font-mono">{fmtInt(r.qty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Gép-kihasználtság */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Gép-kihasználtság</h3>
          {byMachine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nincs műszakadat erre a hónapra.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gép</TableHead>
                    <TableHead className="text-right">Gyártott</TableHead>
                    <TableHead className="text-right">Műszakok</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byMachine.map((r) => (
                    <TableRow key={r.name} className="even:bg-[var(--row-stripe)]">
                      <TableCell className="font-medium truncate max-w-[200px]">{r.name}</TableCell>
                      <TableCell className="text-right font-mono">{fmtInt(r.produced)}</TableCell>
                      <TableCell className="text-right font-mono">{r.shiftCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Selejt-Pareto */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Selejt-Pareto (ok szerint)</h3>
        {defectPareto.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nincs selejt rögzítve erre a hónapra.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={defectPareto} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="reason" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${fmtInt(v)} db`, 'Selejt']} />
                <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                  {defectPareto.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? 'var(--destructive)' : 'var(--warning)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              A vezető ok: <span className="font-medium text-foreground">{defectPareto[0].reason}</span> —
              a selejt {defectPareto[0].cumPct}%-a.
            </p>
          </>
        )}
      </Card>

      {/* Anyagszükséglet (MRP-lite) */}
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Anyagszükséglet — aktív rendelések</h3>
        <p className="text-xs text-muted-foreground mb-3">
          A még ki nem szállított rendelések becsült anyagigénye (rendelés „szükséges anyag kg" mezője,
          vagy darabszám × darabsúly alapján).
        </p>
        {materialDemand.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nincs aktív rendelés anyagigénnyel.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anyag</TableHead>
                  <TableHead className="text-right">Szükséglet (kg)</TableHead>
                  <TableHead className="text-right">Rendelés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialDemand.map((r) => (
                  <TableRow key={r.material} className="even:bg-[var(--row-stripe)]">
                    <TableCell className="font-medium">{r.material}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{r.demandKg.toLocaleString('hu-HU')}</TableCell>
                    <TableCell className="text-right font-mono">{r.orders}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Összesen</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {materialDemand.reduce((s, r) => s + r.demandKg, 0).toLocaleString('hu-HU')} kg
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
