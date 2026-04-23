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
}

function generateLabelsData(
  orders: Order[],
  customers: Customer[],
  products: Product[]
): LabelData[] {
  const labels: LabelData[] = []

  for (const order of orders) {
    const boxCount = order.boxesCount || 1
    
    const product = products.find(p => {
      const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
      if (!customerMatch) return false
      
      const orderProductName = order.productName.trim().toLowerCase()
      const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
      const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
      
      return matchByDrawingNumber || matchByProductName
    })
    
    const customer = customers.find(c => c.name === order.customer)
    
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

  return labels
}

export async function exportLabelsAsPDF(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  customTemplate?: LabelTemplate
) {
  const labels = generateLabelsData(orders, customers, products)
  
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

  const { generateCustomLabelHTML, generateLabelHTML } = await import('./labelTemplate')
  
  const html = templateToUse 
    ? generateCustomLabelHTML(labels, templateToUse as any)
    : generateLabelHTML(labels)

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
      toast.success(`${labels.length} címke PDF mentésre előkészítve`, { duration: 4000 })
    }, 500)
  } else {
    toast.error('Nem sikerült megnyitni az ablakot a nyomtatáshoz')
  }
}

export async function exportLabelsAsPNG(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  customTemplate?: LabelTemplate
) {
  const labels = generateLabelsData(orders, customers, products)
  
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

  const { generateCustomLabelHTML, generateLabelHTML } = await import('./labelTemplate')
  
  const html = templateToUse 
    ? generateCustomLabelHTML(labels, templateToUse as any)
    : generateLabelHTML(labels)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.left = '-9999px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  document.body.appendChild(iframe)
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    toast.error('Nem sikerült létrehozni a PNG exportot')
    document.body.removeChild(iframe)
    return
  }
  
  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  toast.info('PNG export előkészítése...', { duration: 2000 })

  setTimeout(async () => {
    try {
      const pages = iframeDoc.querySelectorAll('.page')
      const numPages = pages.length

      for (let i = 0; i < numPages; i++) {
        const page = pages[i] as HTMLElement
        
        const canvas = document.createElement('canvas')
        const scale = 2
        canvas.width = 210 * 3.7795275591 * scale
        canvas.height = 297 * 3.7795275591 * scale
        
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        ctx.scale(scale, scale)
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const svgData = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${210 * 3.7795275591}" height="${297 * 3.7795275591}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml">
                ${page.outerHTML}
              </div>
            </foreignObject>
          </svg>
        `
        
        const img = new Image()
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(svgBlob)
        
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = `cimkek_oldal_${i + 1}_${new Date().toISOString().split('T')[0]}.png`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }
          }, 'image/png')
          
          URL.revokeObjectURL(url)
        }
        
        img.src = url
        
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      toast.success(`${numPages} oldal PNG formátumban exportálva`)
      document.body.removeChild(iframe)
    } catch (error) {
      console.error('PNG export hiba:', error)
      toast.error('Hiba történt a PNG export során')
      document.body.removeChild(iframe)
    }
  }, 1000)
}

export function exportLabelsAsCSV(
  orders: Order[],
  customers: Customer[],
  products: Product[]
) {
  const csvRows: string[] = []
  
  csvRows.push([
    'Termék neve',
    'Rajzszám',
    'Saját rendelési szám',
    'Vevő rendelési szám',
    'Határidő',
    'Doboz/db',
    'Dobozok száma',
    'Vevő',
    'Rendelés megjegyzés',
    'Termék megjegyzés'
  ].join(';'))

  for (const order of orders) {
    const boxCount = order.boxesCount || 1
    
    const product = products.find(p => {
      const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
      if (!customerMatch) return false
      
      const orderProductName = order.productName.trim().toLowerCase()
      const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
      const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
      
      return matchByDrawingNumber || matchByProductName
    })
    
    const customer = customers.find(c => c.name === order.customer)
    
    for (let i = 0; i < boxCount; i++) {
      const row = [
        escapeCSV(product?.productName || order.designation || order.productName || ''),
        escapeCSV(product?.drawingNumber || order.productName || ''),
        escapeCSV(order.ownOrderNumber || ''),
        escapeCSV(order.orderNumber || ''),
        escapeCSV(order.requiredDate || ''),
        escapeCSV(product?.piecesPerBox || ''),
        escapeCSV(order.boxesCount?.toString() || ''),
        escapeCSV(customer?.name || order.customer || ''),
        escapeCSV(order.notes || ''),
        escapeCSV(product?.notes || '')
      ].join(';')
      
      csvRows.push(row)
    }
  }

  const csvContent = '\ufeff' + csvRows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cimkek_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`${csvRows.length - 1} címke exportálva CSV formátumban`)
}

function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function exportLabelsAsExcel(
  orders: Order[],
  customers: Customer[],
  products: Product[]
) {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Címkék')

    worksheet.columns = [
      { header: 'Termék neve', key: 'productName', width: 30 },
      { header: 'Rajzszám', key: 'drawingNumber', width: 20 },
      { header: 'Saját rendelési szám', key: 'ownOrderNumber', width: 20 },
      { header: 'Vevő rendelési szám', key: 'orderNumber', width: 20 },
      { header: 'Határidő', key: 'requiredDate', width: 15 },
      { header: 'Doboz/db', key: 'piecesPerBox', width: 12 },
      { header: 'Dobozok száma', key: 'boxesCount', width: 15 },
      { header: 'Vevő', key: 'customerName', width: 25 },
      { header: 'Rendelés megjegyzés', key: 'orderNotes', width: 30 },
      { header: 'Termék megjegyzés', key: 'productNotes', width: 30 }
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, size: 12 }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 20

    for (const order of orders) {
      const boxCount = order.boxesCount || 1
      
      const product = products.find(p => {
        const customerMatch = p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()
        if (!customerMatch) return false
        
        const orderProductName = order.productName.trim().toLowerCase()
        const matchByDrawingNumber = p.drawingNumber.trim().toLowerCase() === orderProductName
        const matchByProductName = p.productName.trim().toLowerCase() === orderProductName
        
        return matchByDrawingNumber || matchByProductName
      })
      
      const customer = customers.find(c => c.name === order.customer)
      
      for (let i = 0; i < boxCount; i++) {
        worksheet.addRow({
          productName: product?.productName || order.designation || order.productName || '',
          drawingNumber: product?.drawingNumber || order.productName || '',
          ownOrderNumber: order.ownOrderNumber || '',
          orderNumber: order.orderNumber || '',
          requiredDate: order.requiredDate || '',
          piecesPerBox: product?.piecesPerBox || '',
          boxesCount: order.boxesCount?.toString() || '',
          customerName: customer?.name || order.customer || '',
          orderNotes: order.notes || '',
          productNotes: product?.notes || ''
        })
      }
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'middle', horizontal: 'left' }
        row.height = 18
      }
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cimkek_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    const totalLabels = orders.reduce((sum, order) => sum + (order.boxesCount || 1), 0)
    toast.success(`${totalLabels} címke exportálva Excel formátumban`)
  } catch (error) {
    console.error('Excel export hiba:', error)
    toast.error('Hiba történt az Excel export során')
  }
}
