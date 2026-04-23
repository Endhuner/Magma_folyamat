import { Order, Customer, Product } from './types'
import { toast } from 'sonner'

interface LabelData {
  productName: string
  ownOrderNumber: string
  orderNumber: string
  requiredDate: string
  drawingNumber: string
  piecesPerBox: string
  customerName: string
  orderNotes: string
  productNotes: string
  boxesCount: string
}

export interface LabelTemplate {
  id: string
  name: string
  type: 'label'
  html: string
  css: string
  timestamp: string
  description?: string
  margins: {
    top: string
    right: string
    bottom: string
    left: string
  }
  labelsPerPage?: number
  labelsPerRow?: number
  labelsPerColumn?: number
  cellSettings?: {
    width?: string
    height?: string
    borderWidth?: string
    borderColor?: string
    padding?: string
    fontSize?: string
    verticalGap?: string
    horizontalGap?: string
  }
  fontSettings?: {
    fontFamily?: string
    productFontSize?: string
    productFontWeight?: string
    productColor?: string
    orderFontSize?: string
    orderColor?: string
    dateFontSize?: string
    dateColor?: string
  }
  alignmentSettings?: {
    textAlign?: 'left' | 'center' | 'right'
    verticalAlign?: 'top' | 'middle' | 'bottom'
    productAlign?: 'left' | 'center' | 'right'
    orderAlign?: 'left' | 'center' | 'right'
    dateAlign?: 'left' | 'center' | 'right'
    notesAlign?: 'left' | 'center' | 'right'
  }
  printSettings?: {
    copiesPerLabel?: number
    skipEmptyLabels?: boolean
    startFrom?: number
    endAt?: number
  }
  paddingSettings?: {
    contentPaddingTop?: string
    contentPaddingRight?: string
    contentPaddingBottom?: string
    contentPaddingLeft?: string
  }
}

