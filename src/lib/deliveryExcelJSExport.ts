import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { toast } from 'sonner'

export async function generateDeliveryWithExcelJS(
  orders: Order[],
  customers: Customer[],
  products: Product[],
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
  
  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'delivery')
  const fileName = `${sequenceNumber}_${safeCustomerName}.xlsx`

  try {
    console.log('=== Szállítólevél Export ExcelJS módszerrel ===')
    console.log('Sablon forrás: src/lib/deliveryExcelJSExport.ts (ExcelJS programozott generálás)')
    console.log('Rendelések száma:', orders.length)
    console.log('Szekvencia szám:', sequenceNumber)
    console.log('Fájlnév:', fileName)

    const customerInfo = customers.find(c => c.name === firstCustomer)
    
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Szállítólevél')

    worksheet.getCell('A1').value = 'SZÁLLÍTÓLEVÉL'
    worksheet.getCell('A1').font = { bold: true, size: 18 }
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.mergeCells('A1:K1')

    worksheet.getCell('K2').value = `Szám: ${sequenceNumber}`
    worksheet.getCell('K2').font = { bold: true, size: 12 }
    worksheet.getCell('K2').alignment = { horizontal: 'right', vertical: 'middle' }

    worksheet.getCell('A3').value = 'Feladó:'
    worksheet.getCell('A3').font = { bold: true, size: 12 }
    worksheet.getCell('A4').value = 'Magma Kft'
    worksheet.getCell('A5').value = 'H-1211 Budapest, Déli utca 13.'
    worksheet.getCell('A6').value = 'Adószám: HU10368152-2-43'

    worksheet.getCell('A8').value = 'Címzett:'
    worksheet.getCell('A8').font = { bold: true, size: 12 }
    worksheet.getCell('A9').value = firstCustomer
    worksheet.getCell('A9').font = { bold: true, size: 11 }
    
    const fullAddress = customerInfo?.fullAddress || 
      `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')
    worksheet.getCell('A10').value = fullAddress
    if (customerInfo?.taxNumber) {
      worksheet.getCell('A11').value = `Adószám: ${customerInfo.taxNumber}`
    }

    const startRow = 13
    const headers = [
      'Saját rendelési szám',
      'Vevő rendelési száma',
      'Termék rajzszáma',
      'Termék név',
      'Megnevezés',
      'Cikkszám',
      'Anyag',
      'Felületkezelés',
      'Mennyiség (db)',
      'Dobozok száma',
      'Raklapok száma',
      'Bruttó súly (kg)',
      'Megjegyzés'
    ]
    
    const headerRow = worksheet.getRow(startRow)
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1)
      cell.value = header
      cell.font = { bold: true, size: 10 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      }
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
    headerRow.height = 30

    let currentRow = startRow + 1
    orders.forEach(order => {
      const product = products.find(p => 
        p.customer === order.customer && 
        (p.productName === order.productName || p.drawingNumber === order.productName)
      )

      const row = worksheet.getRow(currentRow)
      row.getCell(1).value = order.ownOrderNumber || ''
      row.getCell(2).value = order.orderNumber || ''
      row.getCell(3).value = product?.drawingNumber || ''
      row.getCell(4).value = order.productName || ''
      row.getCell(5).value = order.designation || ''
      row.getCell(6).value = product?.articleNumber || ''
      row.getCell(7).value = order.material || ''
      row.getCell(8).value = order.surfaceTreatment || ''
      row.getCell(9).value = order.amountPc || 0
      row.getCell(10).value = order.boxesCount || 0
      row.getCell(11).value = order.palletsCount || 0
      row.getCell(12).value = order.grossWeightKg || ''
      row.getCell(13).value = order.notes || ''

      row.alignment = { horizontal: 'left', vertical: 'middle' }
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })

      currentRow++
    })

    const summaryRow = currentRow + 1
    worksheet.getCell(`A${summaryRow}`).value = 'Összesen:'
    worksheet.getCell(`A${summaryRow}`).font = { bold: true }
    
    const totalAmount = orders.reduce((sum, order) => sum + (order.amountPc || 0), 0)
    const totalBoxes = orders.reduce((sum, order) => sum + (order.boxesCount || 0), 0)
    const totalPallets = orders.reduce((sum, order) => sum + (order.palletsCount || 0), 0)
    
    worksheet.getCell(`I${summaryRow}`).value = totalAmount
    worksheet.getCell(`I${summaryRow}`).font = { bold: true }
    worksheet.getCell(`J${summaryRow}`).value = totalBoxes
    worksheet.getCell(`J${summaryRow}`).font = { bold: true }
    worksheet.getCell(`K${summaryRow}`).value = totalPallets
    worksheet.getCell(`K${summaryRow}`).font = { bold: true }

    worksheet.columns = [
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 20 },
      { width: 25 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 25 },
    ]

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

    const exportData = orders.map(order => {
      const product = products.find(p => 
        p.customer === order.customer && 
        (p.productName === order.productName || p.drawingNumber === order.productName)
      )

      return {
        'Szállítólevél száma': sequenceNumber,
        'Vevő': order.customer || '',
        'Vevő cím': fullAddress,
        'Város': customerInfo?.city || '',
        'Ország': customerInfo?.country || '',
        'Saját rendelési szám': order.ownOrderNumber || '',
        'Vevő rendelési száma': order.orderNumber || '',
        'Termék rajzszáma': product?.drawingNumber || '',
        'Termék név': order.productName || '',
        'Megnevezés': order.designation || '',
        'Cikkszám': product?.articleNumber || '',
        'Anyag': order.material || '',
        'Felületkezelés': order.surfaceTreatment || '',
        'Mennyiség (db)': order.amountPc || 0,
        'Dobozok száma': order.boxesCount || 0,
        'Raklapok száma': order.palletsCount || 0,
        'Bruttó súly': order.grossWeightKg || '',
        'Megjegyzés': order.notes || ''
      }
    })

    if (onExportSaved) {
      const exportDate = new Date().toISOString().split('T')[0]
      onExportSaved({
        type: 'delivery',
        customer: firstCustomer,
        orderIds: orders.map(o => o.id),
        fileName,
        exportDate,
        exportData,
      }, sequenceNumber)
    }
    
    toast.success(`Szállítólevél export sikeres! Fájl: ${fileName}`, { duration: 8000 })
    toast.info(`Sablon forrás: src/lib/deliveryExcelJSExport.ts (ExcelJS generálás)`, { duration: 8000 })
  } catch (error) {
    console.error('Szállítólevél export hiba:', error)
    toast.error('Szállítólevél export sikertelen: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'))
  }
}
