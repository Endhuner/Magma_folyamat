import { Order, Customer, Product } from './types'

const LABELS_PER_PAGE = 40
const COLS = 4
const ROWS = 10

interface BoxLabelData {
  designation: string
  drawingNumber: string
  piecesPerBox: string
  material: string
  orderNumber: string
  requiredDate: string
  customer: string
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
}

function renderGrid(labels: BoxLabelData[], cellHtml: string): string {
  const cells = labels.map(d => `<div class="label-cell">${applyTemplate(cellHtml, d)}</div>`).join('')
  return `<div class="label-grid">${cells}</div>`
}

function buildHTMLFull(allPages: BoxLabelData[][], templateCss: string, cellHtml: string): string {
  const pages = allPages.map(page => renderGrid(page, cellHtml)).join('\n')
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Etiketta</title>
  <style>
    @page { size: A4; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; }

    .label-grid {
      display: grid;
      grid-template-columns: repeat(${COLS}, 1fr);
      grid-template-rows: repeat(${ROWS}, 1fr);
      width: 200mm;
      height: 287mm;
      page-break-after: always;
    }
    .label-grid:last-child { page-break-after: avoid; }

    .label-cell {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 2mm 3mm;
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

export function generateBoxLabels(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  savedTemplatesOverride?: Array<{ id: string; data: { type: string; html: string; css: string; active?: boolean } }>
): void {
  const boxTemplate = savedTemplatesOverride?.find(t => t.data?.type === 'box-label' && t.data?.active)
    ?? savedTemplatesOverride?.find(t => t.data?.type === 'box-label')
  const cellHtml = boxTemplate?.data.html || DEFAULT_BOX_LABEL_CELL_HTML
  const templateCss = boxTemplate?.data.css || DEFAULT_BOX_LABEL_CSS

  const allPages: BoxLabelData[][] = []

  for (const order of orders) {
    const product = order.productId
      ? products.find(p => p.id === order.productId)
      : products.find(p => p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase())

    const labelData = buildLabelData(order, product)
    const page: BoxLabelData[] = Array(LABELS_PER_PAGE).fill(labelData)
    allPages.push(page)
  }

  if (allPages.length === 0) {
    alert('Nincsenek generálható etikettáák — ellenőrizd a kijelölt rendeléseket.')
    return
  }

  const html = buildHTMLFull(allPages, templateCss, cellHtml)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