export async function generateLabels(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  customTemplate?: LabelTemplate
) {
  const labels: LabelData[] = []

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('🏷️  CÍMKE GENERÁLÁS - RÉSZLETES TESZT ANALÍZIS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`📊 Rendelések száma: ${orders.length}`)
  console.log(`📦 Termékek száma az adatbázisban: ${products.length}`)
  console.log(`👥 Vevők száma: ${customers.length}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  for (let orderIndex = 0; orderIndex < orders.length; orderIndex++) {
    const order = orders[orderIndex]
    const boxCount = order.boxesCount || 1
    
    console.log(`\n┌─────────────────────────────────────────────────────────────┐`)
    console.log(`│ 📝 RENDELÉS #${orderIndex + 1}/${orders.length}`)
    console.log(`├─────────────────────────────────────────────────────────────┤`)
    console.log(`│ Saját rendelési szám:  ${order.ownOrderNumber}`)
    console.log(`│ Vevő rendelési szám:   ${order.orderNumber}`)
    console.log(`│ Vevő neve:             ${order.customer}`)
    console.log(`│ Termék név (productName): ${order.productName}`)
    console.log(`│ Megnevezés (designation): ${order.designation}`)
    console.log(`│ Dobozok száma:         ${order.boxesCount}`)
    console.log(`│ Megjegyzések:          ${order.notes || '(nincs)'}`)
    console.log(`└─────────────────────────────────────────────────────────────┘`)
    
    console.log(`\n🔍 TERMÉK KERESÉS A PRODUCTS TÁBLÁBAN...`)
    console.log(`   Keresési kritériumok:`)
    console.log(`   1️⃣ Vevő egyezés: rendelés.customer === termék.customer`)
    console.log(`   2️⃣ Rajzszám egyezés: rendelés.productName === termék.drawingNumber`)
    console.log(`   3️⃣ Terméknév egyezés: rendelés.productName === termék.productName`)
    console.log(`\n   Összes termék ellenőrzése (${products.length} db):\n`)
    
    let matchedProduct = null
    let matchIndex = -1
    
    for (let i = 0; i < products.length; i++) {
      const p = products[i]
      const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
      
      if (customerMatch) {
        const orderProductName = order.productName.trim().toLowerCase()
        const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
        const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
        
        const isMatch = matchByDrawingNumber || matchByProductName
        
        if (isMatch) {
          console.log(`   ✅ [${i + 1}] TALÁLAT!`)
          matchedProduct = p
          matchIndex = i
        } else {
          console.log(`   ⚠️  [${i + 1}] Vevő egyezik, DE termék nem`)
        }
        
        console.log(`       Termék vevő: "${p.customer}"`)
        console.log(`       Termék rajzszám: "${p.drawingNumber}"`)
        console.log(`       Termék név: "${p.productName}"`)
        console.log(`       Vevő egyezés: ${customerMatch ? '✓' : '✗'}`)
        console.log(`       Rajzszám egyezés: ${matchByDrawingNumber ? '✓' : '✗'} (termék: "${p.drawingNumber}" <=> rendelés: "${order.productName}")`)
        console.log(`       Terméknév egyezés: ${matchByProductName ? '✓' : '✗'} (termék: "${p.productName}" <=> rendelés: "${order.productName}")`)
        console.log(`       Doboz/db: ${p.piecesPerBox || '(nincs megadva)'}`)
        
        if (isMatch) {
          console.log(`\n   🎯 PÁROSÍTÁS SIKERES! Termék index: ${i + 1}`)
          break
        }
        console.log('')
      }
    }
    
    const product = matchedProduct
    const customer = customers.find(c => c.name === order.customer)
    
    if (!product) {
      console.log(`\n   ❌ NEM TALÁLHATÓ TERMÉK!`)
      console.log(`   ⚠️  PROBLÉMA DIAGNÓZIS:`)
      
      const matchingCustomerProducts = products.filter(p => 
        p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
      )
      
      if (matchingCustomerProducts.length === 0) {
        console.log(`   ❗ Nincs egyetlen termék sem a "${order.customer}" vevőhöz`)
        console.log(`   💡 Ellenőrizd: a termékek táblában szerepel-e ez a vevő`)
      } else {
        console.log(`   ℹ️  Van ${matchingCustomerProducts.length} db termék ehhez a vevőhöz:`)
        matchingCustomerProducts.forEach((p, idx) => {
          console.log(`      ${idx + 1}. Rajzszám: "${p.drawingNumber}", Név: "${p.productName}"`)
        })
        console.log(`\n   ❗ A rendelés productName értéke ("${order.productName}") nem egyezik`)
        console.log(`      egyik termék rajzszámával vagy nevével sem!`)
        console.log(`\n   💡 MEGOLDÁS: Ellenőrizd, hogy a rendelésben szereplő`)
        console.log(`      productName pontosan megegyezik-e egy termék drawingNumber`)
        console.log(`      vagy productName értékével (kis/nagybetű nem számít)`)
      }
    } else {
      console.log(`\n   ✅ TERMÉK MEGTALÁLVA! (index: ${matchIndex + 1}/${products.length})`)
      console.log(`      Rajzszám: ${product.drawingNumber}`)
      console.log(`      Termék név: ${product.productName}`)
      console.log(`      Doboz/db: ${product.piecesPerBox || '❌ NINCS MEGADVA'}`)
      console.log(`      Vevő: ${product.customer}`)
    }
    
    console.log(`\n📋 CÍMKE ADATOK ÖSSZEÁLLÍTÁSA:`)
    const labelData = {
      productName: product?.productName || order.designation || order.productName || '',
      ownOrderNumber: order.ownOrderNumber || '',
      orderNumber: order.orderNumber || '',
      requiredDate: order.requiredDate || '',
      drawingNumber: product?.drawingNumber || order.productName || '',
      piecesPerBox: product?.piecesPerBox || '',
      customerName: customer?.name || order.customer || '',
      orderNotes: order.notes || '',
      productNotes: product?.notes || '',
      boxesCount: order.boxesCount?.toString() || ''
    }
    
    console.log(`   productName (címkén):    ${labelData.productName}`)
    console.log(`   drawingNumber (címkén):  ${labelData.drawingNumber}`)
    console.log(`   piecesPerBox (címkén):   ${labelData.piecesPerBox || '❌ ÜRES'}`)
    console.log(`   ownOrderNumber:          ${labelData.ownOrderNumber}`)
    console.log(`   orderNumber:             ${labelData.orderNumber}`)
    console.log(`   requiredDate:            ${labelData.requiredDate}`)
    console.log(`   customerName:            ${labelData.customerName}`)
    console.log(`   orderNotes:              ${labelData.orderNotes || '(nincs)'}`)
    console.log(`   productNotes:            ${labelData.productNotes || '(nincs)'}`)
    console.log(`   boxesCount:              ${labelData.boxesCount}`)
    
    console.log(`\n📦 Címkék létrehozása: ${boxCount} db címke ehhez a rendeléshez`)
    
    for (let i = 0; i < boxCount; i++) {
      labels.push(labelData)
    }
    
    console.log(`✅ Címkék hozzáadva (összesen eddig: ${labels.length} db)\n`)
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('📊 ÖSSZEFOGLALÓ')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Feldolgozott rendelések: ${orders.length}`)
  console.log(`Létrehozott címkék: ${labels.length}`)
  console.log(`Termékkel párosított: ${labels.filter(l => l.piecesPerBox).length} db`)
  console.log(`Termék nélküli: ${labels.filter(l => !l.piecesPerBox).length} db`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  const targetLabelCount = Math.max(40, Math.ceil(labels.length / 40) * 40)
  
  while (labels.length < targetLabelCount) {
    labels.push({
      productName: '',
      ownOrderNumber: '',
      orderNumber: '',
      requiredDate: '',
      drawingNumber: '',
      piecesPerBox: '',
      customerName: '',
      orderNotes: '',
      productNotes: '',
      boxesCount: ''
    })
  }

  let templateToUse = customTemplate
  
  if (!templateToUse) {
    const firstOrder = orders[0]
    const customer = customers.find(c => c.name === firstOrder?.customer)
    
    if (customer?.labelTemplateId) {
      try {
        const labelTemplates = await spark.kv.get<LabelTemplate[]>('label-templates')
        templateToUse = labelTemplates?.find(t => t.id === customer.labelTemplateId)
        
        if (templateToUse) {
          console.log('=== Címke Export Vevő-Specifikus Sablonnal ===')
          console.log('Vevő neve:', customer.name)
          console.log('Sablon neve:', templateToUse.name)
        }
      } catch (error) {
        console.warn('Nem sikerült betölteni a vevő címke sablonját', error)
      }
    }
  }

  const html = templateToUse 
    ? generateCustomLabelHTML(labels, templateToUse)
    : generateLabelHTML(labels)
  
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cimkek_${new Date().toISOString().split('T')[0]}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`${labels.length} címke generálva (${targetLabelCount / 40} teljes oldal)`)
}

export async function previewLabels(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  customTemplate?: LabelTemplate
): Promise<string> {
  const labels: LabelData[] = []

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('👁️  CÍMKE ELŐNÉZET - TESZT MÓD')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Rendelések száma: ${orders.length} (max 3 címke/rendelés)`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  for (let orderIndex = 0; orderIndex < orders.length; orderIndex++) {
    const order = orders[orderIndex]
    const boxCount = Math.min(order.boxesCount || 1, 3)
    
    console.log(`\n🔍 ELŐNÉZET RENDELÉS #${orderIndex + 1}: ${order.ownOrderNumber}`)
    
    const product = products.find(p => {
      const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
      if (!customerMatch) return false
      
      const orderProductName = order.productName.trim().toLowerCase()
      const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
      const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
      
      return matchByDrawingNumber || matchByProductName
    })
    
    const customer = customers.find(c => c.name === order.customer)
    
    if (product) {
      console.log(`✅ Termék megtalálva: ${product.drawingNumber} - ${product.productName}`)
    } else {
      console.log(`❌ Termék nem található a products táblában`)
    }
    
    for (let i = 0; i < boxCount; i++) {
      labels.push({
        productName: product?.productName || order.designation || order.productName || '',
        ownOrderNumber: order.ownOrderNumber || '',
        orderNumber: order.orderNumber || '',
        requiredDate: order.requiredDate || '',
        drawingNumber: product?.drawingNumber || order.productName || '',
        piecesPerBox: product?.piecesPerBox || '',
        customerName: customer?.name || order.customer || '',
        orderNotes: order.notes || '',
        productNotes: product?.notes || '',
        boxesCount: order.boxesCount?.toString() || ''
      })
    }
  }
  
  console.log(`\n📊 ELŐNÉZET ÖSSZESEN: ${labels.length} címke\n`)

  const targetLabelCount = Math.max(40, Math.ceil(labels.length / 40) * 40)
  
  while (labels.length < targetLabelCount) {
    labels.push({
      productName: '',
      ownOrderNumber: '',
      orderNumber: '',
      requiredDate: '',
      drawingNumber: '',
      piecesPerBox: '',
      customerName: '',
      orderNotes: '',
      productNotes: '',
      boxesCount: ''
    })
  }

  return customTemplate 
    ? generateCustomLabelHTML(labels, customTemplate)
    : generateLabelHTML(labels)
}

export function generateCustomLabelHTML(labels: LabelData[], template: LabelTemplate): string {
  const labelsPerPage = template.labelsPerPage || 40
  const labelsPerRow = template.labelsPerRow || 5
  const labelsPerColumn = template.labelsPerColumn || 8
  
  let processedLabels = [...labels]
  
  if (template.printSettings?.copiesPerLabel && template.printSettings.copiesPerLabel > 1) {
    const duplicated: LabelData[] = []
    for (const label of labels) {
      for (let i = 0; i < template.printSettings.copiesPerLabel; i++) {
        duplicated.push(label)
      }
    }
    processedLabels = duplicated
  }
  
  if (template.printSettings?.startFrom && template.printSettings.startFrom > 1) {
    const emptyCount = template.printSettings.startFrom - 1
    const emptyLabels = Array(emptyCount).fill({ productName: '', ownOrderNumber: '', requiredDate: '' })
    processedLabels = [...emptyLabels, ...processedLabels]
  }
  
  if (template.printSettings?.endAt && template.printSettings.endAt < processedLabels.length) {
    processedLabels = processedLabels.slice(0, template.printSettings.endAt)
  }
  
  if (template.printSettings?.skipEmptyLabels) {
    processedLabels = processedLabels.filter(label => 
      label.productName || label.ownOrderNumber || label.requiredDate
    )
  }
  
  const pages: LabelData[][] = []
  for (let i = 0; i < processedLabels.length; i += labelsPerPage) {
    pages.push(processedLabels.slice(i, i + labelsPerPage))
  }

  const cellSettings = template.cellSettings || {}
  const fontSettings = template.fontSettings || {}
  const paddingSettings = template.paddingSettings || {}
  
  const defaultPadding = cellSettings.padding || '2mm'
  const verticalGap = cellSettings.verticalGap || '0mm'
  const horizontalGap = cellSettings.horizontalGap || '0mm'
  
  const contentPaddingTop = paddingSettings.contentPaddingTop || '2mm'
  const contentPaddingRight = paddingSettings.contentPaddingRight || '2mm'
  const contentPaddingBottom = paddingSettings.contentPaddingBottom || '2mm'
  const contentPaddingLeft = paddingSettings.contentPaddingLeft || '2mm'
  
  let contentPaddingStyle = ''
  if (paddingSettings.contentPaddingTop || paddingSettings.contentPaddingRight || 
      paddingSettings.contentPaddingBottom || paddingSettings.contentPaddingLeft) {
    contentPaddingStyle = `padding: ${contentPaddingTop} ${contentPaddingRight} ${contentPaddingBottom} ${contentPaddingLeft} !important;`
  } else if (defaultPadding) {
    contentPaddingStyle = `padding: ${defaultPadding} !important;`
  }
  
  const cellStyleOverrides = `
    .label-cell {
      text-align: center !important;
      padding: ${verticalGap} ${horizontalGap} !important;
      border: none !important;
      border-color: transparent !important;
      ${cellSettings.width ? `width: ${cellSettings.width} !important;` : ''}
      ${cellSettings.height ? `height: ${cellSettings.height} !important;` : ''}
      ${cellSettings.fontSize ? `font-size: ${cellSettings.fontSize} !important;` : ''}
      ${fontSettings.fontFamily ? `font-family: ${fontSettings.fontFamily} !important;` : ''}
    }
    
    .label-content {
      ${contentPaddingStyle}
      border: none !important;
      background: white !important;
    }
    
    .label-product {
      ${fontSettings.productFontSize ? `font-size: ${fontSettings.productFontSize} !important;` : ''}
      ${fontSettings.productFontWeight ? `font-weight: ${fontSettings.productFontWeight} !important;` : ''}
      ${fontSettings.productColor ? `color: ${fontSettings.productColor} !important;` : ''}
    }
    
    .label-order {
      ${fontSettings.orderFontSize ? `font-size: ${fontSettings.orderFontSize} !important;` : ''}
      ${fontSettings.orderColor ? `color: ${fontSettings.orderColor} !important;` : ''}
    }
    
    .label-date {
      ${fontSettings.dateFontSize ? `font-size: ${fontSettings.dateFontSize} !important;` : ''}
      ${fontSettings.dateColor ? `color: ${fontSettings.dateColor} !important;` : ''}
    }
  `

  const pagesHTML = pages.map((pageLabels) => {
    const labelItems = pageLabels.map(label => {
      let labelHTML = template.html
      labelHTML = labelHTML.replace(/\{\{productName\}\}/g, escapeHtml(label.productName))
      labelHTML = labelHTML.replace(/\{\{ownOrderNumber\}\}/g, escapeHtml(label.ownOrderNumber))
      labelHTML = labelHTML.replace(/\{\{orderNumber\}\}/g, escapeHtml(label.orderNumber))
      labelHTML = labelHTML.replace(/\{\{requiredDate\}\}/g, escapeHtml(label.requiredDate))
      labelHTML = labelHTML.replace(/\{\{drawingNumber\}\}/g, escapeHtml(label.drawingNumber))
      labelHTML = labelHTML.replace(/\{\{piecesPerBox\}\}/g, escapeHtml(label.piecesPerBox))
      labelHTML = labelHTML.replace(/\{\{customerName\}\}/g, escapeHtml(label.customerName))
      labelHTML = labelHTML.replace(/\{\{orderNotes\}\}/g, escapeHtml(label.orderNotes))
      labelHTML = labelHTML.replace(/\{\{productNotes\}\}/g, escapeHtml(label.productNotes))
      labelHTML = labelHTML.replace(/\{\{boxesCount\}\}/g, escapeHtml(label.boxesCount))
      return labelHTML
    }).join('\n')

    return `<div class="page">${labelItems}</div>`
  }).join('')

  const pageMarginTop = template.margins?.top || '1'
  const pageMarginRight = template.margins?.right || '0'
  const pageMarginBottom = template.margins?.bottom || '0'
  const pageMarginLeft = template.margins?.left || '1'

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Címkék - ${new Date().toLocaleDateString('hu-HU')}</title>
  <style>
    @page {
      size: A4;
      margin: 0mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
    }

    ${template.css}

    ${cellStyleOverrides}
    
    .page {
      gap: 0 !important;
      padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm !important;
    }

    .no-print {
      text-align: center;
      padding: 20px;
      background: white;
      margin: 0 auto 20px;
      max-width: 210mm;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .print-button {
      padding: 12px 24px;
      font-size: 14pt;
      cursor: pointer;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
    }

    .print-button:hover {
      background: #0052a3;
    }

    @media print {
      .no-print {
        display: none;
      }
      
      body {
        margin: 0;
        padding: 0;
      }
      
      .page {
        margin: 0;
        padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm !important;
      }
    }

    @media screen {
      body {
        background: #f0f0f0;
        padding: 20px;
      }

      .page {
        background: white;
        margin: 20px auto;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="print-button">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
    <p style="margin-top: 10px; color: #666;">
      Összesen ${processedLabels.length} címke, ${pages.length} oldal
    </p>
  </div>

  ${pagesHTML}
</body>
</html>`
}

export function generateLabelHTML(labels: LabelData[]): string {
  const labelsPerPage = 40
  const labelsPerRow = 5
  const labelsPerColumn = 8
  
  const pages: LabelData[][] = []
  for (let i = 0; i < labels.length; i += labelsPerPage) {
    pages.push(labels.slice(i, i + labelsPerPage))
  }

  const pagesHTML = pages.map((pageLabels, pageIndex) => {
    const rows: string[] = []
    
    for (let row = 0; row < labelsPerColumn; row++) {
      const rowLabels: LabelData[] = []
      for (let col = 0; col < labelsPerRow; col++) {
        const index = row * labelsPerRow + col
        if (index < pageLabels.length) {
          rowLabels.push(pageLabels[index])
        } else {
          rowLabels.push({ 
            productName: '', 
            ownOrderNumber: '',
            orderNumber: '',
            requiredDate: '',
            drawingNumber: '',
            piecesPerBox: '',
            customerName: '',
            orderNotes: '',
            productNotes: '',
            boxesCount: ''
          })
        }
      }
      
      rows.push(`
        <tr>
          ${rowLabels.map(label => `
            <td class="label-cell">
              <div class="label-content">
                <div class="label-product">${escapeHtml(label.productName)}</div>
                ${label.drawingNumber ? `<div class="label-drawing">Rajzszám: ${escapeHtml(label.drawingNumber)}</div>` : ''}
                <div class="label-order">Saját rendelési szám: ${escapeHtml(label.ownOrderNumber)}</div>
                <div class="label-date">Határidő: ${escapeHtml(label.requiredDate)}</div>
                ${label.piecesPerBox ? `<div class="label-pieces">Doboz/db: ${escapeHtml(label.piecesPerBox)}</div>` : ''}
                ${label.boxesCount ? `<div class="label-boxes">Dobozok száma: ${escapeHtml(label.boxesCount)}</div>` : ''}
                ${label.orderNotes ? `<div class="label-notes">Megjegyzés (rendelés): ${escapeHtml(label.orderNotes)}</div>` : ''}
                ${label.productNotes ? `<div class="label-notes">Megjegyzés (termék): ${escapeHtml(label.productNotes)}</div>` : ''}
                <div class="label-from-to">
                  <span>From: MAGMA</span>
                  ${label.customerName ? `<span>To: ${escapeHtml(label.customerName)}</span>` : '<span>To: </span>'}
                </div>
              </div>
            </td>
          `).join('')}
        </tr>
      `)
    }

    return `
      <div class="page">
        <table class="label-table">
          <tbody>
            ${rows.join('')}
          </tbody>
        </table>
      </div>
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Címkék - ${new Date().toLocaleDateString('hu-HU')}</title>
  <style>
    @page {
      size: A4;
      margin: 0mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 8pt;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }

    .page {
      width: 210mm;
      height: 297mm;
      page-break-after: always;
      margin: 0;
      padding: 0;
      position: relative;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .label-table {
      width: 210mm;
      height: 297mm;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0;
      padding: 0;
    }

    .label-cell {
      width: 42mm;
      height: 37.125mm;
      border: none;
      padding: 2mm;
      vertical-align: top;
      text-align: center;
      overflow: hidden;
    }

    .label-content {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      height: 100%;
    }

    .label-product {
      font-weight: bold;
      font-size: 9pt;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .label-order {
      font-size: 7pt;
      color: #333;
    }

    .label-drawing {
      font-size: 7pt;
      color: #444;
      margin-top: 1mm;
    }

    .label-date {
      font-size: 7pt;
      color: #666;
    }

    .label-pieces {
      font-size: 7pt;
      color: #444;
    }

    .label-from-to {
      display: flex;
      justify-content: space-between;
      font-size: 6pt;
      color: #333;
      margin-top: auto;
      padding-top: 1mm;
      border-top: 1px solid #ddd;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      .page {
        margin: 0;
        padding: 0;
      }

      .no-print {
        display: none;
      }
    }

    @media screen {
      body {
        background: #f0f0f0;
        padding: 20px;
      }

      .page {
        background: white;
        margin: 20px auto;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    }

    .no-print {
      text-align: center;
      padding: 20px;
      background: white;
      margin: 0 auto 20px;
      max-width: 210mm;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .print-button {
      padding: 12px 24px;
      font-size: 14pt;
      cursor: pointer;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
    }

    .print-button:hover {
      background: #0052a3;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="print-button">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
    <p style="margin-top: 10px; color: #666;">
      Összesen ${labels.length} címke, ${pages.length} teljes oldal (40 címke/oldal, 52.5×29.7mm méret)
    </p>
  </div>

  ${pagesHTML}
</body>
</html>`
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return String(text || '').replace(/[&<>"']/g, (m) => map[m])
}

export function exportLabelTemplate(template: LabelTemplate) {
  const dataStr = JSON.stringify(template, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Sablon exportálva')
}

export function importLabelTemplate(file: File): Promise<LabelTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target?.result as string) as LabelTemplate
        
        if (!template.id || !template.name || !template.type || template.type !== 'label') {
          throw new Error('Érvénytelen címke sablon formátum')
        }
        
        template.id = `label-template-${Date.now()}`
        template.timestamp = new Date().toISOString()
        
        resolve(template)
        toast.success('Sablon importálva')
      } catch (error) {
        reject(new Error('Nem sikerült beolvasni a sablon fájlt'))
        toast.error('Érvénytelen sablon fájl')
      }
    }
    reader.onerror = () => {
      reject(new Error('Fájl olvasási hiba'))
      toast.error('Fájl olvasási hiba')
    }
    reader.readAsText(file)
  })
}

export function exportMultipleLabelTemplates(templates: LabelTemplate[]) {
  if (templates.length === 0) {
    toast.error('Nincs exportálandó sablon')
    return
  }

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    templatesCount: templates.length,
    templates: templates
  }

  const dataStr = JSON.stringify(exportData, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cimke_sablonok_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success(`${templates.length} sablon exportálva`)
}

export function importMultipleLabelTemplates(file: File): Promise<LabelTemplate[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        if (data.templates && Array.isArray(data.templates)) {
          const templates = data.templates.map((template: LabelTemplate) => ({
            ...template,
            id: `label-template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
          }))
          resolve(templates)
          toast.success(`${templates.length} sablon importálva`)
        } else if (data.type === 'label') {
          const template = {
            ...data,
            id: `label-template-${Date.now()}`,
            timestamp: new Date().toISOString()
          }
          resolve([template])
          toast.success('1 sablon importálva')
        } else {
          reject(new Error('Érvénytelen sablon fájl formátum'))
          toast.error('Érvénytelen sablon fájl formátum')
        }
      } catch (error) {
        reject(new Error('Érvénytelen sablon fájl'))
        toast.error('Érvénytelen sablon fájl')
      }
    }
    reader.onerror = () => {
      reject(new Error('Fájl olvasási hiba'))
      toast.error('Fájl olvasási hiba')
    }
    reader.readAsText(file)
  })
}

interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export function validateLabelTemplate(template: Partial<LabelTemplate>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!template.name || template.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'A sablon neve kötelező',
      severity: 'error'
    })
  }

  if (!template.html || template.html.trim().length === 0) {
    errors.push({
      field: 'html',
      message: 'A HTML sablon nem lehet üres',
      severity: 'error'
    })
  }

  if (!template.css || template.css.trim().length === 0) {
    errors.push({
      field: 'css',
      message: 'A CSS sablon nem lehet üres',
      severity: 'error'
    })
  }

  const requiredVariables = [
    'productName',
    'ownOrderNumber',
    'customerName'
  ]

  const optionalButRecommended = [
    'drawingNumber',
    'requiredDate',
    'piecesPerBox',
    'boxesCount'
  ]

  if (template.html) {
    requiredVariables.forEach(varName => {
      if (!template.html!.includes(`{{${varName}}}`)) {
        errors.push({
          field: 'html',
          message: `Hiányzó kötelező változó: {{${varName}}}`,
          severity: 'error'
        })
      }
    })

    optionalButRecommended.forEach(varName => {
      if (!template.html!.includes(`{{${varName}}}`)) {
        errors.push({
          field: 'html',
          message: `Ajánlott változó hiányzik: {{${varName}}}`,
          severity: 'warning'
        })
      }
    })
  }

  if (template.labelsPerPage && template.labelsPerPage <= 0) {
    errors.push({
      field: 'labelsPerPage',
      message: 'A címkék száma oldalanként pozitív szám kell legyen',
      severity: 'error'
    })
  }

  if (template.labelsPerRow && template.labelsPerRow <= 0) {
    errors.push({
      field: 'labelsPerRow',
      message: 'A címkék száma soronként pozitív szám kell legyen',
      severity: 'error'
    })
  }

  if (template.labelsPerColumn && template.labelsPerColumn <= 0) {
    errors.push({
      field: 'labelsPerColumn',
      message: 'A címkék száma oszloponként pozitív szám kell legyen',
      severity: 'error'
    })
  }

  if (template.labelsPerRow && template.labelsPerColumn) {
    const calculated = template.labelsPerRow * template.labelsPerColumn
    if (template.labelsPerPage && template.labelsPerPage !== calculated) {
      errors.push({
        field: 'labelsPerPage',
        message: `A címkék száma oldalanként (${template.labelsPerPage}) nem egyezik a számított értékkel (${template.labelsPerRow} × ${template.labelsPerColumn} = ${calculated})`,
        severity: 'warning'
      })
    }
  }

  return errors
}

