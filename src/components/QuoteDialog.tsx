import { useEffect, useRef, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { generateId } from '@/lib/generateId'
import type { Customer, Quote, QuoteItem } from '@/lib/types'

interface QuoteDialogProps {
  open: boolean
  onClose: () => void
  onSave: (q: Partial<Quote> & { id: string }) => void
  /** null = új ajánlat (a number-t a hívó generálja a prefillbe). */
  quote: Quote | null
  prefill?: Partial<Quote>
  customers: Customer[]
}

/** Szerkeszthető tételsor — a szám-mezők stringként élnek, mentéskor parse-olunk. */
interface ItemDraft {
  drawingNumber: string
  cavityCount: string
  weightG: string
  dieCastingFeeEur: string
  materialCostEur: string
  totalPieceEur: string
  mouldPriceEur: string
}

const EMPTY_ITEM: ItemDraft = {
  drawingNumber: '', cavityCount: '', weightG: '', dieCastingFeeEur: '',
  materialCostEur: '', totalPieceEur: '', mouldPriceEur: '',
}

function toDraft(i: QuoteItem): ItemDraft {
  const str = (v: number | null | undefined) => (v == null ? '' : String(v))
  return {
    drawingNumber: i.drawingNumber || '',
    cavityCount: str(i.cavityCount),
    weightG: str(i.weightG),
    dieCastingFeeEur: str(i.dieCastingFeeEur),
    materialCostEur: str(i.materialCostEur),
    totalPieceEur: str(i.totalPieceEur),
    mouldPriceEur: str(i.mouldPriceEur),
  }
}

function fromDraft(d: ItemDraft): QuoteItem {
  const num = (v: string) => {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return {
    drawingNumber: d.drawingNumber.trim(),
    cavityCount: num(d.cavityCount),
    weightG: num(d.weightG),
    dieCastingFeeEur: num(d.dieCastingFeeEur),
    materialCostEur: num(d.materialCostEur),
    totalPieceEur: num(d.totalPieceEur),
    mouldPriceEur: num(d.mouldPriceEur),
  }
}

const ITEM_COLS: Array<{ key: keyof ItemDraft; label: string; numeric?: boolean }> = [
  { key: 'drawingNumber', label: 'Rajzszám' },
  { key: 'cavityCount', label: 'Fészek', numeric: true },
  { key: 'weightG', label: 'Súly (g)', numeric: true },
  { key: 'dieCastingFeeEur', label: 'Öntési díj (€)', numeric: true },
  { key: 'materialCostEur', label: 'Anyagktg. (€)', numeric: true },
  { key: 'totalPieceEur', label: 'Darabár (€)', numeric: true },
  { key: 'mouldPriceEur', label: 'Szerszámár (€)', numeric: true },
]

export function QuoteDialog({ open, onClose, onSave, quote, prefill, customers }: QuoteDialogProps) {
  const [form, setForm] = useState<Partial<Quote>>({})
  const [items, setItems] = useState<ItemDraft[]>([EMPTY_ITEM])
  const [numberError, setNumberError] = useState('')
  const initialRef = useRef('')

  useEffect(() => {
    if (!open) return
    const base: Partial<Quote> = quote ?? { validityDays: 30, incoterms: 'EXW', ...prefill }
    const drafts = (quote?.items?.length ? quote.items : prefill?.items ?? []).map(toDraft)
    const nextItems = drafts.length > 0 ? drafts : [{ ...EMPTY_ITEM }]
    setForm(base)
    setItems(nextItems)
    setNumberError('')
    initialRef.current = JSON.stringify({ base, nextItems })
  }, [open, quote, prefill])

  const set = (field: keyof Quote, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  const requestClose = () => {
    const dirty = JSON.stringify({ base: form, nextItems: items }) !== initialRef.current
    if (dirty && !window.confirm('Elveted a módosításokat?')) return
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.number?.trim()) {
      setNumberError('Az ajánlatszám kötelező!')
      return
    }
    onSave({
      ...form,
      id: quote?.id ?? generateId(),
      number: form.number.trim(),
      items: items.map(fromDraft).filter((i) =>
        i.drawingNumber || i.totalPieceEur != null || i.mouldPriceEur != null),
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose() }}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{quote ? `Ajánlat szerkesztése — ${quote.number}` : 'Új ajánlat'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-6 pr-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="q-number">Ajánlatszám *</Label>
                <Input id="q-number" value={form.number || ''}
                  onChange={(e) => { set('number', e.target.value); setNumberError('') }} />
                {numberError && <p className="text-sm text-destructive" role="alert">{numberError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-customer">Megrendelő</Label>
                <Input id="q-customer" list="quote-customers" value={form.customerName || ''}
                  onChange={(e) => set('customerName', e.target.value)} />
                <datalist id="quote-customers">
                  {customers.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-contact">Kontakt (To)</Label>
                <Input id="q-contact" value={form.contactName || ''}
                  onChange={(e) => set('contactName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-rfq">Árajánlatkérő szám</Label>
                <Input id="q-rfq" value={form.rfqNumber || ''}
                  onChange={(e) => set('rfqNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-email">E-mail dátuma</Label>
                <Input id="q-email" type="date" value={form.emailDate || ''}
                  onChange={(e) => set('emailDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-deadline">Ajánlatadás határideje</Label>
                <Input id="q-deadline" type="date" value={form.deadline || ''}
                  onChange={(e) => set('deadline', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-qty">Termék mennyisége</Label>
                <Input id="q-qty" value={form.quantityNote || ''}
                  onChange={(e) => set('quantityNote', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-notes">Megjegyzés</Label>
                <Input id="q-notes" value={form.notes || ''}
                  onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Quotation adatok (PDF)</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="q-material">Material</Label>
                  <Input id="q-material" value={form.material || ''}
                    onChange={(e) => set('material', e.target.value)} placeholder="pl. Z 410" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-yearly">Yearly amount</Label>
                  <Input id="q-yearly" value={form.yearlyAmount || ''}
                    onChange={(e) => set('yearlyAmount', e.target.value)} placeholder="pl. 2 500 000 pcs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-moq">MOQ</Label>
                  <Input id="q-moq" value={form.moq || ''}
                    onChange={(e) => set('moq', e.target.value)} placeholder="pl. 500 000 pcs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-lead">Mould leadtime (hét)</Label>
                  <Input id="q-lead" value={form.mouldLeadtimeWeeks || ''}
                    onChange={(e) => set('mouldLeadtimeWeeks', e.target.value)} placeholder="pl. 10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-mpb">MPB (€/kg)</Label>
                  <Input id="q-mpb" value={form.mpb || ''}
                    onChange={(e) => set('mpb', e.target.value)} placeholder="pl. 3" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      {ITEM_COLS.map((c) => <th key={c.key} className="px-1 pb-1 font-medium">{c.label}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => (
                      <tr key={idx}>
                        {ITEM_COLS.map((c) => (
                          <td key={c.key} className="px-1 py-1 min-w-24">
                            <Input
                              value={row[c.key]}
                              inputMode={c.numeric ? 'decimal' : undefined}
                              onChange={(e) => setItems((list) =>
                                list.map((r, i) => (i === idx ? { ...r, [c.key]: e.target.value } : r)))}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <Button type="button" variant="ghost" size="sm" title="Sor törlése"
                            onClick={() => setItems((list) =>
                              list.length > 1 ? list.filter((_, i) => i !== idx) : [{ ...EMPTY_ITEM }])}>
                            <Trash className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setItems((list) => [...list, { ...EMPTY_ITEM }])}>
                <Plus className="w-4 h-4 mr-1" /> Tételsor
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="q-pay">Payment terms</Label>
                  <Textarea id="q-pay" rows={3} value={form.paymentTerms || ''}
                    onChange={(e) => set('paymentTerms', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-addnotes">Additional notes</Label>
                  <Textarea id="q-addnotes" rows={3} value={form.additionalNotes || ''}
                    onChange={(e) => set('additionalNotes', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-incoterms">Incoterms</Label>
                  <Input id="q-incoterms" value={form.incoterms || ''}
                    onChange={(e) => set('incoterms', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-validity">Érvényesség (nap)</Label>
                  <Input id="q-validity" type="number" inputMode="numeric" min={1}
                    value={form.validityDays ?? 30}
                    onChange={(e) => set('validityDays', Number.parseInt(e.target.value, 10) || 30)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={requestClose}>Mégse</Button>
              <Button type="submit">{quote ? 'Frissítés' : 'Létrehozás'}</Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
