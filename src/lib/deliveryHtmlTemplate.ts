import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { kvStore } from '@/lib/kvStore'
import { esc } from '@/lib/htmlSafe'
import { toast } from 'sonner'

export interface TemplateStyles {
  primaryColor: string
  secondaryColor: string
  textColor: string
  headerFontSize: string
  bodyFontSize: string
  borderWidth: string
  borderColor: string
  borderRadius: string
  backgroundColor: string
  tableBgColor: string
  tableHeaderBgColor: string
  tableHeaderTextColor: string
  padding: string
  cellPadding: string
  pageMargin: string
  cellMarginTop: string
  cellMarginBottom: string
  cellMarginLeft: string
  cellMarginRight: string
}

const DEFAULT_DELIVERY_STYLES: TemplateStyles = {
  primaryColor: '#2c5aa0',
  secondaryColor: '#666666',
  textColor: '#000000',
  headerFontSize: '20pt',
  bodyFontSize: '10pt',
  borderWidth: '2px',
  borderColor: '#2c5aa0',
  borderRadius: '5px',
  backgroundColor: '#ffffff',
  tableBgColor: '#f8f9fa',
  tableHeaderBgColor: '#2c5aa0',
  tableHeaderTextColor: '#ffffff',
  padding: '10px',
  cellPadding: '6px',
  pageMargin: '10px',
  cellMarginTop: '0px',
  cellMarginBottom: '0px',
  cellMarginLeft: '0px',
  cellMarginRight: '0px',
}