export interface PrintSettings {
  copies: number
  printerName: string
  pageOrientation: 'portrait' | 'landscape'
  colorMode: 'color' | 'grayscale'
  paperSize: 'A4' | 'Letter'
  fitToPage: boolean
  showPrintDialog: boolean
}

export async function generateLabelsWithPrintSettings(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  customTemplate?: LabelTemplate,
  printSettings?: PrintSettings
) {
  const labels: LabelData[] = []
  
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('🖨️  CÍMKE GENERÁLÁS NYOMTATÁSI BEÁLLÍTÁSOKKAL')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Rendelések száma: ${orders.length}`)
  console.log(`Termékek száma az adatbázisban: ${products.length}`)
  console.log(`Példányszám: ${printSettings?.copies || 1}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  for (let orderIndex = 0; orderIndex < orders.length; orderIndex++) {
    const order = orders[orderIndex]
    const boxCount = order.boxesCount || 1
    const copies = printSettings?.copies || 1
    
    const product = products.find(p => {
      const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
      if (!customerMatch) return false
      
      const orderProductName = order.productName.trim().toLowerCase()
      const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
      const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
      
      return matchByDrawingNumber || matchByProductName
    })
    
    const customer = customers.find(c => c.name === order.customer)
    
    const labelData = {
      productName: product?.productName || order.designation || order.productName || '',
      ownOrderNumber: order.ownOrderNumber || '',
      orderNumber: order.orderNumber || '',
      requiredDate: order.requiredDate || '',
      drawingNumber: product?.drawingNumber || order.productName || '',
      piecesPerBox: product?.piecesPerBox || '',
      customerName: customer?.name || order.customer || '',
      orderNotes: order.notes || '',
      productNotes: product?.notes || '',
      boxesCount: order.boxesCount?.toString() || ''
    }
    
    for (let i = 0; i < boxCount * copies; i++) {
      labels.push(labelData)
    }
  }

  const targetLabelCount = Math.max(40, Math.ceil(labels.length / 40) * 40)
  
  while (labels.length < targetLabelCount) {
    labels.push({
      productName: '',
      ownOrderNumber: '',
      orderNumber: '',
      requiredDate: '',
      drawingNumber: '',
      piecesPerBox: '',
      customerName: '',
      orderNotes: '',
      productNotes: '',
      boxesCount: ''
    })
  }

  let templateToUse = customTemplate
  
  if (!templateToUse) {
    const firstOrder = orders[0]
    const customer = customers.find(c => c.name === firstOrder?.customer)
    
    if (customer?.labelTemplateId) {
      try {
        const labelTemplates = await spark.kv.get<LabelTemplate[]>('label-templates')
        templateToUse = labelTemplates?.find(t => t.id === customer.labelTemplateId)
      } catch (error) {
        console.warn('Nem sikerült betölteni a vevő címke sablonját', error)
      }
    }
  }

  const html = templateToUse 
    ? generateCustomLabelHTMLWithPrintSettings(labels, templateToUse, printSettings)
    : generateLabelHTMLWithPrintSettings(labels, printSettings)
  
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    
    if (printSettings?.showPrintDialog) {
      setTimeout(() => {
        win.print()
      }, 500)
    }
  }

  toast.success(`${labels.length} címke előkészítve nyomtatásra (${printSettings?.copies || 1} példány)`)
}

