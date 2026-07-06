import { Order, Customer, Product } from './types'
import { parseFloatSafe } from './helpers'
import { esc } from './htmlSafe'
import { findProductForOrder } from './productionHelpers'

interface BoxLabelData {
  designation: string
  drawingNumber: string
  piecesPerBox: string
  material: string
  orderNumber: string
  requiredDate: string
  customer: string
  productNotes: string
  boxWeight: string
}

interface BoxLabelMargins {
  top: string
  right: string
  bottom: string
  left: string
}

interface PageGroup {
  cellHtml: string
  templateCss: string
  cols: number
  rows: number
  margins: BoxLabelMargins
  cellPaddingH: number
  cellPaddingV: number
  pages: BoxLabelData[][]
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return iso.replace(/-/g, '.')
}

function buildLabelData(order: Order, product: Product | undefined): BoxLabelData {
  // parseFloatSafe: a magyar "12,5" és "1 500" formátumot is helyesen kezeli
  const piecesPerBox = parseFloatSafe(product?.piecesPerBox)
  const weightPerPieceG = parseFloatSafe(product?.weightPerPiece)
  const boxWeightKg = piecesPerBox * weightPerPieceG / 1000
  const boxWeight = boxWeightKg > 0 ? boxWeightKg.toFixed(1) + ' kg' : ''

  return {
    // Megnevezés az ÉLŐ termékből (product.productName) — így a termék
    // szerkesztése azonnal helyesen jelenik meg a címkén, akkor is, ha a
    // rendelés eltárolt másolata (order.designation) még a régit tartalmazza.
    // Ugyanezt a sorrendet használja a labelTemplate és a labelExportFormats is.
    designation:   product?.productName || order.designation || order.productName || '',
    drawingNumber: product?.drawingNumber || order.productName || '',
    piecesPerBox:  product?.piecesPerBox || '',
    material:      order.material || product?.material || '',
    orderNumber:   order.orderNumber || '',
    requiredDate:  formatDate(order.requiredDate),
    customer:      order.customer || '',
    productNotes:  product?.notes || '',
    boxWeight,
  }
}

function applyTemplate(templateHtml: string, d: BoxLabelData): string {
  // Az adatmezők escape-elve kerülnek a sablonba — a felhasználói adat
  // (pl. vevőnév "<" jellel) nem törheti el / nem injektálhat HTML-t.
  return templateHtml
    .replace(/{{designation}}/g, esc(d.designation))
    .replace(/{{drawingNumber}}/g, esc(d.drawingNumber))
    .replace(/{{piecesPerBox}}/g, esc(d.piecesPerBox))
    .replace(/{{material}}/g, esc(d.material))
    .replace(/{{orderNumber}}/g, esc(d.orderNumber))
    .replace(/{{requiredDate}}/g, esc(d.requiredDate))
    .replace(/{{customer}}/g, esc(d.customer))
    .replace(/{{productNotes}}/g, esc(d.productNotes))
    .replace(/{{boxWeight}}/g, esc(d.boxWeight))
}

