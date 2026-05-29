import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { kvStore } from '@/lib/kvStore'
import { esc } from '@/lib/htmlSafe'
import { toast } from 'sonner'

const DEFAULT_CMR_SETTINGS: Partial<CmrLayoutSettings> = {
  senderName: 'Magma Kft',
  senderAddress: 'H-1211 Budapest, Déli utca 13.',
  senderTaxNumber: 'HU10368152-2-43',
  placeOfTakingOver: 'Budapest, Hungary',
  placeIssued: 'Budapest',
  senderCity: 'Budapest',
  senderCountry: 'Magyarország',
  senderPhone: '',
  senderEmail: '',
  carrierName: '',
  carrierAddress: '',
  vehiclePlate: '',
}

export function generateCmrHtmlTemplate(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  userSettings?: CmrLayoutSettings,
  overrideSequenceNumber?: string
): string {
  const effectiveSettings = { ...DEFAULT_CMR_SETTINGS, ...userSettings }
  const sequenceNumber = overrideSequenceNumber || generateDeliveryNoteSequenceNumber(deliveryNotes, 'cmr')
  
  const firstCustomer = orders[0]?.customer || ''
  const customerInfo = customers.find(c => c.name === firstCustomer)
  
  const fullAddress = customerInfo?.fullAddress || 
    `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')

  const html = `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMR - ${sequenceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #000;
    }
    
    .cmr-document {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: white;
      padding: 5mm;
      position: relative;
    }
    
    .header {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 2px solid #000;
      padding-bottom: 5px;
    }
    
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .header h2 {
      font-size: 11pt;
      font-weight: normal;
      font-style: italic;
    }
    
    .sequence-number {
      position: absolute;
      top: 5mm;
      right: 5mm;
      font-size: 12pt;
      font-weight: bold;
    }
    
    .cmr-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .section {
      border: 1px solid #000;
      padding: 8px;
      background: #fff;
    }
    
    .section-title {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 5px;
      text-decoration: underline;
    }
    
    .section-content {
      font-size: 10pt;
      line-height: 1.4;
    }
    
    .section-content strong {
      font-weight: bold;
    }
    
    .full-width {
      grid-column: 1 / -1;
    }
    
    .goods-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9pt;
    }
    
    .goods-table th,
    .goods-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      text-align: left;
    }
    
    .goods-table th {
      background: #e0e0e0;
      font-weight: bold;
      text-align: center;
    }
    
    .goods-table td.center {
      text-align: center;
    }
    
    .goods-table td.right {
      text-align: right;
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-top: 20px;
      page-break-inside: avoid;
    }
    
    .signature-box {
      border: 1px solid #000;
      padding: 8px;
      min-height: 80px;
    }
    
    .signature-label {
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .signature-label-sub {
      font-size: 7pt;
      font-style: italic;
      color: #666;
    }
    
    .signature-space {
      margin-top: 40px;
      border-top: 1px solid #666;
      padding-top: 3px;
      text-align: center;
      font-size: 7pt;
    }
    
    .notice-box {
      border: 1px solid #000;
      padding: 5px;
      font-size: 7pt;
      text-align: center;
      margin-bottom: 10px;
      background: #f9f9f9;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .cmr-document {
        margin: 0;
        padding: 5mm;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="cmr-document">
    <div class="sequence-number">Saját rendelési szám: ${esc(sequenceNumber)}</div>

    <div class="header">
      <h1>NEMZETKÖZI FUVARLEVÉL</h1>
      <h2>INTERNATIONAL CONSIGNMENT NOTE</h2>
    </div>

    <div class="notice-box">
      This carriage is subject, notwithstanding any clause to the contrary to the Convention on the Contract for the international Carriage of goods by road (CMR).<br>
      A fuvarozásra elétrő megállapodás esetén is a nemzetközi árufuvarozási egyezmény CMR rendelkezései az irányadók
    </div>

    <div class="cmr-grid">
      <div class="section">
        <div class="section-title">1. Feladó (Név, cím, ország)<br>Sender (Name, Address, Country)</div>
        <div class="section-content">
          <strong>${esc(effectiveSettings.senderName)}</strong><br>
          ${esc(effectiveSettings.senderAddress)}<br>
          ${esc(effectiveSettings.senderCity)}, ${esc(effectiveSettings.senderCountry)}<br>
          Adószám: ${esc(effectiveSettings.senderTaxNumber)}
        </div>
      </div>

      <div class="section">
        <div class="section-title">2. Átvevő (Név, cím, ország)<br>Consignee (Name, Address, Country)</div>
        <div class="section-content">
          <strong>${esc(customerInfo?.name || firstCustomer)}</strong><br>
          ${esc(fullAddress)}<br>
          ${esc(customerInfo?.city || '')}, ${esc(customerInfo?.country || '')}<br>
          ${customerInfo?.taxNumber ? `Adószám: ${esc(customerInfo.taxNumber)}` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">3. Az áru átvételének helye és időpontja<br>Place and date of delivery of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>${esc(effectiveSettings.placeOfTakingOver)}</strong><br>
          Ország / Country: <strong>${esc(effectiveSettings.senderCountry)}</strong>
        </div>
      </div>

      <div class="section">
        <div class="section-title">4. Az áru leadásának helye és időpontja<br>Place and date of taking over of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>${esc(customerInfo?.city || '')}</strong><br>
          Ország / Country: <strong>${esc(customerInfo?.country || '')}</strong>
        </div>
      </div>

      <div class="section">
        <div class="section-title">16. Carrier (Name, Address, Country)<br>Fuvarozó (Név, cím, ország)</div>
        <div class="section-content">
          ${effectiveSettings.carrierName ? esc(effectiveSettings.carrierName) : '<em>Kitöltendő</em>'}<br>
          ${esc(effectiveSettings.carrierAddress || '')}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">17. Successive carriers<br>További fuvarozó</div>
        <div class="section-content">
          &nbsp;
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">5. Mellékelt okmányok<br>Documents attached</div>
        <div class="section-content">
          Szállítólevél
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">18. Carrier's reservations and observations<br>A fuvarozó fenntartásai és bejegyzése</div>
        <div class="section-content">
          &nbsp;
        </div>
      </div>
    </div>
    
    <table class="goods-table">
      <thead>
        <tr>
          <th>Jel és szám<br>Marks and Nos</th>
          <th>Vevő rendelési száma<br>Customer Order No</th>
          <th>Darabszám<br>Number of packages</th>
          <th>Csomagolás<br>Method of packing</th>
          <th>Áru megnevezése<br>Nature of the goods</th>
          <th>Bruttósúly kg<br>Gross weight kg</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((order, idx) => `
          <tr>
            <td class="center">${idx + 1}</td>
            <td class="center">${esc(order.orderNumber || '-')}</td>
            <td class="center">${order.amountPc || 0}</td>
            <td>Raklap</td>
            <td>${esc(order.productName)}<br><small>${esc(order.designation || '')}</small></td>
            <td class="right">${esc(order.grossWeightKg || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="section full-width">
      <div class="section-title">13. Sender's instructions (Customs and other formalities)<br>Feladó rendelkezései (Vám és egyéb hivatalos kezelés)</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>
    
    <div class="cmr-grid">
      <div class="section">
        <div class="section-title">14. Cash on delivery<br>Visszatérítés</div>
        <div class="section-content">
          -
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">19. To be paid by / Fizetendő</div>
        <div class="section-content">
          Sender / Feladő: ☐<br>
          Consignee / Átvevő: ☐<br>
          Currency / Pénznem: EUR
        </div>
      </div>
    </div>
    
    <div class="section full-width">
      <div class="section-title">15. Directions as to payment for carriage<br>Fuvardíjfizetési meghagyások</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>
    
    <div class="section full-width">
      <div class="section-title">20. Special agreements<br>Egyedi megállapodások</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">
          21. Kiállítás helye<br>
          <span class="signature-label-sub">Place issued</span>
        </div>
        <div class="section-content">
          <strong>${effectiveSettings.placeIssued}</strong><br>
          Dátum: ${new Date().toLocaleDateString('hu-HU')}
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-label">
          22. A feladó aláírása és bélyegzője<br>
          <span class="signature-label-sub">Signature and stamp of the sender</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-label">
          23. Fuvarozó aláírása és bélyegzője<br>
          <span class="signature-label-sub">Signature and stamp of the carrier</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">
          24. Goods received / Áru átvétele<br>
          <span class="signature-label-sub">Date / Dátum</span>
        </div>
        <div class="signature-space">
          (dátum / date)
        </div>
      </div>
      
      <div class="signature-box" style="grid-column: 2 / -1;">
        <div class="signature-label">
          Signature and stamp of the consignee<br>
          <span class="signature-label-sub">Az átvevő aláírása és bélyegzője</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box" style="grid-column: 1 / -1;">
        <div class="signature-label">
          25. Vehicle / Jármű
        </div>
        <div class="section-content">
          Rendszám / Registration number: <strong>${effectiveSettings.vehiclePlate || ''}</strong>
        </div>
      </div>
    </div>
    
  </div>
  
  <div class="no-print" style="text-align: center; padding: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer;">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
  </div>
</body>
</html>
  `

  return html
}

function applyTemplateData(
  htmlTemplate: string,
  cssTemplate: string,
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  sequenceNumber: string,
  userSettings?: CmrLayoutSettings,
  margins?: { top: string, right: string, bottom: string, left: string },
  issueDate?: string
): string {
  const effectiveSettings = { ...DEFAULT_CMR_SETTINGS, ...userSettings }
  const firstCustomer = orders[0]?.customer || ''
  const customerInfo = customers.find(c => c.name === firstCustomer)
  
  const fullAddress = customerInfo?.fullAddress || 
    `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')

  const totalQuantity = orders.reduce((sum, order) => sum + (order.amountPc || 0), 0)
  const totalBoxes = orders.reduce((sum, order) => sum + (order.boxesCount || 0), 0)
  const totalPallets = orders.reduce((sum, order) => sum + (order.palletsCount || 0), 0)
  const totalGrossWeight = orders.reduce((sum, order) => sum + (parseFloat(String(order.grossWeightKg || 0)) || 0), 0)
  const ownOrderNumber = orders[0]?.ownOrderNumber || ''
  const orderNumber = orders[0]?.orderNumber || ''

  console.log('=== STATIKUS VÁLTOZÓK FELDOLGOZÁSA ===')
  console.log('Rendelések száma:', orders.length)
  console.log('Használt orderNumber (saját rendelési szám, csak első rendelés):', orderNumber)
  console.log('Használt ownOrderNumber (vevő rendelési szám, csak első rendelés):', ownOrderNumber)
  if (orders.length > 1) {
    console.warn('⚠️ FIGYELEM: Több rendelés van kiválasztva!')
    console.warn('⚠️ A {{orderNumber}} és {{ownOrderNumber}} statikus változók csak az első rendelés értékét tartalmazzák')
    console.warn('⚠️ Ha minden rendeléshez egyedi értéket akarsz, használd az {{#items}} cikluson belül!')
    orders.forEach((order, idx) => {
      console.log(`  Rendelés ${idx + 1}:`)
      console.log(`    - Saját rendelési szám (orderNumber):`, order.orderNumber)
      console.log(`    - Vevő rendelési száma (ownOrderNumber):`, order.ownOrderNumber)
    })
  }

  let html = htmlTemplate

  console.log('=== CMR SABLON FELDOLGOZÁS KEZDETE ===')
  console.log('Rendelések száma:', orders.length)
  console.log('Sablon hossza:', htmlTemplate.length)
  
  const itemsMatch = html.match(/{{#items}}([\s\S]*?){{\/items}}/);
  if (itemsMatch) {
    const itemTemplate = itemsMatch[1];
    
    console.log('=== CMR ITEMS FELDOLGOZÁS (ELŐSZÖR!) ===')
    console.log('Rendelések száma:', orders.length)
    console.log('Item sablon:', itemTemplate.substring(0, 200))
    
    const itemsHtml = orders.map((order, idx) => {
      console.log(`\n--- Rendelés ${idx + 1} ---`)
      console.log('Saját rendelési szám:', order.orderNumber)
      console.log('Vevő rendelési száma (ownOrderNumber):', order.ownOrderNumber)
      console.log('Termék neve:', order.productName)
      console.log('Mennyiség:', order.amountPc)
      
      const filledTemplate = itemTemplate
        .replace(/{{index}}/g, String(idx + 1))
        .replace(/{{quantity}}/g, String(order.amountPc || 0))
        .replace(/{{packaging}}/g, 'Raklap')
        .replace(/{{productName}}/g, esc(order.productName || ''))
        .replace(/{{designation}}/g, esc(order.designation || ''))
        .replace(/{{weight}}/g, esc(String(order.grossWeightKg || '-')))
        .replace(/{{boxes}}/g, String(order.boxesCount || 0))
        .replace(/{{pallets}}/g, String(order.palletsCount || 0))
        .replace(/{{orderNumber}}/g, esc(order.orderNumber || '-'))
        .replace(/{{referenceNumber}}/g, esc(order.ownOrderNumber || '-'))
        .replace(/{{ownOrderNumber}}/g, esc(order.ownOrderNumber || '-'))
      
      console.log(`✅ Rendelés ${idx + 1} feldolgozva:`)
      console.log(`  - ownOrderNumber: "${order.ownOrderNumber || '-'}"`)
      console.log(`  - productName: "${order.productName || '-'}"`)
      console.log(`  - quantity: "${order.amountPc || 0}"`)
      console.log('Kitöltött sablon részlet:', filledTemplate.substring(0, 200))
      
      return filledTemplate;
    }).join('');

    console.log('\n=== ITEMS CIKLUS ÖSSZEGZÉS ===')
    console.log(`✅ Összesen ${orders.length} rendelés feldolgozva`)
    console.log('Minden rendeléshez EGYEDI adatok lettek felhasználva:')
    orders.forEach((order, idx) => {
      console.log(`  Rendelés ${idx + 1}:`)
      console.log(`    - ownOrderNumber: "${order.ownOrderNumber || '-'}"`)
      console.log(`    - productName: "${order.productName || '-'}"`)
      console.log(`    - quantity: ${order.amountPc || 0}`)
    })

    html = html.replace(/{{#items}}[\s\S]*?{{\/items}}/g, itemsHtml);
    
    console.log('\n=== ITEMS CIKLUS BEHELYETTESÍTVE ===')
    console.log('Items blokk hossza:', itemsHtml.length)
  } else {
    console.warn('⚠️ FIGYELEM: A sablonban nincs {{#items}} ciklus!')
    console.warn('⚠️ Ez azt jelenti, hogy a sablon NEM fogja külön listázni a rendeléseket')
    console.warn('⚠️ Csak a statikus {{ownOrderNumber}} változó lesz használva, ami az első rendelés értékét tartalmazza')
  }

  console.log('\n=== STATIKUS VÁLTOZÓK BEHELYETTESÍTÉSE (MÁSODSZOR!) ===')
  html = html.replace(/{{documentNumber}}/g, esc(sequenceNumber))
  html = html.replace(/{{sequenceNumber}}/g, esc(sequenceNumber))
  html = html.replace(/{{senderName}}/g, esc(effectiveSettings.senderName || ''))
  html = html.replace(/{{senderAddress}}/g, esc(effectiveSettings.senderAddress || ''))
  html = html.replace(/{{senderCity}}/g, esc(effectiveSettings.senderCity || ''))
  html = html.replace(/{{senderCountry}}/g, esc(effectiveSettings.senderCountry || ''))
  html = html.replace(/{{senderTaxNumber}}/g, esc(effectiveSettings.senderTaxNumber || ''))
  html = html.replace(/{{recipientName}}/g, esc(customerInfo?.name || firstCustomer))
  html = html.replace(/{{recipientAddress}}/g, esc(fullAddress))
  html = html.replace(/{{recipientCity}}/g, esc(customerInfo?.city || ''))
  html = html.replace(/{{recipientCountry}}/g, esc(customerInfo?.country || ''))
  html = html.replace(/{{customerName}}/g, esc(customerInfo?.name || firstCustomer))
  html = html.replace(/{{customerAddress}}/g, esc(fullAddress))
  html = html.replace(/{{customerCity}}/g, esc(customerInfo?.city || ''))
  html = html.replace(/{{customerCountry}}/g, esc(customerInfo?.country || ''))
  html = html.replace(/{{customerTaxNumber}}/g, esc(customerInfo?.taxNumber || ''))
  html = html.replace(/{{pickupLocation}}/g, esc(effectiveSettings.placeOfTakingOver || ''))
  html = html.replace(/{{deliveryLocation}}/g, esc(customerInfo?.city || ''))
  const formattedIssueDate = issueDate
    ? new Date(issueDate + 'T00:00:00').toLocaleDateString('hu-HU')
    : new Date().toLocaleDateString('hu-HU')
  html = html.replace(/{{deliveryDate}}/g, formattedIssueDate)
  html = html.replace(/{{issueDate}}/g, formattedIssueDate)
  html = html.replace(/{{carrierName}}/g, esc(effectiveSettings.carrierName || ''))
  html = html.replace(/{{carrierAddress}}/g, esc(effectiveSettings.carrierAddress || ''))
  html = html.replace(/{{vehiclePlate}}/g, esc(effectiveSettings.vehiclePlate || ''))
  html = html.replace(/{{orderNumber}}/g, esc(orderNumber))
  html = html.replace(/{{ownOrderNumber}}/g, esc(ownOrderNumber))
  html = html.replace(/{{productName}}/g, esc(orders[0]?.productName || ''))
  html = html.replace(/{{totalQuantity}}/g, String(totalQuantity))
  html = html.replace(/{{totalBoxes}}/g, String(totalBoxes))
  html = html.replace(/{{totalPallets}}/g, String(totalPallets))
  html = html.replace(/{{totalWeight}}/g, totalGrossWeight.toFixed(2))
  
  console.log('✅ Statikus változók behelyettesítve')
  console.log('Használt orderNumber (saját rendelési szám, csak cikluson KÍVÜL):', orderNumber)
  console.log('Használt ownOrderNumber (vevő rendelési szám, csak cikluson KÍVÜL):', ownOrderNumber)

  let finalCss = cssTemplate || ''
  
  if (margins) {
    const marginStyle = `
    @page {
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm !important;
    }
    body {
      margin: 0 !important;
      padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm !important;
    }
    .cmr-document, .delivery-document {
      margin: 0 !important;
      padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm !important;
    }
    `
    finalCss = marginStyle + '\n' + finalCss
  }

  if (finalCss) {
    const styleRegex = /<\/style>/i
    if (styleRegex.test(html)) {
      html = html.replace(styleRegex, `\n${finalCss}\n</style>`)
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `<style>\n${finalCss}\n</style>\n</head>`)
    } else {
      html = `<style>\n${finalCss}\n</style>\n` + html
    }
  }

  console.log('=== CSS BEILLESZTÉS (FRISSÍTETT) ===')
  console.log('CSS hossza:', finalCss.length)
  console.log('CSS tartalom (első 500 karakter):', finalCss.substring(0, 500))
  console.log('HTML tartalmaz border CSS-t:', finalCss.includes('border'))
  console.log('HTML tartalmaz </style> taget:', html.includes('</style>'))
  console.log('HTML tartalmaz </head> taget:', html.includes('</head>'))
  console.log('Beillesztés módja:', /<\/style>/i.test(htmlTemplate) ? 'Meglévő <style> kiterjesztése' : 'Új <style> hozzáadása')

  return html
}

export async function exportCmrAsHtml(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void,
  userSettings?: CmrLayoutSettings,
  /** Szerver-alapú sablonlista — ha átadják, nem olvas localStorage-ból */
  savedTemplatesOverride?: any[],
  /** Szerver-alapú aktív sablonok — ha átadják, nem olvas localStorage-ból */
  activeTemplatesOverride?: { cmr?: string; delivery?: string },
  /** Kiállítás dátuma (YYYY-MM-DD). Ha nincs megadva, az aktuális nap. */
  issueDate?: string
) {
  if (!orders.length) {
    toast.error('Nincsenek exportálandó rendelések')
    return
  }

  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'cmr')
  const firstCustomer = orders[0]?.customer || 'export'
  const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
  const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `CMR_${sequenceNumber}_${safeCustomerName}.html`

  let html = ''
  let templateSource = 'beégetett sablon'
  let activeTemplate: any = null
  let usedMargins: any = null

  try {
    const activeTemplates = activeTemplatesOverride ?? kvStore.get<{ cmr?: string, delivery?: string }>('active-templates')
    const savedTemplates = savedTemplatesOverride ?? kvStore.get<any[]>('saved-templates')

    const firstOrder = orders[0]
    const customer = customers.find(c => c.name === firstOrder?.customer)
    let templateToUse: any = null
    
    if (customer?.cmrTemplateId) {
      templateToUse = savedTemplates?.find((t: any) => t.id === customer.cmrTemplateId)
      
      if (templateToUse && templateToUse.data && templateToUse.data.html) {
        console.log('=== CMR Export Vevő-Specifikus Sablonnal ===')
        console.log('Vevő neve:', customer.name)
        console.log('Sablon forrás: Vevőhöz rendelt sablon')
        console.log('Sablon neve:', templateToUse.name)
        console.log('Sablon ID:', templateToUse.id)
        templateSource = 'vevő sablona: ' + templateToUse.name
        usedMargins = templateToUse.data.margins
        
        html = applyTemplateData(
          templateToUse.data.html,
          templateToUse.data.css,
          orders,
          customers,
          products,
          deliveryNotes,
          sequenceNumber,
          userSettings,
          templateToUse.data.margins,
          issueDate
        )
      }
    }

    if (!templateToUse && activeTemplates?.cmr) {
      activeTemplate = savedTemplates?.find((t: any) => t.id === activeTemplates.cmr)

      if (!activeTemplate) {
        console.warn('⚠️ Aktív CMR sablon ID nem található a mentett sablonok között!')
        console.warn('  Keresett ID:', activeTemplates.cmr)
        console.warn('  Elérhető saved-templates IDs:', savedTemplates?.map((t: any) => t.id))
      }

      if (activeTemplate && activeTemplate.data && activeTemplate.data.html) {
        console.log('=== CMR Export Aktív Sablonnal ===')
        console.log('Sablon forrás: Aktív sablon mentésből')
        console.log('Sablon neve:', activeTemplate.name)
        console.log('Sablon ID:', activeTemplate.id)
        templateSource = 'aktív sablon: ' + activeTemplate.name
        usedMargins = activeTemplate.data.margins

        html = applyTemplateData(
          activeTemplate.data.html,
          activeTemplate.data.css,
          orders,
          customers,
          products,
          deliveryNotes,
          sequenceNumber,
          userSettings,
          activeTemplate.data.margins,
          issueDate
        )
      }
    }

    if (!templateToUse && (!activeTemplate || !activeTemplate.data || !activeTemplate.data.html)) {
      const cmrTemplates = savedTemplates?.filter((t: any) => t.data?.type === 'cmr') || []

      if (cmrTemplates.length > 0) {
        const sortedCmrTemplates = [...cmrTemplates].sort((a: any, b: any) => {
          const ta = a.data?.timestamp || a.timestamp || ''
          const tb = b.data?.timestamp || b.timestamp || ''
          return tb.localeCompare(ta)
        })
        const defaultTemplate = sortedCmrTemplates[0]
        console.log('=== CMR Export Mentett Sablonnal (nincs aktív beállítva) ===')
        console.log('Sablon forrás: Sablon Mentések (legfrissebb CMR sablon)')
        console.log('Sablon neve:', defaultTemplate.name)
        console.log('Sablon ID:', defaultTemplate.id)
        console.log('Összes CMR sablon:', cmrTemplates.map((t: any) => `${t.id} (${t.name})`))
        templateSource = 'mentett sablon: ' + defaultTemplate.name
        usedMargins = defaultTemplate.data.margins

        html = applyTemplateData(
          defaultTemplate.data.html,
          defaultTemplate.data.css,
          orders,
          customers,
          products,
          deliveryNotes,
          sequenceNumber,
          userSettings,
          defaultTemplate.data.margins,
          issueDate
        )
      } else {
        console.log('=== CMR Export - Nincs mentett sablon ===')
        console.log('Sablon forrás: src/lib/cmrHtmlTemplate.ts (beégetett sablon)')
        html = generateCmrHtmlTemplate(orders, customers, products, deliveryNotes, userSettings)
      }
    }
  } catch (error) {
    console.warn('Nem sikerült betölteni a mentett sablont, beégetett sablon használata', error)
    html = generateCmrHtmlTemplate(orders, customers, products, deliveryNotes, userSettings)
  }

  console.log('Rendelések száma:', orders.length)
  console.log('Szekvencia szám:', sequenceNumber)
  console.log('Fájlnév:', fileName)
  console.log('Sablon forrás:', templateSource)
  
  if (usedMargins) {
    console.log('=== MARGÓ KONFIGURÁCIÓ ===')
    console.log('Felső:', usedMargins.top + 'mm')
    console.log('Jobb:', usedMargins.right + 'mm')
    console.log('Alsó:', usedMargins.bottom + 'mm')
    console.log('Bal:', usedMargins.left + 'mm')
    console.log('Margók alkalmazva: IGEN')
  } else {
    console.log('Margók alkalmazva: NINCS (alapértelmezett 10mm használata)')
  }
  
  const newWindow = window.open('', '_blank')
  if (newWindow) {
    newWindow.document.write(html)
    newWindow.document.close()
  }

  const exportData = orders.map(order => ({
    'Saját rendelési szám': order.orderNumber,
    'Vevő rendelési száma': order.ownOrderNumber,
    'Termék': order.productName,
    'Mennyiség': order.amountPc,
  }))

  if (onExportSaved) {
    onExportSaved({
      type: 'cmr',
      orderIds: orders.map(o => o.id),
      exportData: exportData as any,
      customer: firstCustomer,
      fileName: fileName,
      exportDate: new Date().toISOString(),
      issueDate: issueDate ?? new Date().toISOString().slice(0, 10),
    }, sequenceNumber)
  }

  toast.success(`CMR dokumentum generálva: ${fileName}`)
}
