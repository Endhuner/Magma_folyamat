import { useState } from 'react'
import { Copy, FileArrowDown, FileXls, Trash } from '@phosphor-icons/react'
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
import { generateId } from '@/lib/generateId'
import {
  fillAndDownloadMohu, fillAndDownloadIntermetal, INTERMETAL_CATEGORIES,
  type MohuFillData, type IntermetalFillData,
} from '@/lib/formFill'
import type { FilledForm, FilledFormType } from '@/lib/types'

const FORM_LABEL: Record<FilledFormType, string> = {
  mohu: 'MOHU gyűjtőhelyi szállítólevél',
  intermetal: 'Intermetal fémleadó nyilatkozat',
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const EMPTY_MOHU = (): Record<string, string> => ({
  date: todayISO(), transportMode: 'Begyűjtés',
  orderNumber: '', vehiclePlate: '', trailerPlate: '', netQuantity: '', wasteName: '',
})
const EMPTY_INTERMETAL = (): Record<string, string> => ({
  date: todayISO(), docNumber: '', signerName: '',
  category: INTERMETAL_CATEGORIES[0].label,
})

export default function UrlapokPage() {
  const s = useAppShell()
  const [formType, setFormType] = useState<FilledFormType>('mohu')
  const [data, setData] = useState<Record<string, string>>(EMPTY_MOHU())
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }))

  const startNew = (type: FilledFormType, base?: Record<string, string>) => {
    setFormType(type)
    setData(base ?? (type === 'mohu' ? EMPTY_MOHU() : EMPTY_INTERMETAL()))
  }

  const titleOf = () =>
    formType === 'mohu'
      ? `MOHU ${data.date}${data.orderNumber ? ` — ${data.orderNumber}` : ''}`
      : `Intermetal ${data.date}${data.docNumber ? ` — ${data.docNumber}` : ''}`

  /** Az EREDETI fájlt tölti ki és letölti; a kitöltést a történetbe menti. */
  const fillAndDownload = async () => {
    setBusy(true)
    try {
      if (formType === 'mohu') {
        await fillAndDownloadMohu(data as unknown as MohuFillData)
      } else {
        await fillAndDownloadIntermetal(data as unknown as IntermetalFillData)
      }
      s.handleSaveFilledForm({ id: generateId(), formType, title: titleOf(), data })
      toast.success('Kitöltött dokumentum letöltve — nyisd meg és nyomtasd.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'A kitöltés nem sikerült.')
    } finally {
      setBusy(false)
    }
  }

  const reopen = (f: FilledForm) => startNew(f.formType, { ...f.data })
  const history = [...s.filledForms].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Kitöltendő űrlapok</h2>
        <p className="text-muted-foreground">
          Az <strong>eredeti hivatalos dokumentumokat</strong> töltjük ki a beírt adatokkal
          (MOHU: az eredeti Excel, Intermetal: az eredeti PDF), és a kész fájlt letöltöd nyomtatásra.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={formType} onValueChange={(v) => startNew(v as FilledFormType)}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mohu">{FORM_LABEL.mohu}</SelectItem>
            <SelectItem value="intermetal">{FORM_LABEL.intermetal}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => startNew(formType)}>
          Új kitöltés
        </Button>
        <span className="flex-1" />
        <Button onClick={fillAndDownload} disabled={busy}>
          {formType === 'mohu'
            ? <FileXls className="w-4 h-4 mr-1" weight="duotone" />
            : <FileArrowDown className="w-4 h-4 mr-1" weight="duotone" />}
          Kitöltés és letöltés
        </Button>
      </div>

      {formType === 'mohu' ? (
        <Card>
          <CardHeader>
            <CardTitle>{FORM_LABEL.mohu}</CardTitle>
            <CardDescription>
              A fix adatok (telephely, HAK, átvevő, göngyöleg…) az eredeti sablonban vannak —
              csak a szállításonként változó mezőket töltsd ki. Nyomtatáskor 4 példány.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="m-date">Teljesítés kelte</Label>
              <Input id="m-date" type="date" value={data.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Szállítás módja</Label>
              <Select value={data.transportMode} onValueChange={(v) => set('transportMode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Begyűjtés">Begyűjtés</SelectItem>
                  <SelectItem value="Áttárolás">Áttárolás</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-order">Megrendelés száma</Label>
              <Input id="m-order" value={data.orderNumber} onChange={(e) => set('orderNumber', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-qty">Nettó mennyiség (kg)</Label>
              <Input id="m-qty" inputMode="numeric" value={data.netQuantity} onChange={(e) => set('netQuantity', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-plate">Jármű rendszáma</Label>
              <Input id="m-plate" value={data.vehiclePlate} onChange={(e) => set('vehiclePlate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-trailer">Pótkocsi rendszáma</Label>
              <Input id="m-trailer" value={data.trailerPlate} onChange={(e) => set('trailerPlate', e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="m-waste">Hulladék megnevezés (ha eltér az alapértelmezettől)</Label>
              <Input id="m-waste" placeholder="alapértelmezett: Papír hulladék hullámkarton…"
                value={data.wasteName} onChange={(e) => set('wasteName', e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{FORM_LABEL.intermetal}</CardTitle>
            <CardDescription>
              A 309/2023 (VII.14.) Korm. rendelet szerinti nyilatkozat — az eredeti PDF-re írjuk rá az adatokat.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="i-doc">Szállítólevél / okmány száma</Label>
              <Input id="i-doc" value={data.docNumber} onChange={(e) => set('docNumber', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-date">Kelt</Label>
              <Input id="i-date" type="date" value={data.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-signer">Aláíró neve</Label>
              <Input id="i-signer" value={data.signerName} onChange={(e) => set('signerName', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Hulladék-kategória (X)</Label>
              <Select value={data.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERMETAL_CATEGORIES.map((c) => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- Történet ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Kitöltés-történet</CardTitle>
          <CardDescription>{history.length} mentett kitöltés — újbóli letöltéshez vagy másolat-alapnak nyisd meg.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground">Még nincs mentett kitöltés.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Típus</TableHead>
                  <TableHead>Cím</TableHead>
                  <TableHead>Mentve</TableHead>
                  <TableHead className="text-right">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{FORM_LABEL[f.formType]}</TableCell>
                    <TableCell>{f.title}</TableCell>
                    <TableCell className="font-mono text-xs">{f.createdAt.slice(0, 16).replace('T', ' ')}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" title="Megnyitás (adatok betöltése)"
                        onClick={() => reopen(f)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Törlés (lomtárba)"
                        onClick={() => {
                          if (window.confirm('Törlöd a kitöltést?')) s.handleDeleteFilledForm(f.id)
                        }}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
