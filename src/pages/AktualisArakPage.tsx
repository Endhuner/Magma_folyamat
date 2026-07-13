import { useMemo, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { stripDiacritics } from '@/lib/helpers'
import { buildProductIndex, calcPriceListItem, resolveItemSource } from '@/lib/materialPriceCalc'
import type { PriceList } from '@/lib/types'

const eur = (v: number, digits = 4) =>
  v.toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Egy sor: vevő-árlista tétel + élőben számolt aktuális ár.
 * A megnevezés és a súly a TERMÉKTÖRZSBŐL jön, ha a cikkszám egyezik
 * (linked) — a termék módosítása azonnal átvezet ide. */
interface FlatRow {
  key: string
  customer: string
  partNumber: string
  name: string
  weightG: number
  linked: boolean
  basePricePer100: number
  /** Anyagár nélküli ár (a képlet MP=0-val): a tiszta munkadíj. */
  laborPer100: number
  correctionPer100: number
  currentPer100: number
  currentPerPiece: number
}

export default function AktualisArakPage() {
  const s = useAppShell()
  const [query, setQuery] = useState('')
  const [customerFilter, setCustomerFilter] = useState('mind')

  const num = (v: string, fallback = 0) => {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : fallback
  }

  const setMp = (pl: PriceList, value: string) => {
    const mp = num(value, pl.currentMpEurPerKg)
    if (mp !== pl.currentMpEurPerKg) s.handleSavePriceList({ id: pl.id, currentMpEurPerKg: mp })
  }

  const productIndex = useMemo(() => buildProductIndex(s.products), [s.products])

  const rows = useMemo((): FlatRow[] => {
    const out: FlatRow[] = []
    for (const pl of s.priceLists) {
      if (customerFilter !== 'mind' && pl.id !== customerFilter) continue
      for (const [idx, item] of pl.items.entries()) {
        // Élő forrás: megnevezés + súly a terméktörzsből (cikkszám-egyezésnél).
        const src = resolveItemSource(item, pl.customerName, productIndex)
        const weightG = src.weightG ?? 0
        if (!weightG || item.basePricePer100Eur == null) continue
        const r = calcPriceListItem(
          { weightG, basePricePer100Eur: item.basePricePer100Eur },
          pl,
        )
        // Munkadíj = anyagár nélküli ár: ugyanez a képlet, de MP=0 →
        // az alapárból kivonjuk a benne lévő anyagköltséget (MPB-n).
        const labor = calcPriceListItem(
          { weightG, basePricePer100Eur: item.basePricePer100Eur },
          { ...pl, currentMpEurPerKg: 0 },
        )
        out.push({
          key: `${pl.id}-${idx}`,
          customer: pl.customerName,
          partNumber: item.partNumber,
          name: src.name,
          weightG,
          linked: src.linked,
          basePricePer100: item.basePricePer100Eur,
          laborPer100: labor.currentPricePer100Eur,
          correctionPer100: r.correctionPer100Eur,
          currentPer100: r.currentPricePer100Eur,
          currentPerPiece: r.currentPricePerPieceEur,
        })
      }
    }
    const q = stripDiacritics(query)
    return q
      ? out.filter((r) => stripDiacritics(`${r.customer} ${r.partNumber} ${r.name}`).includes(q))
      : out
  }, [s.priceLists, productIndex, customerFilter, query])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Aktuális árak</h2>
        <p className="text-muted-foreground">
          Az összes termék a vevői árlistákból — az alapár a szerződéses anyagáron (MPB) készült,
          az aktuális ár a mostani anyagárral (MP) élőben számolódik.
          A megnevezés és a súly a terméktörzsből jön (zöld pont), a termék módosítása
          azonnal átvezet ide. A <b>Munkadíj</b> az anyagár nélküli ár (a képlet 0 anyagárral).
          {' '}{rows.length} tétel, ebből {rows.filter((r) => r.linked).length} termékhez kötve.
        </p>
      </div>

      {/* Vevőnkénti paraméter-sáv: itt állítod az aktuális MP-t — minden sor azonnal újraszámol. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {s.priceLists.map((pl) => (
          <div key={pl.id} className="bg-card border rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{pl.customerName}</div>
              <div className="text-xs text-muted-foreground">
                MPB {eur(pl.mpbEurPerKg, 2)} €/kg · leégés {Math.round(pl.burnRate * 100)}% · {pl.items.length} tétel
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Akt. MP €/kg</div>
              <Input
                key={`${pl.id}-${pl.currentMpEurPerKg}`}
                className="h-8 w-24 text-right font-mono"
                inputMode="decimal"
                defaultValue={pl.currentMpEurPerKg}
                onBlur={(e) => setMp(pl, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Keresés cikkszám, megnevezés vagy vevő szerint..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mind">Minden vevő</SelectItem>
            {s.priceLists.map((pl) => (
              <SelectItem key={pl.id} value={pl.id}>{pl.customerName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vevő</TableHead>
              <TableHead>Cikkszám</TableHead>
              <TableHead>Megnevezés</TableHead>
              <TableHead className="text-right">Súly (g)</TableHead>
              <TableHead className="text-right">Alapár /100 (€)</TableHead>
              <TableHead className="text-right">Munkadíj /100 (€)</TableHead>
              <TableHead className="text-right">Korrekció /100</TableHead>
              <TableHead className="text-right">Aktuális ár /100</TableHead>
              <TableHead className="text-right">Aktuális ár /db</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {s.priceLists.length === 0
                    ? 'Még nincs árlista — az Árajánlat → Anyagárak oldalon hozhatod létre.'
                    : 'Nincs találat.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const corrClass = r.correctionPer100 > 0.0001
                ? 'text-destructive'
                : r.correctionPer100 < -0.0001 ? 'text-success' : 'text-muted-foreground'
              return (
                <TableRow key={r.key}>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    {r.partNumber}
                    {r.linked ? (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-success align-middle"
                        title="Megnevezés és súly élőben a terméktörzsből" />
                    ) : (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 align-middle"
                        title="Nincs egyező rajzszámú termék a törzsben — a tárolt adatok látszanak" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={r.name}>{r.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.weightG.toLocaleString('hu-HU')}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{eur(r.basePricePer100)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums" title="Anyagár nélküli ár (a képlet MP=0-val)">{eur(r.laborPer100)}</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${corrClass}`}>
                    {r.correctionPer100 > 0 ? '+' : ''}{eur(r.correctionPer100)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">{eur(r.currentPer100)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{eur(r.currentPerPiece, 6)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        A tételek és a szerződéses paraméterek (MPB, leégés) az Árajánlat → Anyagárak oldalon
        szerkeszthetők; a zamak-átlagok is ott alkalmazhatók egy kattintással.
      </p>
    </div>
  )
}
