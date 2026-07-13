import { useMemo, useState } from 'react'
import { Download, Plus, Trash, TrendUp } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAppSetting } from '@/hooks/useAppSetting'
import { generateId } from '@/lib/generateId'
import {
  buildProductIndex, calcPriceListItem, periodAverages, resolveItemSource, type ZamakEntry,
} from '@/lib/materialPriceCalc'
import { downloadPriceListXlsx } from '@/lib/priceListExcelExport'
import type { PriceList, PriceListItem } from '@/lib/types'

const num = (v: string, fallback = 0) => {
  const n = Number.parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

const eur = (v: number, digits = 4) =>
  v.toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export default function AnyagarakPage() {
  const s = useAppShell()
  const [entries, setEntries] = useAppSetting<ZamakEntry[]>('zamak-price-entries', [])
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newPrice, setNewPrice] = useState('')
  const [newNote, setNewNote] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')

  const selected = s.priceLists.find((p) => p.id === selectedId) ?? null
  const productIndex = useMemo(() => buildProductIndex(s.products), [s.products])
  const quarterAvgs = useMemo(() => periodAverages(entries, 'quarter'), [entries])
  const twoMonthAvgs = useMemo(() => periodAverages(entries, 'twoMonth'), [entries])

  const addEntry = () => {
    const price = num(newPrice)
    if (!newDate || price <= 0) {
      toast.error('Adj meg dátumot és érvényes árat (€/kg)!')
      return
    }
    void setEntries(
      [...entries, { date: newDate, eurPerKg: price, note: newNote || undefined }]
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    )
    setNewPrice('')
    setNewNote('')
  }

  const applyAvg = (label: string, avg: number) => {
    if (!selected) {
      toast.error('Előbb válassz árlistát!')
      return
    }
    s.handleSavePriceList({
      id: selected.id,
      currentMpEurPerKg: Number(avg.toFixed(4)),
      mpHistory: [
        ...selected.mpHistory,
        { label, mp: Number(avg.toFixed(4)), setAt: new Date().toISOString().slice(0, 10) },
      ],
    })
    toast.success(`${selected.customerName}: aktuális MP = ${avg.toFixed(4)} €/kg (${label})`)
  }

  const newList = () => {
    const id = generateId()
    s.handleSavePriceList({
      id,
      customerName: 'Új árlista',
      burnRate: 0.06,
      mpbEurPerKg: 0,
      currentMpEurPerKg: 0,
      mpHistory: [],
      items: [],
    })
    setSelectedId(id)
  }

  const setListField = (field: keyof PriceList, value: unknown) => {
    if (!selected) return
    s.handleSavePriceList({ id: selected.id, [field]: value })
  }

  const setItem = (idx: number, patch: Partial<PriceListItem>) => {
    if (!selected) return
    const items = selected.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    s.handleSavePriceList({ id: selected.id, items })
  }

  return (
    <div className="space-y-6">
      {/* ---------- Zamak-árfolyam ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendUp className="w-5 h-5" /> Zamak-árfolyam
          </CardTitle>
          <CardDescription>
            Heti árjegyzések (€/kg) — az app negyedéves és 2 havi átlagot számol,
            amit egy kattintással alkalmazhatsz a kiválasztott árlistára.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="z-date" className="text-xs">Dátum</Label>
              <Input id="z-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="z-price" className="text-xs">Ár (€/kg)</Label>
              <Input id="z-price" inputMode="decimal" placeholder="pl. 2,90" value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntry() } }} />
            </div>
            <div className="space-y-1 flex-1 min-w-40">
              <Label htmlFor="z-note" className="text-xs">Megjegyzés</Label>
              <Input id="z-note" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            </div>
            <Button onClick={addEntry}><Plus className="w-4 h-4 mr-1" /> Jegyzés</Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Utolsó jegyzések</h4>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {entries.length === 0 && <p className="text-sm text-muted-foreground">Még nincs jegyzés.</p>}
                {[...entries].reverse().slice(0, 20).map((e2, i) => (
                  <div key={`${e2.date}-${i}`} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span className="font-mono">{e2.date}</span>
                    <span className="font-mono font-medium">{eur(e2.eurPerKg, 3)} €</span>
                    <Button variant="ghost" size="sm" title="Jegyzés törlése"
                      onClick={() => void setEntries(entries.filter((x) => x !== e2))}>
                      <Trash className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            {[{ title: 'Negyedéves átlagok', data: quarterAvgs }, { title: '2 havi átlagok', data: twoMonthAvgs }].map((blk) => (
              <div key={blk.title}>
                <h4 className="text-sm font-medium mb-2">{blk.title}</h4>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {blk.data.length === 0 && <p className="text-sm text-muted-foreground">Nincs adat.</p>}
                  {blk.data.map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                      <span>{p.label} <span className="text-muted-foreground">({p.count} jegyzés)</span></span>
                      <span className="font-mono font-medium">{eur(p.avg, 4)} €</span>
                      <Button variant="outline" size="sm" disabled={!selected}
                        title={selected ? `Alkalmazás: ${selected.customerName}` : 'Előbb válassz árlistát'}
                        onClick={() => applyAvg(p.label, p.avg)}>
                        Alkalmaz
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---------- Vevőnkénti árlisták ---------- */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Vevői árlisták</CardTitle>
              <CardDescription>Mozgó anyagáras árlisták — {s.priceLists.length} vevő</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Válassz árlistát…" /></SelectTrigger>
                <SelectContent>
                  {s.priceLists.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.customerName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={newList}><Plus className="w-4 h-4 mr-1" /> Új árlista</Button>
            </div>
          </div>
        </CardHeader>
        {selected && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vevő neve</Label>
                <Input list="pl-customers" value={selected.customerName}
                  onChange={(e) => setListField('customerName', e.target.value)} />
                <datalist id="pl-customers">
                  {s.customers.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Leégés (%)</Label>
                <Input inputMode="decimal" value={Math.round(selected.burnRate * 1000) / 10}
                  onChange={(e) => setListField('burnRate', num(e.target.value) / 100)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">MPB (€/kg)</Label>
                <Input inputMode="decimal" value={selected.mpbEurPerKg}
                  onChange={(e) => setListField('mpbEurPerKg', num(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aktuális MP (€/kg)</Label>
                <Input inputMode="decimal" value={selected.currentMpEurPerKg}
                  onChange={(e) => setListField('currentMpEurPerKg', num(e.target.value))} />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="w-full" onClick={() => void downloadPriceListXlsx(selected, s.products)}>
                  <Download className="w-4 h-4 mr-1" /> XLSX
                </Button>
                <Button variant="ghost" title="Árlista törlése (lomtárba)"
                  onClick={() => {
                    if (window.confirm(`Törlöd a(z) ${selected.customerName} árlistát?`)) {
                      s.handleDeletePriceList(selected.id)
                      setSelectedId('')
                    }
                  }}>
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cikkszám</TableHead>
                    <TableHead>Megnevezés</TableHead>
                    <TableHead>Tételnagyság</TableHead>
                    <TableHead>Súly (g)</TableHead>
                    <TableHead>Alapár /100 (€)</TableHead>
                    <TableHead className="text-right">Korrekció /100</TableHead>
                    <TableHead className="text-right">Aktuális ár /100</TableHead>
                    <TableHead className="text-right">Aktuális ár /db</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.items.map((item, idx) => {
                    // A számolt oszlopok a terméktörzs élő súlyával mennek
                    // (ha van cikkszám-egyezés) — mint az Aktuális árak oldalon.
                    const src = resolveItemSource(item, selected.customerName, productIndex)
                    const r = calcPriceListItem(
                      { weightG: src.weightG ?? 0, basePricePer100Eur: item.basePricePer100Eur ?? 0 },
                      selected,
                    )
                    const corrClass = r.correctionPer100Eur > 0.0001
                      ? 'text-destructive'
                      : r.correctionPer100Eur < -0.0001 ? 'text-success' : ''
                    return (
                      <TableRow key={idx}>
                        <TableCell className="min-w-36">
                          <Input value={item.partNumber}
                            onChange={(e) => setItem(idx, { partNumber: e.target.value })} />
                        </TableCell>
                        <TableCell className="min-w-40">
                          <Input value={item.name}
                            onChange={(e) => setItem(idx, { name: e.target.value })} />
                        </TableCell>
                        <TableCell className="min-w-24">
                          <Input value={item.lotSize ?? ''}
                            onChange={(e) => setItem(idx, { lotSize: e.target.value })} />
                        </TableCell>
                        <TableCell className="min-w-24">
                          <Input inputMode="decimal" value={item.weightG ?? ''}
                            onChange={(e) => setItem(idx, { weightG: e.target.value === '' ? null : num(e.target.value) })} />
                        </TableCell>
                        <TableCell className="min-w-28">
                          <Input inputMode="decimal" value={item.basePricePer100Eur ?? ''}
                            onChange={(e) => setItem(idx, { basePricePer100Eur: e.target.value === '' ? null : num(e.target.value) })} />
                        </TableCell>
                        <TableCell className={`text-right font-mono tabular-nums ${corrClass}`}>
                          {eur(r.correctionPer100Eur)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-medium">
                          {eur(r.currentPricePer100Eur)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {eur(r.currentPricePerPieceEur, 6)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" title="Sor törlése"
                            onClick={() => setListField('items', selected.items.filter((_, i) => i !== idx))}>
                            <Trash className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => setListField('items', [...selected.items, { partNumber: '', name: '' }])}>
              <Plus className="w-4 h-4 mr-1" /> Tételsor
            </Button>

            {selected.mpHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">MP-előzmények</h4>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selected.mpHistory.map((h, i) => (
                    <span key={i} className="bg-muted rounded px-2 py-1 font-mono">
                      {h.label}: {eur(h.mp, 4)} € ({h.setAt})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
