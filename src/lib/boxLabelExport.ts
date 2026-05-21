import { Order, Customer, Product } from './types'

interface BoxLabelData {
  designation: string
  drawingNumber: string
  piecesPerBox: string
  material: string
  orderNumber: string
  requiredDate: string
  customer: string
  productNotes: string
}

interface BoxLabelMargins {
  top: string
  right: string
  bottom: string
  left: string
}

function formatDate(iso: string): string {
  if (!iso) return ''
  // "2026-05-16" → "2026.05.16"
  return iso.replace(/-/g, '.')
}

function buildLabelData(order: Order, product: Product | undefined): BoxLabelData {
  return {
    designation:   order.designation || order.productName || '',
    drawingNumber: product?.drawingNumber || order.productName || '',
    piecesPerBox:  product?.piecesPerBox || '',
    material:      order.material || product?.material || '',
    orderNumber:   order.orderNumber || '',
    requiredDate:  formatDate(order.requiredDate),
    customer:      order.customer || '',
    productNotes:  product?.notes || '',
  }
}

function applyTemplate(templateHtml: string, d: BoxLabelData): string {
  return templateHtml
    .replace(/{{designation}}/g, d.designation)
    .replace(/{{drawingNumber}}/g, d.drawingNumber)
    .replace(/{{piecesPerBox}}/g, d.piecesPerBox)
    .replace(/{{material}}/g, d.material)
    .replace(/{{orderNumber}}/g, d.orderNumber)
    .replace(/{{requiredDate}}/g, d.requiredDate)
    .replace(/{{customer}}/g, d.customer)
    .replace(/{{productNotes}}/g, d.productNotes)
}

function renderGrid(labels: BoxLabelData[], cellHtml: string): string {
  const cells = labels.map(d => `<div class="label-cell">${applyTemplate(cellHtml, d)}</div>`).join('')
  return `<div class="label-grid">${cells}</div>`
}

function buildHTMLFull(
  allPages: BoxLabelData[][],
  templateCss: string,
  cellHtml: string,
  cols: number,
  rows: number,
  margins: BoxLabelMargins,
  cellPaddingH: number,
  cellPaddingV: number,
): string {
  const pages = allPages.map(page => renderGrid(page, cellHtml)).join('\n')
  const pageMargin = `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`
  const gridH = 297 - parseFloat(margins.top) - parseFloat(margins.bottom)
  const gridW = 210 - parseFloat(margins.left) - parseFloat(margins.right)

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Etiketta</title>
  <style>
    @page { size: A4; margin: ${pageMargin}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; }

    .label-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      grid-template-rows: repeat(${rows}, 1fr);
      width: ${gridW}mm;
      height: ${gridH}mm;
      page-break-after: always;
    }
    .label-grid:last-child { page-break-after: avoid; }

    .label-cell {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: ${cellPaddingV}mm ${cellPaddingH}mm;
      overflow: hidden;
    }

    ${templateCss}

    @media print { body { margin: 0; } }
  </style>
</head>
<body>
${pages}
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
  const boxTemplate = savedTemplatesOverride?.find(t => t.data?.type === 'box-label' && t.data?.active)
    ?? savedTemplatesOverride?.find(t => t.data?.type === 'box-label')
  const cellHtml = boxTemplate?.data.html || DEFAULT_BOX_LABEL_CELL_HTML
  const templateCss = boxTemplate?.data.css || DEFAULT_BOX_LABEL_CSS
  const cols = boxTemplate?.data.gridCols ?? DEFAULT_COLS
  const rows = boxTemplate?.data.gridRows ?? DEFAULT_ROWS
  const margins = boxTemplate?.data.margins ?? DEFAULT_MARGINS
  const cellPaddingH = boxTemplate?.data.cellPaddingH ?? 3
  const cellPaddingV = boxTemplate?.data.cellPaddingV ?? 2
  const labelsPerPage = cols * rows

  const allPages: BoxLabelData[][] = []

  for (const order of orders) {
    const product = order.productId
      ? products.find(p => p.id === order.productId)
      : products.find(p => p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase())

    const labelData = buildLabelData(order, product)
    const boxCount = order.boxesCount || 1
    const pageCount = Math.ceil(boxCount / labelsPerPage)
    for (let i = 0; i < pageCount; i++) {
      allPages.push(Array(labelsPerPage).fill(labelData))
    }
  }

  if (allPages.length === 0) {
    alert('Nincsenek generálható etikettáák — ellenőrizd a kijelölt rendeléseket.')
    return
  }

  const html = buildHTMLFull(allPages, templateCss, cellHtml, cols, rows, margins, cellPaddingH, cellPaddingV)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
