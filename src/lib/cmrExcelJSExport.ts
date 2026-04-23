import { Order, Customer, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { toast } from 'sonner'

export async function generateCmrWithExcelJS(
  orders: Order[],
  customers: Customer[],
  deliveryNotes: DeliveryNote[],
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void
) {
  if (!orders.length) {
    toast.error('Nincsenek exportálandó rendelések')
    return
  }

  const firstCustomer = orders[0]?.customer || 'export'
  const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
  const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
  
  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'cmr')
  const fileName = `${sequenceNumber}_${safeCustomerName}.xlsx`

  try {
    const response = await fetch('/templates/Cmr.xltx')
    if (!response.ok) {
      throw new Error(`CMR sablon nem található: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('A CMR sablon nem tartalmaz munkalapot')
    }

    const customerInfo = customers.find(c => c.name === firstCustomer)
    const fullAddress = customerInfo?.fullAddress || 
      `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')

    worksheet.getCell('K1').value = sequenceNumber
    worksheet.getCell('A6').value = firstCustomer
    worksheet.getCell('A7').value = fullAddress
    worksheet.getCell('B12').value = customerInfo?.city || ''
    worksheet.getCell('B13').value = customerInfo?.country || ''

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

    const exportData = orders.map(order => ({
      'Szállítólevél száma': sequenceNumber,
      'Vevő': order.customer || '',
      'Vevő cím': fullAddress,
      'Város': customerInfo?.city || '',
      'Ország': customerInfo?.country || '',
      'Termék név': order.productName || '',
      'Megnevezés': order.designation || '',
      'Mennyiség (db)': order.amountPc || 0,
      'Dobozok száma': order.boxesCount || 0,
      'Raklapok száma': order.palletsCount || 0,
      'Bruttó súly': order.grossWeightKg || '',
    }))

    if (onExportSaved) {
      const exportDate = new Date().toISOString().split('T')[0]
      onExportSaved({
        type: 'cmr',
        customer: firstCustomer,
        orderIds: orders.map(o => o.id),
        fileName,
        exportDate,
        exportData,
      }, sequenceNumber)
    }
    
    toast.success(`CMR sikeresen létrehozva - ${sequenceNumber}`, { 
      description: 'A fájl letöltése megkezdődött',
      duration: 3000 
    })
  } catch (error) {
    console.error('CMR export hiba:', error)
    toast.error('CMR export sikertelen: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'))
  }
}
