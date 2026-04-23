import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { toast } from 'sonner'

interface CellConfig {
  id: string
  cell: string
  value: string
  type: 'static' | 'variable' | 'formula' | 'header'
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  alignment?: 'left' | 'center' | 'right'
  verticalAlignment?: 'top' | 'middle' | 'bottom'
  backgroundColor?: string
  textColor?: string
  border?: boolean
  wrapText?: boolean
  merge?: string
}

interface ColumnConfig {
  index: number
  width: number
}

interface ExcelJSTemplate {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  description: string
  sheetName: string
  cells: CellConfig[]
  columns: ColumnConfig[]
  rowHeights: Record<number, number>
  createdAt: string
  updatedAt: string
}

export async function exportOrdersWithExcelJSTemplate(
  template: ExcelJSTemplate,
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  cmrSettings?: any,
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void
) {
  if (!orders.length) {
    toast.error('Nincsenek exportálandó rendelések')
    return
  }

  const firstCustomer = orders[0]?.customer || 'export'
  const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
  const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
  
  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, template.type)
  const fileName = `${sequenceNumber}_${safeCustomerName}.xlsx`

  try {
    const customerInfo = customers.find(c => c.name === firstCustomer)
    
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(template.sheetName)

    const variableData = buildVariableData(
      orders,
      customerInfo,
      products,
      sequenceNumber,
      template.type,
      cmrSettings
    )

    template.cells.forEach(cellConfig => {
      const cell = worksheet.getCell(cellConfig.cell)
      
      let cellValue = cellConfig.value
      if (cellConfig.type === 'variable') {
        cellValue = replaceVariables(cellConfig.value, variableData)
      }
      
      cell.value = cellValue

      if (cellConfig.merge) {
        try {
          worksheet.mergeCells(`${cellConfig.cell}:${cellConfig.merge}`)
        } catch (error) {
          console.warn('Merge cells error:', error)
        }
      }

      cell.font = {
        bold: cellConfig.bold,
        italic: cellConfig.italic,
        underline: cellConfig.underline,
        size: cellConfig.fontSize || 11,
        color: cellConfig.textColor ? { argb: cellConfig.textColor } : undefined
      }

      cell.alignment = {
        horizontal: cellConfig.alignment || 'left',
        vertical: cellConfig.verticalAlignment || 'middle',
        wrapText: cellConfig.wrapText
      }

      if (cellConfig.backgroundColor) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: cellConfig.backgroundColor }
        }
      }

      if (cellConfig.border) {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      }
    })

    template.columns.forEach(col => {
      worksheet.getColumn(col.index).width = col.width
    })

    Object.entries(template.rowHeights).forEach(([rowNum, height]) => {
      worksheet.getRow(parseInt(rowNum)).height = height
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    if (onExportSaved) {
      const deliveryNote: Partial<DeliveryNote> = {
        type: template.type,
        sequenceNumber,
        customer: firstCustomer,
        orderIds: orders.map(o => o.id),
        fileName,
        exportDate: new Date().toISOString(),
        exportData: orders.map(o => ({
          orderNumber: o.orderNumber,
          productName: o.productName,
          amountPc: o.amountPc
        }))
      }
      onExportSaved(deliveryNote, sequenceNumber)
    }

    toast.success(`${template.type === 'delivery' ? 'Szállítólevél' : 'CMR'} sikeresen exportálva: ${fileName}`)
  } catch (error) {
    console.error('ExcelJS template export error:', error)
    toast.error('Export hiba: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'))
  }
}

function buildVariableData(
  orders: Order[],
  customer: Customer | undefined,
  products: Product[],
  sequenceNumber: string,
  type: 'delivery' | 'cmr',
  cmrSettings?: any
): Record<string, string> {
  const currentDate = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const fullAddress = customer?.fullAddress || 
    `${customer?.street || ''}, ${customer?.city || ''}, ${customer?.postalCode || ''}, ${customer?.country || ''}`
      .replace(/,\s*,/g, ',')
      .replace(/^,\s*|,\s*$/g, '')

  const data: Record<string, string> = {
    sequenceNumber,
    customerName: customer?.name || orders[0]?.customer || '',
    customerAddress: fullAddress,
    customerCity: customer?.city || '',
    customerCountry: customer?.country || '',
    customerTaxNumber: customer?.taxNumber || '',
    senderName: 'Magma Kft',
    senderAddress: 'H-1211 Budapest, Déli utca 13.',
    currentDate
  }

  if (orders.length > 0) {
    const firstOrder = orders[0]
    const product = products.find(p => 
      p.customer === firstOrder.customer && 
      (p.productName === firstOrder.productName || p.drawingNumber === firstOrder.productName)
    )

    data.productName = firstOrder.productName
    data.designation = firstOrder.designation
    data.amountPc = String(firstOrder.amountPc)
    data.boxesCount = String(firstOrder.boxesCount || '')
    data.palletsCount = String(firstOrder.palletsCount || '')
    data.grossWeight = firstOrder.grossWeightKg || ''
    data.material = firstOrder.material || product?.material || ''
    data.surfaceTreatment = firstOrder.surfaceTreatment || product?.surfaceTreatment || ''
  }

  if (type === 'cmr' && cmrSettings) {
    data.senderName = cmrSettings.senderName || 'Magma Kft'
    data.senderAddress = cmrSettings.senderAddress || 'H-1211 Budapest, Déli utca 13.'
    data.senderCity = cmrSettings.senderCity || 'Budapest'
    data.senderCountry = cmrSettings.senderCountry || 'Magyarország'
    data.senderTaxNumber = cmrSettings.senderTaxNumber || 'HU10368152-2-43'
    data.senderPhone = cmrSettings.senderPhone || ''
    data.senderEmail = cmrSettings.senderEmail || ''
    data.placeOfTakingOver = cmrSettings.placeOfTakingOver || 'Budapest, Hungary'
    data.placeIssued = cmrSettings.placeIssued || 'Budapest'
    data.carrierName = cmrSettings.carrierName || ''
    data.carrierAddress = cmrSettings.carrierAddress || ''
    data.vehiclePlate = cmrSettings.vehiclePlate || ''
  }

  return data
}

function replaceVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match
  })
}
