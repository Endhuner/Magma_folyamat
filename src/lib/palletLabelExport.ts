import { Order, Customer, Product } from './types'

interface PalletLabelData {
  palletIndex: number
  totalPallets: number
  // Vevő / Kaufer
  customerName: string
  customerCity: string
  customerStreet: string
  customerPostalCode: string
  // Megrendelés adatok
  orderNo: string
  drawingNumber: string
  boxesOnPallet: number
  piecesPerBox: number
  totalPieces: number
  nettoKg: number
  bruttoKg: number
}

function buildPalletLabels(order: Order, customer: Customer, product: Product): PalletLabelData[] {
  const totalPallets = order.palletsCount || 1
  const totalBoxes = order.boxesCount || 1
  const boxesPerPallet = parseInt(product.boxesPerPallet || '1') || 1
  const piecesPerBox = parseInt(product.piecesPerBox || '1') || 1
  // weightPerPiece gramm-ban van tárolva → kg-ba konvertálás
  const weightPerPieceG = parseFloat(product.weightPerPiece || '0') || 0
  const grossWeightKg = parseFloat(order.grossWeightKg || '0') || 0

  const labels: PalletLabelData[] = []

  for (let i = 0; i < totalPallets; i++) {
    const isLast = i === totalPallets - 1
    const boxesAlreadyAssigned = i * boxesPerPallet
    const remainingBoxes = totalBoxes - boxesAlreadyAssigned
    const boxesOnPallet = isLast ? remainingBoxes : boxesPerPallet
    const totalPieces = boxesOnPallet * piecesPerBox
    const nettoKg = Math.round((weightPerPieceG / 1000) * totalPieces)
    const bruttoKg = Math.round(grossWeightKg * (boxesOnPallet / totalBoxes))

    labels.push({
      palletIndex: i + 1,
      totalPallets,
      customerName: customer.name,
      customerCity: customer.city,
      customerStreet: customer.street,
      customerPostalCode: customer.postalCode,
      orderNo: order.orderNumber || '',
      drawingNumber: product.drawingNumber || '',
      boxesOnPallet,
      piecesPerBox,
      totalPieces,
      nettoKg,
      bruttoKg,
    })
  }

  return labels
}

function renderLabel(d: PalletLabelData): string {
  return `
    <div class="pallet-label">
      <!-- Fejléc: vevő / feladó -->
      <div class="header-row">
        <div class="header-cell">
          <div class="header-title">Vevő / Kaufer</div>
          <div class="address-name">${d.customerName}</div>
          <div class="address-line">${d.customerCity}</div>
          <div class="address-line">${d.customerStreet}</div>
          <div class="address-line">${d.customerPostalCode}</div>
        </div>
        <div class="header-cell right-cell">
          <div class="header-title">Feladó / Absender</div>
          <div class="address-name">MAGMA KFT</div>
          <div class="address-line">Budapest</div>
          <div class="address-line">Déli u. 13.</div>
          <div class="address-line">H-1211</div>
        </div>
      </div>

      <!-- Rendelési azonosítók -->
      <div class="info-row">
        <div class="info-label">Order No.:</div>
        <div class="info-value order-no">${d.orderNo}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Cikkszám / Artikelnummer:</div>
        <div class="info-value bold">${d.drawingNumber}</div>
      </div>

      <!-- Mennyiség sor -->
      <div class="qty-row">
        <div class="qty-cell">
          <div class="qty-number">${d.boxesOnPallet}</div>
          <div class="qty-unit">karton / Karton</div>
        </div>
        <div class="qty-cell">
          <div class="qty-number">${d.piecesPerBox}</div>
          <div class="qty-unit">db/karton / Stk/Karton</div>
        </div>
        <div class="qty-cell highlight">
          <div class="qty-number">${d.totalPieces}</div>
          <div class="qty-unit">db / Stück</div>
        </div>
      </div>

      <!-- Súly -->
      <div class="weight-row">
        <div class="weight-cell">
          <span class="weight-label">Nettó:</span>
          <span class="weight-value">${d.nettoKg.toLocaleString('hu-HU')} kg</span>
        </div>
        <div class="weight-cell">
          <span class="weight-label">Bruttó:</span>
          <span class="weight-value">${d.bruttoKg.toLocaleString('hu-HU')} kg</span>
        </div>
      </div>

      <!-- Raklap sorszám -->
      <div class="pallet-counter">
        Raklap / Palette: ${d.palletIndex} / ${d.totalPallets}
      </div>
    </div>
  `
}

