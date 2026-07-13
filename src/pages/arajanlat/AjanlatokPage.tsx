import { useMemo, useState } from 'react'
import { Copy, FilePdf, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAppSetting } from '@/hooks/useAppSetting'
import { generateAndSavePdf } from '@/lib/pdfService'
import {
  DEFAULT_QUOTATION_SETTINGS, quotePdfFileName, quoteToHtml,
  type QuotationSettings,
} from '@/lib/quoteHtmlTemplate'
import { QuoteDialog } from '@/components/QuoteDialog'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { generateId } from '@/lib/generateId'
import { stripDiacritics } from '@/lib/helpers'
import { URGENCY_BORDER, deadlineUrgency } from '@/lib/productionHelpers'
import { generateQuoteNumber } from '@/lib/quoteCalc'
import type { Quote } from '@/lib/types'

/** Az Elkészült/Kiküldve/Megrendelve pipák dátum-mezői. */
const FLAGS = [
  { key: 'doneAt', label: 'Elkészült' },
  { key: 'sentAt', label: 'Kiküldve' },
  { key: 'orderedAt', label: 'Megrendelve' },
] as const

export default function AjanlatokPage() {
  const s = useAppShell()
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [quotationSettings] = useAppSetting<QuotationSettings>(
    'quotation-settings', DEFAULT_QUOTATION_SETTINGS,
  )
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)

  const downloadPdf = async (q: Quote) => {
    setPdfBusyId(q.id)
    try {
      const fileName = quotePdfFileName(q)
      const ok = await generateAndSavePdf(quoteToHtml(q, quotationSettings), fileName, true)
      if (ok) {
        if (q.pdfFileName !== fileName) s.handleSaveQuote({ id: q.id, pdfFileName: fileName })
        toast.success(`PDF elkészült: ${fileName}`)
      } else {
        toast.error('A PDF generálása nem sikerült')
      }
    } finally {
      setPdfBusyId(null)
    }
  }
  const [editing, setEditing] = useState<Quote | null>(null)

  const filtered = useMemo(() => {
    const list = [...s.quotes].sort((a, b) => (a.number < b.number ? 1 : -1))
    if (!query) return list
    const q = stripDiacritics(query)
    return list.filter((x) =>
      stripDiacritics(`${x.number} ${x.customerName} ${x.rfqNumber || ''} ${x.notes || ''}`).includes(q),
    )
  }, [s.quotes, query])

  const toggleFlag = (quote: Quote, key: (typeof FLAGS)[number]['key']) => {
    const value = quote[key] ? '' : new Date().toISOString().slice(0, 10)
    s.handleSaveQuote({ id: quote.id, [key]: value })
  }

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const duplicate = (q: Quote) => {
    s.handleSaveQuote({
      ...q,
      id: generateId(),
      number: generateQuoteNumber(s.quotes),
      doneAt: '',
      sentAt: '',
      orderedAt: '',
      pdfFileName: '',
    })
  }

  const remove = (q: Quote) => {
    if (!window.confirm(`Törlöd a(z) ${q.number} ajánlatot? (A lomtárból visszaállítható.)`)) return
    s.handleDeleteQuote(q.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Ajánlatok</h2>
          <p className="text-muted-foreground">Árajánlat-nyilvántartás — {s.quotes.length} ajánlat</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-5 h-5 mr-2" /> Új ajánlat
        </Button>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Keresés szám, vevő, RFQ vagy megjegyzés szerint..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Szám</TableHead>
              <TableHead>Megrendelő</TableHead>
              <TableHead>Mennyiség</TableHead>
              {FLAGS.map((f) => <TableHead key={f.key} className="text-center">{f.label}</TableHead>)}
              <TableHead>RFQ-szám</TableHead>
              <TableHead>Határidő</TableHead>
              <TableHead>Megjegyzés</TableHead>
              <TableHead className="text-right">Műveletek</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {query ? 'Nincs találat.' : 'Még nincs ajánlat — hozd létre az elsőt!'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((q) => {
              const urgency = q.orderedAt || q.sentAt ? 'normal' : deadlineUrgency(q.deadline)
              return (
                <TableRow key={q.id} className={`border-l-4 ${URGENCY_BORDER[urgency]}`}>
                  <TableCell className="font-mono font-medium">{q.number}</TableCell>
                  <TableCell>{q.customerName}</TableCell>
                  <TableCell>{q.quantityNote}</TableCell>
                  {FLAGS.map((f) => (
                    <TableCell key={f.key} className="text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <Checkbox
                          checked={!!q[f.key]}
                          onCheckedChange={() => toggleFlag(q, f.key)}
                          aria-label={f.label}
                        />
                        {q[f.key] && <span className="text-[10px] font-mono text-muted-foreground">{q[f.key]}</span>}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell>{q.rfqNumber}</TableCell>
                  <TableCell className="font-mono">
                    {q.deadline}
                    {urgency === 'late' && !q.sentAt && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">Lejárt</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={q.notes}>{q.notes}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" title="Szerkesztés"
                      onClick={() => { setEditing(q); setDialogOpen(true) }}>
                      <PencilSimple className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Quotation PDF letöltése"
                      disabled={pdfBusyId === q.id}
                      onClick={() => void downloadPdf(q)}>
                      <FilePdf className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Másolat új számmal"
                      onClick={() => duplicate(q)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Törlés (lomtárba)"
                      onClick={() => remove(q)}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <QuoteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={s.handleSaveQuote}
        quote={editing}
        prefill={editing ? undefined : { number: generateQuoteNumber(s.quotes) }}
        customers={s.customers}
      />
    </div>
  )
}
