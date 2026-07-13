import { useMemo, useState } from 'react'
import { ArrowRight, Gear, Plus, Trash, Warning } from '@phosphor-icons/react'
import { QuoteDialog } from '@/components/QuoteDialog'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppSetting } from '@/hooks/useAppSetting'
import {
  DEFAULT_QUOTE_CALC_SETTINGS, calcQuote, generateQuoteNumber, postProcessPieceEur,
  type QuoteCalcSettings,
} from '@/lib/quoteCalc'
import type { Quote } from '@/lib/types'

/** Szám-input string state-ből, vesszőt is elfogadva. */
const num = (v: string, fallback = 0) => {
  const n = Number.parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

interface PostRow { name: string; cycleTimeS: string; hourlyRateHuf: string }

const eur = (v: number, digits = 4) =>
  `${v.toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`

export default function KalkulatorPage() {
  const s = useAppShell()
  const [settings, setSettings] = useAppSetting<QuoteCalcSettings>(
    'quote-calculator-settings', DEFAULT_QUOTE_CALC_SETTINGS,
  )

  // Bemenetek (stringként — üresen is szerkeszthetők)
  const [drawingNumber, setDrawingNumber] = useState('')
  const [weightG, setWeightG] = useState('')
  const [yearlyQty, setYearlyQty] = useState('')
  const [cavityCount, setCavityCount] = useState('')
  const [cycleTimeS, setCycleTimeS] = useState('')
  const [machineName, setMachineName] = useState(settings.machines[0]?.name ?? 'Idra')
  const [mpb, setMpb] = useState('')
  const [toolPriceEur, setToolPriceEur] = useState('')
  const [postRows, setPostRows] = useState<PostRow[]>([])
  const [fixedPerPieceEur, setFixedPerPieceEur] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)

  const input = useMemo(() => ({
    weightG: num(weightG),
    yearlyQty: num(yearlyQty),
    cavityCount: Math.max(1, num(cavityCount, 1)),
    cycleTimeS: Math.max(1, num(cycleTimeS, 1)),
    machineName,
    mpbEurPerKg: num(mpb, settings.defaultMpbEurPerKg),
  }), [weightG, yearlyQty, cavityCount, cycleTimeS, machineName, mpb, settings.defaultMpbEurPerKg])

  const ready = num(weightG) > 0 && num(cavityCount) > 0 && num(cycleTimeS) > 0
  const r = useMemo(() => calcQuote(input, settings), [input, settings])

  const postPerPiece = useMemo(
    () => postRows.reduce((sum, row) =>
      num(row.cycleTimeS) > 0
        ? sum + postProcessPieceEur(
            { cycleTimeS: num(row.cycleTimeS), hourlyRateHuf: num(row.hourlyRateHuf) },
            settings.eurHuf,
          )
        : sum, 0),
    [postRows, settings.eurHuf],
  )
  const fixedPerPiece = num(fixedPerPieceEur)
  const grandTotalPerPiece = r.totalPerPieceEur + postPerPiece + fixedPerPiece

  const quotePrefill = useMemo((): Partial<Quote> => ({
    number: generateQuoteNumber(s.quotes),
    mpb: String(input.mpbEurPerKg),
    yearlyAmount: input.yearlyQty > 0 ? `${input.yearlyQty.toLocaleString('hu-HU')} pcs` : '',
    items: [{
      drawingNumber,
      cavityCount: input.cavityCount,
      weightG: input.weightG,
      dieCastingFeeEur: Number(r.laborPerPieceEur.toFixed(6)),
      materialCostEur: Number(r.materialPerPieceEur.toFixed(6)),
      totalPieceEur: Number(grandTotalPerPiece.toFixed(6)),
      mouldPriceEur: num(toolPriceEur) > 0 ? num(toolPriceEur) : null,
    }],
    calc: { input, postRows, fixedPerPieceEur, toolPriceEur },
  }), [s.quotes, input, drawingNumber, r, grandTotalPerPiece, toolPriceEur, postRows, fixedPerPieceEur])

  const setMachineField = (idx: number, field: 'shotFeeHuf' | 'maxShotWeightG', v: string) => {
    void setSettings({
      ...settings,
      machines: settings.machines.map((m, i) => (i === idx ? { ...m, [field]: num(v) } : m)),
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* ------------ Bemenetek ------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Darabár-kalkulátor</CardTitle>
          <CardDescription>Az Excel-kalkulátor képleteivel számol (leégés {Math.round(settings.burnRate * 100)}%, engusz {Math.round(settings.sprueRate * 100)}%).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-drawing">Rajzszám</Label>
              <Input id="c-drawing" value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-weight">1 db súlya (g) *</Label>
              <Input id="c-weight" inputMode="decimal" value={weightG} onChange={(e) => setWeightG(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-yearly">Éves mennyiség (db)</Label>
              <Input id="c-yearly" inputMode="numeric" value={yearlyQty} onChange={(e) => setYearlyQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-cavity">Fészekszám *</Label>
              <Input id="c-cavity" inputMode="numeric" value={cavityCount} onChange={(e) => setCavityCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-cycle">Ciklusidő (s) *</Label>
              <Input id="c-cycle" inputMode="decimal" value={cycleTimeS} onChange={(e) => setCycleTimeS(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Öntőgép</Label>
              <Select value={machineName} onValueChange={setMachineName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings.machines.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name} ({m.shotFeeHuf} HUF/lövés)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-mpb">MPB — anyagár (€/kg)</Label>
              <Input id="c-mpb" inputMode="decimal" value={mpb}
                placeholder={String(settings.defaultMpbEurPerKg)}
                onChange={(e) => setMpb(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-tool">Szerszámár (€)</Label>
              <Input id="c-tool" inputMode="decimal" value={toolPriceEur} onChange={(e) => setToolPriceEur(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Utómunka tételek</Label>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setPostRows((rows) => [...rows, { name: '', cycleTimeS: '', hourlyRateHuf: '' }])}>
                <Plus className="w-4 h-4 mr-1" /> Tétel
              </Button>
            </div>
            {postRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_110px_130px_auto] gap-2 items-center">
                <Input placeholder="pl. Menet" value={row.name}
                  onChange={(e) => setPostRows((rs) => rs.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                <Input placeholder="idő (s)" inputMode="decimal" value={row.cycleTimeS}
                  onChange={(e) => setPostRows((rs) => rs.map((x, i) => i === idx ? { ...x, cycleTimeS: e.target.value } : x))} />
                <Input placeholder="óradíj (HUF)" inputMode="numeric" value={row.hourlyRateHuf}
                  onChange={(e) => setPostRows((rs) => rs.map((x, i) => i === idx ? { ...x, hourlyRateHuf: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="sm" title="Tétel törlése"
                  onClick={() => setPostRows((rs) => rs.filter((_, i) => i !== idx))}>
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_130px] gap-2 items-center">
              <Label htmlFor="c-fixed" className="text-muted-foreground">Egyéb fix költség (€/db)</Label>
              <Input id="c-fixed" inputMode="decimal" value={fixedPerPieceEur}
                onChange={(e) => setFixedPerPieceEur(e.target.value)} />
            </div>
          </div>

          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-2">
                <Gear className="w-4 h-4" /> Beállítások (árfolyam, gépek, százalékok)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Árfolyam (HUF/EUR)</Label>
                  <Input inputMode="decimal" value={settings.eurHuf}
                    onChange={(e) => void setSettings({ ...settings, eurHuf: num(e.target.value, 370) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Leégés (%)</Label>
                  <Input inputMode="decimal" value={Math.round(settings.burnRate * 1000) / 10}
                    onChange={(e) => void setSettings({ ...settings, burnRate: num(e.target.value) / 100 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Engusz (%)</Label>
                  <Input inputMode="decimal" value={Math.round(settings.sprueRate * 1000) / 10}
                    onChange={(e) => void setSettings({ ...settings, sprueRate: num(e.target.value) / 100 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Munkaóra/nap</Label>
                  <Input inputMode="numeric" value={settings.workHoursPerDay}
                    onChange={(e) => void setSettings({ ...settings, workHoursPerDay: num(e.target.value, 16) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Gépek (lövésár HUF · max lövéssúly g)</Label>
                {settings.machines.map((m, idx) => (
                  <div key={m.name} className="grid grid-cols-[1fr_120px_120px] gap-2 items-center">
                    <span className="text-sm">{m.name}</span>
                    <Input inputMode="numeric" value={m.shotFeeHuf}
                      onChange={(e) => setMachineField(idx, 'shotFeeHuf', e.target.value)} />
                    <Input inputMode="numeric" value={m.maxShotWeightG}
                      onChange={(e) => setMachineField(idx, 'maxShotWeightG', e.target.value)} />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* ------------ Eredmények ------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Eredmény</CardTitle>
          <CardDescription>
            {ready ? 'Élőben számolva a bal oldali bemenetekből.' : 'Add meg a súlyt, fészekszámot és ciklusidőt.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ready && (
            <>
              {r.shotWeightExceedsMachine && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  <Warning className="w-4 h-4" weight="fill" />
                  A lövés súlya ({r.shotWeightG.toLocaleString('hu-HU')} g) meghaladja a gép kapacitását!
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Anyagár / 100 db</div>
                  <div className="text-xl font-bold font-mono tabular-nums">{eur(r.materialPer100Eur)}</div>
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Munkadíj / 100 db</div>
                  <div className="text-xl font-bold font-mono tabular-nums">{eur(r.laborPer100Eur)}</div>
                </div>
                {postPerPiece + fixedPerPiece > 0 && (
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Utómunka + fix / db</div>
                    <div className="text-xl font-bold font-mono tabular-nums">{eur(postPerPiece + fixedPerPiece)}</div>
                  </div>
                )}
                <div className="bg-primary/10 rounded-lg px-3 py-2 col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Össz darabár</div>
                  <div className="text-2xl font-bold font-mono tabular-nums">
                    {eur(grandTotalPerPiece, 5)}
                    <span className="text-sm font-normal text-muted-foreground ml-3">
                      ({eur(grandTotalPerPiece * 100, 3)} / 100 db)
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-sm space-y-1 text-muted-foreground">
                <div className="flex justify-between"><span>Lövés súlya (engusszal)</span><span className="font-mono text-foreground">{r.shotWeightG.toLocaleString('hu-HU')} g</span></div>
                <div className="flex justify-between"><span>Gép óradíja</span><span className="font-mono text-foreground">{Math.round(r.machineHourlyHuf).toLocaleString('hu-HU')} HUF = {eur(r.machineHourlyEur, 2)}</span></div>
                <div className="flex justify-between"><span>Kapacitás</span><span className="font-mono text-foreground">{Math.round(r.piecesPerHour).toLocaleString('hu-HU')} db/óra · {Math.round(r.piecesPerDay).toLocaleString('hu-HU')} db/nap</span></div>
                {input.yearlyQty > 0 && (
                  <>
                    <div className="flex justify-between"><span>Éves mennyiség leöntése</span><span className="font-mono text-foreground">{r.daysForYearlyQty.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} nap ({r.hoursForYearlyQty.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} óra)</span></div>
                    <div className="flex justify-between"><span>Éves anyagigény (leégéssel)</span><span className="font-mono text-foreground">{r.yearlyMaterialKg.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} kg</span></div>
                  </>
                )}
              </div>

              <Button className="w-full" onClick={() => setQuoteDialogOpen(true)}>
                Ajánlatba emelés <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <QuoteDialog
        open={quoteDialogOpen}
        onClose={() => setQuoteDialogOpen(false)}
        onSave={s.handleSaveQuote}
        quote={null}
        prefill={quotePrefill}
        customers={s.customers}
      />
    </div>
  )
}
