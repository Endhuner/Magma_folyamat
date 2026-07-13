/**
 * Angol nyelvű Quotation PDF-sablon — a minta-Excel
 * („Quotation PROJ26821103v4.xlsx") elrendezésével.
 */
import { esc } from '@/lib/htmlSafe'
import type { Quote, QuoteItem } from '@/lib/types'

/** A Quotation „From" blokkja + default szövegek (quotation-settings app-setting). */
export interface QuotationSettings {
  fromName: string
  fromCompany: string
  fromAddress: string
  fromVat: string
  signerName: string
  placeIssued: string
  defaultPaymentTerms: string
  defaultIncoterms: string
  defaultAdditionalNotes: string
}

export const DEFAULT_QUOTATION_SETTINGS: QuotationSettings = {
  fromName: 'Olga Vegvari',
  fromCompany: 'Magma Kft',
  fromAddress: 'Budapest, Déli u. 13, Hungary',
  fromVat: 'HU10368152',
  signerName: 'Végvári Olga',
  placeIssued: 'Budapest',
  defaultPaymentTerms:
    '30% advance at the time of order\n40% at the time of first samples\n30% at the time of tool clearance',
  defaultIncoterms: 'EXW',
  defaultAdditionalNotes:
    'Tool lifetime: 1,000,000 shots\nDie-casting fee incl. washing\nMPB: changes as LME changes',
}

const e = esc
const num = (v: number | null | undefined, digits = 4) =>
  v == null ? '' : v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits })

function itemRow(i: QuoteItem): string {
  return `<tr>
    <td>${e(i.drawingNumber)}</td>
    <td class="num">${num(i.cavityCount, 0)}</td>
    <td class="num">${num(i.weightG, 2)}</td>
    <td class="num">${num(i.dieCastingFeeEur, 4)}</td>
    <td class="num">${num(i.materialCostEur, 4)}</td>
    <td class="num strong">${num(i.totalPieceEur, 4)}</td>
    <td class="num">${num(i.mouldPriceEur, 0)}</td>
  </tr>`
}

/** Többsoros szöveg → biztonságos HTML sorok. */
const lines = (s: string | undefined) =>
  (s || '').split('\n').filter(Boolean).map((l) => `<div>${e(l)}</div>`).join('')

export function quoteToHtml(q: Quote, settings: QuotationSettings, today = new Date()): string {
  const dateStr = today.toISOString().slice(0, 10)
  const payment = q.paymentTerms || settings.defaultPaymentTerms
  const incoterms = q.incoterms || settings.defaultIncoterms
  const additional = q.additionalNotes || settings.defaultAdditionalNotes
  const validity = q.validityDays ?? 30

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Quotation ${e(q.number)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  h1 { font-size: 16pt; letter-spacing: 1px; margin: 0 0 2mm; }
  .muted { color: #555; }
  .header { display: flex; justify-content: space-between; margin-bottom: 8mm; }
  .header .block { max-width: 48%; }
  .label { font-size: 9pt; text-transform: uppercase; color: #666; margin-bottom: 1mm; }
  .meta { margin: 6mm 0; }
  .meta table { border-collapse: collapse; }
  .meta td { padding: 0.8mm 6mm 0.8mm 0; vertical-align: top; }
  .meta td:first-child { color: #555; }
  table.items { width: 100%; border-collapse: collapse; margin: 4mm 0 6mm; }
  table.items th, table.items td { border: 0.3mm solid #999; padding: 2mm 2.5mm; font-size: 10pt; }
  table.items th { background: #f0f0f0; text-align: left; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: bold; }
  .section { margin: 4mm 0; }
  .section .label { margin-bottom: 1.5mm; }
  .validity { margin-top: 6mm; font-weight: bold; }
  .sign { margin-top: 12mm; display: flex; justify-content: space-between; align-items: flex-end; }
</style>
</head>
<body>
  <h1>QUOTATION ${e(q.number)}</h1>
  <div class="muted">${q.rfqNumber ? `Ref.: ${e(q.rfqNumber)}` : ''}</div>

  <div class="header" style="margin-top:6mm">
    <div class="block">
      <div class="label">From</div>
      <div><strong>${e(settings.fromName)}</strong></div>
      <div>${e(settings.fromCompany)}</div>
      <div>${e(settings.fromAddress)}</div>
      <div>VAT no.: ${e(settings.fromVat)}</div>
    </div>
    <div class="block">
      <div class="label">To</div>
      ${q.contactName ? `<div><strong>${e(q.contactName)}</strong></div>` : ''}
      <div>${e(q.customerName)}</div>
    </div>
  </div>

  <div class="meta">
    <table>
      ${q.material ? `<tr><td>Material:</td><td>${e(q.material)}</td></tr>` : ''}
      ${q.yearlyAmount ? `<tr><td>Yearly amount:</td><td>${e(q.yearlyAmount)}</td></tr>` : ''}
      ${q.moq ? `<tr><td>MOQ:</td><td>${e(q.moq)}</td></tr>` : ''}
      ${q.mouldLeadtimeWeeks ? `<tr><td>Mould leadtime:</td><td>${e(q.mouldLeadtimeWeeks)} weeks</td></tr>` : ''}
      ${q.mpb ? `<tr><td>MPB:</td><td>${e(q.mpb)}</td></tr>` : ''}
    </table>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Drawing nr.</th>
        <th>Nr of tool cavity</th>
        <th>Weight (g)</th>
        <th>Die-casting fee (EUR)</th>
        <th>Material cost (EUR)</th>
        <th>Total piece price (EUR)</th>
        <th>Mould price (EUR)</th>
      </tr>
    </thead>
    <tbody>
      ${q.items.map(itemRow).join('\n')}
    </tbody>
  </table>

  <div class="section">
    <div class="label">Payment terms</div>
    ${lines(payment)}
  </div>
  <div class="section">
    <div class="label">Incoterms</div>
    <div>${e(incoterms)}</div>
  </div>
  ${additional ? `<div class="section">
    <div class="label">Additional notes</div>
    ${lines(additional)}
  </div>` : ''}

  <div class="validity">Offer valid for ${validity} days</div>

  <div class="sign">
    <div>
      <div>Kind regards</div>
      <div style="margin-top:10mm">${e(settings.signerName)}</div>
      <div>${e(settings.fromCompany)}.</div>
    </div>
    <div>${e(settings.placeIssued)}, ${dateStr}</div>
  </div>
</body>
</html>`
}

/** A PDF fájlneve: Quotation_A202601_Seidel_GmbH.pdf */
export function quotePdfFileName(q: Quote): string {
  const safe = (q.customerName || 'quote').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `Quotation_${q.number}_${safe}.pdf`
}