// Scope CSS rules to a wrapper class so multiple templates don't conflict
function scopeCSS(css: string, wrapperClass: string): string {
  return css.replace(/([^{}]+)\{/g, (match, selector) => {
    const trimmed = selector.trim()
    // Skip at-rules (@media, @keyframes, etc.)
    if (trimmed.startsWith('@')) return match
    const scoped = trimmed.split(',')
      .map(s => `.${wrapperClass} ${s.trim()}`)
      .join(', ')
    return `${scoped} {`
  })
}

function buildHTMLFull(groups: PageGroup[]): string {
  let cssBlocks = ''
  let pageBlocks = ''

  groups.forEach((group, gi) => {
    const cls = `tpl${gi}`
    const { margins, cols, rows, cellPaddingH, cellPaddingV, templateCss, cellHtml } = group
    const pageMargin = `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`
    const gridH = 297 - parseFloat(margins.top) - parseFloat(margins.bottom)
    const gridW = 210 - parseFloat(margins.left) - parseFloat(margins.right)

    cssBlocks += `
    /* ── Template ${gi} ── */
    .${cls} .label-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      grid-template-rows: repeat(${rows}, 1fr);
      width: ${gridW}mm;
      height: ${gridH}mm;
    }
    .${cls} .label-cell {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: ${cellPaddingV}mm ${cellPaddingH}mm;
      overflow: hidden;
    }
    ${scopeCSS(templateCss, cls)}
    `

    group.pages.forEach((page, pi) => {
      const isLast = gi === groups.length - 1 && pi === group.pages.length - 1
      const cells = page.map(d => `<div class="label-cell">${applyTemplate(cellHtml, d)}</div>`).join('')
      pageBlocks += `
    <div class="${cls} label-page" style="@page{margin:${pageMargin}}${isLast ? '' : ''}">
      <div class="label-grid">${cells}</div>
    </div>`
    })
  })

  // Use the first group's margins for @page (most common case: single template)
  const firstMargins = groups[0].margins
  const pageMargin = `${firstMargins.top}mm ${firstMargins.right}mm ${firstMargins.bottom}mm ${firstMargins.left}mm`

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Etiketta</title>
  <style>
    @page { size: A4; margin: ${pageMargin}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; }
    .label-page { page-break-after: always; }
    .label-page:last-child { page-break-after: avoid; }
    ${cssBlocks}
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
${pageBlocks}
</body>
</html>`
}

export const DEFAULT_BOX_LABEL_CELL_HTML = `<div class="label-designation">{{designation}} - {{drawingNumber}}</div>
<div class="label-qty">{{piecesPerBox}} pcs-{{material}}</div>
<div class="label-order">{{orderNumber}} - {{requiredDate}}</div>
<div class="label-parties">From: MAGMA&nbsp;&nbsp;To: {{customer}}</div>`

export const DEFAULT_BOX_LABEL_CSS = `.label-designation {
  font-size: 10pt;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-qty {
  font-size: 9pt;
  margin-top: 1mm;
}
.label-order {
  font-size: 9pt;
  margin-top: 1mm;
}
.label-parties {
  font-size: 8pt;
  margin-top: 1mm;
  color: #333;
}`

const DEFAULT_MARGINS: BoxLabelMargins = { top: '5', right: '5', bottom: '5', left: '5' }
const DEFAULT_COLS = 4
const DEFAULT_ROWS = 10

export function generateBoxLabels(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  savedTemplatesOverride?: Array<{
    id: string
    data: {
      type: string
      html: string
      css: string
      active?: boolean
      gridCols?: number
      gridRows?: number
      cellPaddingH?: number
      cellPaddingV?: number
      margins?: { top: string; right: string; bottom: string; left: string }
    }
  }>
): void {
  const activeBoxTemplate = savedTemplatesOverride?.find(t => t.data?.type === 'box-label' && t.data?.active)
    ?? savedTemplatesOverride?.find(t => t.data?.type === 'box-label')

  // Group pages by template ID to avoid CSS conflicts
  const groupMap = new Map<string, PageGroup>()

  for (const order of orders) {
    // productId → rajzszám/név egyezés fallback-kel; korábban productId nélkül
    // a vevő BÁRMELYIK terméke találatnak számított → rossz termék adatai a címkén.
    const product = findProductForOrder(order, products)

    const productTemplate = product?.labelTemplateId
      ? savedTemplatesOverride?.find(t => t.id === product.labelTemplateId)
      : undefined
    const boxTemplate = productTemplate ?? activeBoxTemplate
    const templateId = boxTemplate?.id ?? '__default__'

    if (!groupMap.has(templateId)) {
      groupMap.set(templateId, {
        cellHtml:     boxTemplate?.data.html     || DEFAULT_BOX_LABEL_CELL_HTML,
        templateCss:  boxTemplate?.data.css      || DEFAULT_BOX_LABEL_CSS,
        cols:         boxTemplate?.data.gridCols  ?? DEFAULT_COLS,
        rows:         boxTemplate?.data.gridRows  ?? DEFAULT_ROWS,
        margins:      boxTemplate?.data.margins   ?? DEFAULT_MARGINS,
        cellPaddingH: boxTemplate?.data.cellPaddingH ?? 3,
        cellPaddingV: boxTemplate?.data.cellPaddingV ?? 2,
        pages: [],
      })
    }

    const group = groupMap.get(templateId)!
    const labelsPerPage = group.cols * group.rows
    const labelData = buildLabelData(order, product)
    const boxCount = order.boxesCount || 1
    const pageCount = Math.ceil(boxCount / labelsPerPage)
    for (let i = 0; i < pageCount; i++) {
      group.pages.push(Array(labelsPerPage).fill(labelData))
    }
  }

  if (groupMap.size === 0) {
    alert('Nincsenek generálható etikettáák — ellenőrizd a kijelölt rendeléseket.')
    return
  }

  const html = buildHTMLFull(Array.from(groupMap.values()))
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
