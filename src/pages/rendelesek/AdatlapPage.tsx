import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Plus, Printer, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateId } from '@/lib/generateId'
import type { ProductDatasheet } from '@/lib/types'

/** A minta-Excel default sorai új adatlaphoz. */
const DEFAULT_MACHINE_SETTINGS = [
  { label: 'Anyaghőmérséklet (°C)', value: '' },
  { label: 'Nyomás-alapbeállítás', value: '' },
  { label: 'Dűzni méret', value: '' },
  { label: 'Öntőgép méret', value: '' },
  { label: 'Ellenőrzés', value: 'Óránként' },
]
const DEFAULT_CASTING_CHECKS = [
  { operation: 'Állandó felügyelet mellett öntés', responsible: 'Öntő, gyártásközi ellenőr', tool: '' },
]
const DEFAULT_POST_OPERATIONS = [
  { operation: 'Öntés', place: 'Öntöde', time: '' },
  { operation: 'Enguszletörés', place: 'Válogató dob', time: 'Öntés közben' },
  { operation: 'Koptatás', place: 'Mosó', time: '' },
  { operation: 'Mosás', place: 'Mosó', time: '' },
  { operation: 'Szárítás', place: 'Szárító', time: '' },
]

function resizeImageToBase64(file: File, maxPx = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('olvasási hiba'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('kép-hiba'))
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function AdatlapPage() {
  const s = useAppShell()
  const navigate = useNavigate()
  const { productId } = useParams<{ productId: string }>()
  const product = s.products.find((p) => p.id === productId)
  const existing = s.datasheets.find((d) => d.productId === productId)
  const fileRef = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState<ProductDatasheet | null>(null)
  useEffect(() => {
    if (!productId) return
    setDraft(
      existing ?? {
        id: generateId(),
        productId,
        docId: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        preparedBy: '', checkedBy: '', approvedBy: '',
        photoUrl: '',
        machineSettings: DEFAULT_MACHINE_SETTINGS.map((r) => ({ ...r })),
        castingChecks: DEFAULT_CASTING_CHECKS.map((r) => ({ ...r })),
        postOperations: DEFAULT_POST_OPERATIONS.map((r) => ({ ...r })),
        finalInspection: '',
        packagingInstructions: '',
        createdAt: '', updatedAt: '',
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, existing?.id])

  if (!product || !draft) {
    return (
      <div className="text-muted-foreground">
        A termék nem található.{' '}
        <Button variant="link" onClick={() => navigate('/rendelesek/termekek')}>Vissza a termékekhez</Button>
      </div>
    )
  }

  const set = <K extends keyof ProductDatasheet>(k: K, v: ProductDatasheet[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d))

  const save = () => {
    s.handleSaveDatasheet(draft)
    toast.success('Adatlap mentve.')
  }

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      set('photoUrl', await resizeImageToBase64(file))
    } catch {
      toast.error('A kép betöltése nem sikerült.')
    }
  }

  /** Általános sor-szerkesztő tábla (mindhárom szakaszhoz). */
  function RowsEditor<T extends Record<string, string>>({ rows, cols, onChange }: {
    rows: T[]
    cols: Array<{ key: keyof T & string; label: string }>
    onChange: (rows: T[]) => void
  }) {
    return (
      <div className="space-y-1">
        <div className="hidden md:grid gap-2 text-xs text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) 2.5rem` }}>
          {cols.map((c) => <span key={c.key}>{c.label}</span>)}
          <span />
        </div>
        {rows.map((row, idx) => (
          <div key={idx} className="grid gap-2 items-center"
            style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) 2.5rem` }}>
            {cols.map((c) => (
              <Input key={c.key} value={row[c.key] ?? ''} placeholder={c.label}
                onChange={(e) => onChange(rows.map((r, i) =>
                  i === idx ? { ...r, [c.key]: e.target.value } : r))} />
            ))}
            <Button type="button" variant="ghost" size="sm" title="Sor törlése" className="no-print"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="no-print"
          onClick={() => onChange([...rows, Object.fromEntries(cols.map((c) => [c.key, ''])) as T])}>
          <Plus className="w-4 h-4 mr-1" /> Sor
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-5 print-datasheet">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          [data-slot='sidebar-wrapper'] > *:not([data-slot='sidebar-inset']) { display: none !important; }
          header, .no-print { display: none !important; }
          .print-datasheet input, .print-datasheet textarea {
            border: none !important; box-shadow: none !important; padding: 0 !important;
            height: auto !important; font-size: 10pt;
          }
          .print-datasheet section { border: 0.3mm solid #666 !important; break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rendelesek/termekek')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Termékek
        </Button>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Nyomtatás
        </Button>
        <Button size="sm" onClick={save}>Mentés</Button>
      </div>

      {/* Fejléc a minta szerint */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">TERMÉK INFORMÁCIÓS ADATLAP</h2>
            <p className="text-sm text-muted-foreground">
              {product.drawingNumber || product.productName} — {product.customer}
              {product.material ? ` · ${product.material}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Label className="self-center" htmlFor="ds-docid">Azonosító</Label>
            <Input id="ds-docid" className="h-8 w-36" value={draft.docId}
              onChange={(e) => set('docId', e.target.value)} placeholder="pl. MU-7-00-0" />
            <Label className="self-center" htmlFor="ds-eff">Érvénybelépés</Label>
            <Input id="ds-eff" type="date" className="h-8 w-36" value={draft.effectiveDate}
              onChange={(e) => set('effectiveDate', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([['preparedBy', 'Készítette'], ['checkedBy', 'Ellenőrizte'], ['approvedBy', 'Jóváhagyta']] as const)
            .map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`ds-${k}`}>{label}</Label>
                <Input id={`ds-${k}`} value={draft[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
        </div>
        <div className="flex items-start gap-4">
          <div className="space-y-2">
            <Label>Fotó</Label>
            <div>
              {draft.photoUrl ? (
                <img src={draft.photoUrl} alt="Termékfotó" className="max-h-40 rounded border" />
              ) : (
                <div className="h-24 w-32 rounded border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                  nincs fotó
                </div>
              )}
            </div>
            <div className="flex gap-2 no-print">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="w-4 h-4 mr-1" /> Feltöltés
              </Button>
              {draft.photoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set('photoUrl', '')}>
                  Törlés
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => void uploadPhoto(e.target.files?.[0])} />
            </div>
          </div>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Gépbeállítási adatok</h3>
        <RowsEditor rows={draft.machineSettings}
          cols={[{ key: 'label', label: 'Paraméter' }, { key: 'value', label: 'Érték' }]}
          onChange={(rows) => set('machineSettings', rows)} />
      </section>

      <section className="border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Öntésellenőrzés</h3>
        <RowsEditor rows={draft.castingChecks}
          cols={[
            { key: 'operation', label: 'Művelet' },
            { key: 'responsible', label: 'Felelős' },
            { key: 'tool', label: 'Mérőeszköz (helye)' },
          ]}
          onChange={(rows) => set('castingChecks', rows)} />
      </section>

      <section className="border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Öntés utáni műveletek</h3>
        <RowsEditor rows={draft.postOperations}
          cols={[
            { key: 'operation', label: 'Művelet' },
            { key: 'place', label: 'Helye' },
            { key: 'time', label: 'Idő' },
          ]}
          onChange={(rows) => set('postOperations', rows)} />
      </section>

      <section className="border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Végellenőrzés</h3>
        <Textarea rows={2} value={draft.finalInspection}
          onChange={(e) => set('finalInspection', e.target.value)}
          placeholder="Felelősök, ellenőrzési pontok…" />
      </section>

      <section className="border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Csomagolási útmutató</h3>
        <Textarea rows={3} value={draft.packagingInstructions}
          onChange={(e) => set('packagingInstructions', e.target.value)}
          placeholder="pl. MEO-ellenőrzött áru, 10 000 darab / rácsosláda…" />
      </section>

      <div className="flex justify-end no-print">
        <Button onClick={save}>Mentés</Button>
      </div>
    </div>
  )
}