function generateLabelHTMLWithPrintSettings(labels: LabelData[], printSettings?: PrintSettings): string {
  const html = generateLabelHTML(labels)
  
  if (!printSettings) return html
  
  const printStyles = `
    <style>
      @media print {
        @page {
          size: ${printSettings.paperSize};
          margin: 0;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  `
  
  return html.replace('</head>', `${printStyles}</head>`)
}

function generateCustomLabelHTMLWithPrintSettings(labels: LabelData[], template: LabelTemplate, printSettings?: PrintSettings): string {
  const html = generateCustomLabelHTML(labels, template)
  
  if (!printSettings) return html
  
  const printStyles = `
    <style>
      @media print {
        @page {
          size: ${printSettings.paperSize};
          margin: 0;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  `
  
  return html.replace('</head>', `${printStyles}</head>`)
}

export async function generateLabelsByCustomer(
  orders: Order[],
  customers: Customer[],
  products: Product[]
) {
  const customerGroups = new Map<string, Order[]>()
  
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('📂 CÍMKE GENERÁLÁS VEVŐNKÉNT (KÜLÖN FÁJLOK)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Rendelések száma: ${orders.length}`)
  console.log(`Termékek száma: ${products.length}`)
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  for (const order of orders) {
    const customerName = order.customer
    if (!customerGroups.has(customerName)) {
      customerGroups.set(customerName, [])
    }
    customerGroups.get(customerName)!.push(order)
  }
  
  console.log(`📊 Vevők csoportosítva: ${customerGroups.size} vevő\n`)
  customerGroups.forEach((orders, customerName) => {
    console.log(`   ${customerName}: ${orders.length} rendelés`)
  })

  const labelTemplates = await spark.kv.get<LabelTemplate[]>('label-templates')
  let generatedCount = 0
  let customersWithTemplates = 0
  let customersWithoutTemplates = 0

  for (const [customerName, customerOrders] of customerGroups.entries()) {
    console.log(`\n┌─────────────────────────────────────────────────────────────┐`)
    console.log(`│ 🏢 VEVŐ: ${customerName}`)
    console.log(`│ Rendelések: ${customerOrders.length} db`)
    console.log(`└─────────────────────────────────────────────────────────────┘`)
    
    const customer = customers.find(c => c.name === customerName)
    let templateToUse: LabelTemplate | undefined = undefined

    if (customer?.labelTemplateId && labelTemplates) {
      templateToUse = labelTemplates.find(t => t.id === customer.labelTemplateId)
      if (templateToUse) {
        customersWithTemplates++
        console.log(`✅ Egyedi sablon: "${templateToUse.name}"`)
      } else {
        customersWithoutTemplates++
        console.log(`⚠️  Egyedi sablon nem található, alapértelmezett használata`)
      }
    } else {
      customersWithoutTemplates++
      console.log(`ℹ️  Nincs egyedi sablon, alapértelmezett használata`)
    }

    const labels: LabelData[] = []

    for (const order of customerOrders) {
      const boxCount = order.boxesCount || 1
      
      const product = products.find(p => {
        const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
        if (!customerMatch) return false
        
        const orderProductName = order.productName.trim().toLowerCase()
        const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
        const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
        
        return matchByDrawingNumber || matchByProductName
      })
      
      if (product) {
        console.log(`   ✓ ${order.ownOrderNumber}: ${product.drawingNumber} → ${boxCount} címke`)
      } else {
        console.log(`   ✗ ${order.ownOrderNumber}: Termék nem található → ${boxCount} címke`)
      }
      
      for (let i = 0; i < boxCount; i++) {
        labels.push({
          productName: product?.productName || order.designation || order.productName || '',
          ownOrderNumber: order.ownOrderNumber || '',
          orderNumber: order.orderNumber || '',
          requiredDate: order.requiredDate || '',
          drawingNumber: product?.drawingNumber || order.productName || '',
          piecesPerBox: product?.piecesPerBox || '',
          customerName: customer?.name || order.customer || '',
          orderNotes: order.notes || '',
          productNotes: product?.notes || '',
          boxesCount: order.boxesCount?.toString() || ''
        })
      }
    }

    const targetLabelCount = Math.max(40, Math.ceil(labels.length / 40) * 40)
    
    while (labels.length < targetLabelCount) {
      labels.push({
        productName: '',
        ownOrderNumber: '',
        orderNumber: '',
        requiredDate: '',
        drawingNumber: '',
        piecesPerBox: '',
        customerName: '',
        orderNotes: '',
        productNotes: '',
        boxesCount: ''
      })
    }
    
    console.log(`📄 Fájl létrehozása: ${labels.length} címke (${targetLabelCount / 40} oldal)`)

    const html = templateToUse 
      ? generateCustomLabelHTML(labels, templateToUse)
      : generateLabelHTML(labels)
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeCustomerName = customerName.replace(/[^a-z0-9]/gi, '_')
    link.download = `cimkek_${safeCustomerName}_${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    generatedCount += labels.length
  }

  const totalCustomers = customerGroups.size
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('✅ VEVŐNKÉNTI CÍMKE GENERÁLÁS BEFEJEZVE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Összes címke: ${generatedCount}`)
  console.log(`Vevők száma: ${totalCustomers}`)
  console.log(`Egyedi sablonnal: ${customersWithTemplates}`)
  console.log(`Alapértelmezett sablonnal: ${customersWithoutTemplates}`)
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  toast.success(
    `${generatedCount} címke generálva ${totalCustomers} vevőhöz vevőnként külön fájlban. ` +
    `${customersWithTemplates} vevőnél egyedi sablon, ${customersWithoutTemplates} vevőnél alapértelmezett.`,
    { duration: 6000 }
  )
}