function buildHTML(labels: PalletLabelData[]): string {
  const rendered = labels.map(renderLabel).join('\n')

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Raklap cimke</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      color: #000;
    }

    .pallet-label {
      width: 277mm;
      height: 190mm;
      border: 2px solid #000;
      padding: 6mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      gap: 4mm;
    }
    .pallet-label:last-child { page-break-after: avoid; }

    /* ── fejléc ── */
    .header-row {
      display: flex;
      gap: 4mm;
      border-bottom: 1.5px solid #000;
      padding-bottom: 4mm;
    }
    .header-cell {
      flex: 1;
    }
    .right-cell {
      border-left: 1.5px solid #000;
      padding-left: 4mm;
    }
    .header-title {
      font-size: 8pt;
      font-weight: bold;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
    }
    .address-name {
      font-size: 13pt;
      font-weight: bold;
      line-height: 1.3;
    }
    .address-line {
      font-size: 11pt;
      line-height: 1.4;
    }

    /* ── rendelési info ── */
    .info-row {
      display: flex;
      gap: 3mm;
      align-items: baseline;
    }
    .info-label {
      font-size: 9pt;
      color: #444;
      min-width: 42mm;
    }
    .info-value {
      font-size: 14pt;
    }
    .info-value.bold {
      font-weight: bold;
    }
    .info-value.order-no {
      font-size: 24pt;
      font-weight: bold;
      letter-spacing: 0.5px;
    }

    /* ── mennyiség ── */
    .qty-row {
      display: flex;
      gap: 3mm;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 3mm 0;
    }
    .qty-cell {
      flex: 1;
      text-align: center;
      border-right: 1px solid #ccc;
      padding: 1mm 2mm;
    }
    .qty-cell:last-child {
      border-right: none;
    }
    .qty-cell.highlight {
      background: #f0f0f0;
    }
    .qty-number {
      font-size: 22pt;
      font-weight: bold;
      line-height: 1.1;
    }
    .qty-unit {
      font-size: 8pt;
      color: #555;
      margin-top: 1mm;
    }

    /* ── súly ── */
    .weight-row {
      display: flex;
      gap: 8mm;
    }
    .weight-cell {
      display: flex;
      gap: 2mm;
      align-items: baseline;
    }
    .weight-label {
      font-size: 9pt;
      color: #444;
    }
    .weight-value {
      font-size: 13pt;
      font-weight: bold;
    }

    /* ── raklap sorszám ── */
    .pallet-counter {
      margin-top: auto;
      text-align: right;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 2mm;
    }

    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
${rendered}
</body>
</html>`
}

function applyPalletTemplate(templateHtml: string, templateCss: string, d: PalletLabelData): string {
  const vars: Record<string, string> = {
    customerName: d.customerName,
    customerCity: d.customerCity,
    customerStreet: d.customerStreet,
    customerPostalCode: d.customerPostalCode,
    orderNo: d.orderNo,
    drawingNumber: d.drawingNumber,
    boxesOnPallet: String(d.boxesOnPallet),
    piecesPerBox: String(d.piecesPerBox),
    totalPieces: String(d.totalPieces),
    nettoKg: String(d.nettoKg),
    bruttoKg: String(d.bruttoKg),
    palletIndex: String(d.palletIndex),
    totalPallets: String(d.totalPallets),
  }
  let html = templateHtml
  for (const [key, val] of Object.entries(vars)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), val)
  }
  return html
}

function buildHTMLFromTemplate(labels: PalletLabelData[], templateHtml: string, templateCss: string): string {
  const rendered = labels.map(d => applyPalletTemplate(templateHtml, templateCss, d)).join('\n')
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Raklap cimke</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #000; }
    ${templateCss}
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
${rendered}
</body>
</html>`
}

export function generatePalletLabels(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  savedTemplatesOverride?: Array<{ id: string; data: { type: string; html: string; css: string } }>,
  activeTemplatesOverride?: { pallet?: string }
): void {
  const allLabels: PalletLabelData[] = []

  for (const order of orders) {
    const customer = customers.find(c => c.name === order.customer)
    const product = order.productId
      ? products.find(p => p.id === order.productId)
      : products.find(p => p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase())
    if (!customer || !product) continue

    allLabels.push(...buildPalletLabels(order, customer, product))
  }

  if (allLabels.length === 0) {
    alert('Nem sikerült cimkéket generálni — ellenőrizze, hogy a kijelölt rendelésekhez van vevő és termék rendelve.')
    return
  }

  // Mentett raklap sablon keresése — aktív sablon ID szerint, fallback: első pallet típusú
  const savedPalletTemplate = activeTemplatesOverride?.pallet
    ? savedTemplatesOverride?.find(t => t.id === activeTemplatesOverride.pallet)
    : savedTemplatesOverride?.find(t => t.data?.type === 'pallet')

  const html = savedPalletTemplate
    ? buildHTMLFromTemplate(allLabels, savedPalletTemplate.data.html, savedPalletTemplate.data.css)
    : buildHTML(allLabels)

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