export function generateDeliveryHtmlTemplate(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  customStyles?: Partial<TemplateStyles>
): string {
  const styles = { ...DEFAULT_DELIVERY_STYLES, ...customStyles }
  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'delivery')
  
  const firstCustomer = orders[0]?.customer || ''
  const customerInfo = customers.find(c => c.name === firstCustomer)
  
  const fullAddress = customerInfo?.fullAddress || 
    `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')

  const totalQuantity = orders.reduce((sum, order) => sum + (order.amountPc || 0), 0)
  const totalBoxes = orders.reduce((sum, order) => sum + (order.boxesCount || 0), 0)
  const totalPallets = orders.reduce((sum, order) => sum + (order.palletsCount || 0), 0)
  const totalGrossWeight = orders.reduce((sum, order) => sum + (parseFloat(String(order.grossWeightKg || 0)) || 0), 0)

  const html = `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Szállítólevél - ${sequenceNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: ${styles.bodyFontSize};
      line-height: 1.3;
      color: ${styles.textColor};
      background: #f5f5f5;
      padding: ${styles.pageMargin};
    }
    
    .delivery-document {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: ${styles.backgroundColor};
      padding: ${styles.padding};
      display: flex;
      flex-direction: column;
    }
    
    .content-wrapper {
      flex: 1 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: ${styles.borderWidth} solid ${styles.primaryColor};
      padding-bottom: 10px;
    }
    
    .header h1 {
      font-size: ${styles.headerFontSize};
      font-weight: bold;
      color: ${styles.primaryColor};
      margin-bottom: 5px;
    }
    
    .sequence-number {
      position: absolute;
      top: 20px;
      right: 20px;
      font-size: calc(${styles.headerFontSize} * 0.7);
      font-weight: bold;
      color: ${styles.primaryColor};
    }
    
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .info-box {
      border: ${styles.borderWidth} solid ${styles.borderColor};
      padding: ${styles.padding};
      border-radius: ${styles.borderRadius};
      background: ${styles.tableBgColor};
    }
    
    .info-box h3 {
      font-size: calc(${styles.bodyFontSize} * 1.1);
      font-weight: bold;
      color: ${styles.primaryColor};
      margin-bottom: 8px;
      border-bottom: 1px solid ${styles.primaryColor};
      padding-bottom: 3px;
    }
    
    .info-box p {
      margin: 3px 0;
      font-size: ${styles.bodyFontSize};
    }
    
    .info-box strong {
      font-weight: bold;
    }
    
    .delivery-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: calc(${styles.bodyFontSize} * 0.9);
    }
    
    .delivery-table th,
    .delivery-table td {
      border: 1px solid ${styles.secondaryColor};
      padding: ${styles.cellPadding};
      margin-top: ${styles.cellMarginTop};
      margin-bottom: ${styles.cellMarginBottom};
      margin-left: ${styles.cellMarginLeft};
      margin-right: ${styles.cellMarginRight};
      text-align: left;
    }
    
    .delivery-table th {
      background: ${styles.tableHeaderBgColor};
      color: ${styles.tableHeaderTextColor};
      font-weight: bold;
      text-align: center;
    }
    
    .delivery-table td.center {
      text-align: center;
    }
    
    .delivery-table td.right {
      text-align: right;
    }
    
    .delivery-table tbody tr:nth-child(even) {
      background: ${styles.tableBgColor};
    }
    
    .delivery-table tbody tr:hover {
      background: #e3f2fd;
    }
    
    .delivery-table tfoot {
      font-weight: bold;
      background: #e0e0e0;
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: auto;
      padding-top: 30px;
      page-break-inside: avoid;
    }
    
    .signature-box {
      border: 1px solid ${styles.secondaryColor};
      padding: ${styles.padding};
      min-height: 100px;
      border-radius: ${styles.borderRadius};
    }
    
    .signature-label {
      font-size: ${styles.bodyFontSize};
      font-weight: bold;
      margin-bottom: 10px;
      color: ${styles.primaryColor};
    }
    
    .signature-space {
      margin-top: 50px;
      border-top: 1px solid ${styles.secondaryColor};
      padding-top: 5px;
      text-align: center;
      font-size: calc(${styles.bodyFontSize} * 0.8);
      color: ${styles.secondaryColor};
    }
    
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: calc(${styles.bodyFontSize} * 0.8);
      color: ${styles.secondaryColor};
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .delivery-document {
        margin: 0;
        padding: 10mm;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="delivery-document">
    <div class="content-wrapper">
      <div class="sequence-number">Szám: ${sequenceNumber}</div>
      
      <div class="header">
        <h1>SZÁLLÍTÓLEVÉL</h1>
        <p>Delivery Note</p>
      </div>
      
      <div class="info-section">
        <div class="info-box">
          <h3>Feladó / Sender</h3>
          <p><strong>Magma Kft</strong></p>
          <p>H-1211 Budapest, Déli utca 13.</p>
          <p>Adószám: HU10368152-2-43</p>
          <p>Dátum: ${new Date().toLocaleDateString('hu-HU')}</p>
        </div>
        
        <div class="info-box">
          <h3>Címzett / Consignee</h3>
          <p><strong>${customerInfo?.name || firstCustomer}</strong></p>
          <p>${fullAddress}</p>
          <p>${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}</p>
          <p>${customerInfo?.country || ''}</p>
          ${customerInfo?.taxNumber ? `<p>Adószám: ${customerInfo.taxNumber}</p>` : ''}
        </div>
      </div>
      
      <table class="delivery-table">
        <thead>
          <tr>
            <th style="width: 15%;">Saját rendelési szám</th>
            <th style="width: 15%;">Vevő rendelési száma</th>
            <th style="width: 30%;">Termék név</th>
            <th style="width: 10%;">Mennyiség (db)</th>
            <th style="width: 10%;">Dobozok száma</th>
            <th style="width: 10%;">Raklapok száma</th>
            <th style="width: 10%;">Bruttó súly (kg)</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td class="center">${esc(order.ownOrderNumber || '-')}</td>
              <td class="center">${esc(order.orderNumber || '-')}</td>
              <td>${esc(order.productName || '-')}</td>
              <td class="center">${order.amountPc || 0}</td>
              <td class="center">${order.boxesCount || '-'}</td>
              <td class="center">${order.palletsCount || '-'}</td>
              <td class="right">${esc(order.grossWeightKg || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="right"><strong>Összesen:</strong></td>
            <td class="center"><strong>${totalQuantity}</strong></td>
            <td class="center"><strong>${totalBoxes}</strong></td>
            <td class="center"><strong>${totalPallets}</strong></td>
            <td class="right"><strong>${totalGrossWeight.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">
        <p>Ez egy számítógép által generált dokumentum. / This is a computer-generated document.</p>
        <p>Magma Kft • H-1211 Budapest, Déli utca 13. • HU10368152-2-43</p>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">Feladó aláírása és bélyegzője<br>Sender's signature and stamp</div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-label">Átvevő aláírása és bélyegzője<br>Consignee's signature and stamp</div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>
    
  </div>
  
  <div class="no-print" style="text-align: center; padding: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer; background: #2c5aa0; color: white; border: none; border-radius: 5px;">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
  </div>
</body>
</html>
  `

  return html
}

function applyDeliveryTemplateData(
  htmlTemplate: string,
  cssTemplate: string,
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  sequenceNumber: string,
  customStyles?: Partial<TemplateStyles>,
  margins?: { top: string, right: string, bottom: string, left: string }
): string {
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

  let html = htmlTemplate

  console.log('=== DELIVERY SABLON FELDOLGOZÁS KEZDETE ===')
  console.log('Rendelések száma:', orders.length)
  console.log('Sablon hossza:', htmlTemplate.length)

  const itemsMatch = html.match(/{{#items}}([\s\S]*?){{\/items}}/);
  if (itemsMatch) {
    const itemTemplate = itemsMatch[1];
    
    console.log('=== DELIVERY ITEMS FELDOLGOZÁS (ELŐSZÖR!) ===')
    console.log('Rendelések száma:', orders.length)
    console.log('Item sablon:', itemTemplate.substring(0, 200))
    
    const itemsHtml = orders.map((order, idx) => {
      console.log(`\n--- Rendelés ${idx + 1} ---`)
      console.log('Saját rendelési szám (orderNumber):', order.orderNumber)
      console.log('Vevő rendelési száma (ownOrderNumber):', order.ownOrderNumber)
      console.log('Termék neve:', order.productName)
      console.log('Mennyiség:', order.amountPc)
      
      const filledTemplate = itemTemplate
        .replace(/{{index}}/g, String(idx + 1))
        .replace(/{{productName}}/g, esc(order.productName || '-'))
        .replace(/{{quantity}}/g, String(order.amountPc || 0))
        .replace(/{{boxes}}/g, String(order.boxesCount || '-'))
        .replace(/{{pallets}}/g, String(order.palletsCount || '-'))
        .replace(/{{weight}}/g, esc(String(order.grossWeightKg || '-')))
        .replace(/{{ownOrderNumber}}/g, esc(order.ownOrderNumber || '-'))
        .replace(/{{referenceNumber}}/g, esc(order.ownOrderNumber || '-'))
        .replace(/{{orderNumber}}/g, esc(order.orderNumber || '-'))
        .replace(/{{designation}}/g, esc(order.designation || '-'))
        .replace(/{{material}}/g, order.material || '-')
        .replace(/{{surfaceTreatment}}/g, order.surfaceTreatment || '-')
      
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
  html = html.replace(/{{sequenceNumber}}/g, esc(sequenceNumber))
  html = html.replace(/{{senderName}}/g, esc('Magma Kft'))
  html = html.replace(/{{senderAddress}}/g, esc('H-1211 Budapest, Déli utca 13.'))
  html = html.replace(/{{senderTaxNumber}}/g, esc('HU10368152-2-43'))
  html = html.replace(/{{customerName}}/g, esc(customerInfo?.name || firstCustomer))
  html = html.replace(/{{customerAddress}}/g, esc(fullAddress))
  html = html.replace(/{{customerCity}}/g, esc(customerInfo?.city || ''))
  html = html.replace(/{{customerCountry}}/g, esc(customerInfo?.country || ''))
  html = html.replace(/{{customerTaxNumber}}/g, esc(customerInfo?.taxNumber || ''))
  html = html.replace(/{{deliveryDate}}/g, new Date().toLocaleDateString('hu-HU'))
  html = html.replace(/{{issueDate}}/g, new Date().toLocaleDateString('hu-HU'))
  html = html.replace(/{{referenceNumber}}/g, esc(sequenceNumber))
  html = html.replace(/{{totalQuantity}}/g, String(totalQuantity))
  html = html.replace(/{{totalBoxes}}/g, String(totalBoxes))
  html = html.replace(/{{totalPallets}}/g, String(totalPallets))
  html = html.replace(/{{totalWeight}}/g, totalGrossWeight.toFixed(2))
  html = html.replace(/{{orderNumber}}/g, esc(orderNumber))
  html = html.replace(/{{ownOrderNumber}}/g, esc(ownOrderNumber))
  html = html.replace(/{{productName}}/g, esc(orders[0]?.productName || ''))
  
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

  console.log('=== DELIVERY CSS BEILLESZTÉS (FRISSÍTETT) ===')
  console.log('CSS hossza:', finalCss.length)
  console.log('CSS tartalom (első 500 karakter):', finalCss.substring(0, 500))
  console.log('HTML tartalmaz border CSS-t:', finalCss.includes('border'))
  console.log('HTML tartalmaz </style> taget:', html.includes('</style>'))
  console.log('HTML tartalmaz </head> taget:', html.includes('</head>'))
  console.log('Beillesztés módja:', /<\/style>/i.test(htmlTemplate) ? 'Meglévő <style> kiterjesztése' : 'Új <style> hozzáadása')

  return html
}

export async function exportDeliveryAsHtml(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void,
  customStyles?: Partial<TemplateStyles>,
  /** Szerver-alapú sablonlista — ha átadják, nem olvas localStorage-ból */
  savedTemplatesOverride?: any[],
  /** Szerver-alapú aktív sablonok — ha átadják, nem olvas localStorage-ból */
  activeTemplatesOverride?: { cmr?: string; delivery?: string }
) {
  if (!orders.length) {
    toast.error('Nincsenek exportálandó rendelések')
    return
  }

  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'delivery')
  const firstCustomer = orders[0]?.customer || 'export'
  const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
  const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Szallitolevel_${sequenceNumber}_${safeCustomerName}.html`

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
    
    if (customer?.deliveryTemplateId) {
      templateToUse = savedTemplates?.find((t: any) => t.id === customer.deliveryTemplateId)
      
      if (templateToUse && templateToUse.data && templateToUse.data.html) {
        console.log('=== Szállítólevél Export Vevő-Specifikus Sablonnal ===')
        console.log('Vevő neve:', customer.name)
        console.log('Sablon forrás: Vevőhöz rendelt sablon')
        console.log('Sablon neve:', templateToUse.name)
        console.log('Sablon ID:', templateToUse.id)
        templateSource = 'vevő sablona: ' + templateToUse.name
        usedMargins = templateToUse.data.margins
        
        html = applyDeliveryTemplateData(
          templateToUse.data.html, 
          templateToUse.data.css, 
          orders, 
          customers, 
          products, 
          deliveryNotes, 
          sequenceNumber, 
          customStyles,
          templateToUse.data.margins
        )
      }
    }
    
    if (!templateToUse && activeTemplates?.delivery) {
      activeTemplate = savedTemplates?.find((t: any) => t.id === activeTemplates.delivery)
      
      if (activeTemplate && activeTemplate.data && activeTemplate.data.html) {
        console.log('=== Szállítólevél Export Aktív Sablonnal ===')
        console.log('Sablon forrás: Aktív sablon mentésből')
        console.log('Sablon neve:', activeTemplate.name)
        console.log('Sablon ID:', activeTemplate.id)
        templateSource = 'aktív sablon: ' + activeTemplate.name
        usedMargins = activeTemplate.data.margins
        
        html = applyDeliveryTemplateData(
          activeTemplate.data.html, 
          activeTemplate.data.css, 
          orders, 
          customers, 
          products, 
          deliveryNotes, 
          sequenceNumber, 
          customStyles,
          activeTemplate.data.margins
        )
      }
    }
    
    if (!templateToUse && (!activeTemplate || !activeTemplate.data || !activeTemplate.data.html)) {
      const deliveryTemplates = savedTemplates?.filter((t: any) => t.data?.type === 'delivery') || []
      
      if (deliveryTemplates.length > 0) {
        const defaultTemplate = deliveryTemplates[0]
        console.log('=== Szállítólevél Export Mentett Sablonnal (nincs aktív beállítva) ===')
        console.log('Sablon forrás: Sablon Mentések (első delivery sablon)')
        console.log('Sablon neve:', defaultTemplate.name)
        console.log('Sablon ID:', defaultTemplate.id)
        templateSource = 'mentett sablon: ' + defaultTemplate.name
        usedMargins = defaultTemplate.data.margins
        
        html = applyDeliveryTemplateData(
          defaultTemplate.data.html, 
          defaultTemplate.data.css, 
          orders, 
          customers, 
          products, 
          deliveryNotes, 
          sequenceNumber, 
          customStyles,
          defaultTemplate.data.margins
        )
      } else {
        console.log('=== Szállítólevél Export - Nincs mentett sablon ===')
        console.log('Sablon forrás: src/lib/deliveryHtmlTemplate.ts (beégetett sablon)')
        html = generateDeliveryHtmlTemplate(orders, customers, products, deliveryNotes, customStyles)
      }
    }
  } catch (error) {
    console.warn('Nem sikerült betölteni a mentett sablont, beégetett sablon használata', error)
    html = generateDeliveryHtmlTemplate(orders, customers, products, deliveryNotes, customStyles)
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
    'Termék név': order.productName,
    'Mennyiség': order.amountPc,
    'Dobozok száma': order.boxesCount,
    'Raklapok száma': order.palletsCount,
    'Bruttó súly': order.grossWeightKg,
  }))

  if (onExportSaved) {
    onExportSaved({
      type: 'delivery',
      orderIds: orders.map(o => o.id),
      exportData: exportData as any,
      customer: firstCustomer,
      fileName: fileName,
      exportDate: new Date().toISOString(),
    }, sequenceNumber)
  }

  toast.success(`Szállítólevél dokumentum generálva: ${fileName}`)
}
