import * as ExcelJS from 'exceljs'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { toast } from 'sonner'

const DEFAULT_CMR_SETTINGS: CmrLayoutSettings = {
  senderName: 'Magma Kft',
  senderAddress: 'H-1211 Budapest, Déli utca 13.',
  senderTaxNumber: 'HU10368152-2-43',
  placeOfTakingOver: 'Budapest, Hungary',
  placeIssued: 'Budapest',
  templateExtension: 'xltx',
  senderCity: 'Budapest',
  senderCountry: 'Magyarország',
  senderPhone: '',
  senderEmail: '',
  carrierName: '',
  carrierAddress: '',
  vehiclePlate: '',
}

export async function generateCmrDirectExport(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void,
  userSettings?: CmrLayoutSettings
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
    const effectiveSettings = { ...DEFAULT_CMR_SETTINGS, ...userSettings }
    const customerInfo = customers.find(c => c.name === firstCustomer)
    
    const fullAddress = customerInfo?.fullAddress || 
      `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')

    console.log('=== CMR Export ExcelJS módszerrel ===')
    console.log('Sablon forrás: src/lib/cmrDirectExport.ts (ExcelJS programozott generálás)')
    console.log('Rendelések száma:', orders.length)
    console.log('Szekvencia szám:', sequenceNumber)
    console.log('Fájlnév:', fileName)

    const workbook = new ExcelJS.Workbook()
    const worksheet13 = workbook.addWorksheet('CMR')

    worksheet13.getCell(1, 11).value = sequenceNumber
    worksheet13.getCell(1, 11).font = { bold: true, size: 10, name: "Arial" }
    worksheet13.getCell(1, 11).alignment = { horizontal: "center", vertical: "middle" }
    
    const senderText = {
      richText: [
        { text: "1. Feladó (Név, cím, ország), Sender (Name, Address, Country)\n" },
        { font: { bold: true, size: 10, name: "Arial" }, text: `${effectiveSettings.senderName}\n${effectiveSettings.senderAddress}\n${effectiveSettings.senderTaxNumber}` }
      ]
    }
    
    worksheet13.getCell(2, 1).value = senderText
    worksheet13.getCell(2, 1).font = { size: 10, name: "Arial" }
    worksheet13.getCell(2, 1).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(2, 2).value = senderText
    worksheet13.getCell(2, 2).font = { size: 10, name: "Arial" }
    worksheet13.getCell(2, 2).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(2, 3).value = senderText
    worksheet13.getCell(2, 3).font = { size: 10, name: "Arial" }
    worksheet13.getCell(2, 3).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(2, 4).value = senderText
    worksheet13.getCell(2, 4).font = { size: 10, name: "Arial" }
    worksheet13.getCell(2, 4).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(2, 5).value = senderText
    worksheet13.getCell(2, 5).font = { size: 10, name: "Arial" }
    worksheet13.getCell(2, 5).alignment = { horizontal: "center", vertical: "top" }
    
    worksheet13.getCell(2, 6).value = "NEMZETKÖZI FUVARLEVÉL"
    worksheet13.getCell(2, 6).font = { size: 11, name: "Arial" }
    worksheet13.getCell(2, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(2, 7).value = "NEMZETKÖZI FUVARLEVÉL"
    worksheet13.getCell(2, 7).font = { size: 11, name: "Arial" }
    worksheet13.getCell(2, 7).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(2, 8).value = "NEMZETKÖZI FUVARLEVÉL"
    worksheet13.getCell(2, 8).font = { size: 11, name: "Arial" }
    worksheet13.getCell(2, 8).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(2, 9).value = "NEMZETKÖZI FUVARLEVÉL"
    worksheet13.getCell(2, 9).font = { size: 11, name: "Arial" }
    worksheet13.getCell(2, 9).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(2, 10).value = "NEMZETKÖZI FUVARLEVÉL"
    worksheet13.getCell(2, 10).font = { size: 11, name: "Arial" }
    worksheet13.getCell(2, 10).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(2, 11).value = "NEMZETKÖZI FUVARLEVÉL"
    worksheet13.getCell(2, 11).font = { size: 11, name: "Arial" }
    worksheet13.getCell(2, 11).alignment = { horizontal: "left", vertical: "top" }
    
    worksheet13.getCell(3, 1).value = senderText
    worksheet13.getCell(3, 1).font = { size: 10, name: "Arial" }
    worksheet13.getCell(3, 1).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(3, 2).value = senderText
    worksheet13.getCell(3, 2).font = { size: 10, name: "Arial" }
    worksheet13.getCell(3, 2).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(3, 3).value = senderText
    worksheet13.getCell(3, 3).font = { size: 10, name: "Arial" }
    worksheet13.getCell(3, 3).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(3, 4).value = senderText
    worksheet13.getCell(3, 4).font = { size: 10, name: "Arial" }
    worksheet13.getCell(3, 4).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(3, 5).value = senderText
    worksheet13.getCell(3, 5).font = { size: 10, name: "Arial" }
    worksheet13.getCell(3, 5).alignment = { horizontal: "center", vertical: "top" }
    
    const intConsignText = { richText: [{ font: { size: 11, name: "Arial" }, text: "INTERNATIONAL CONSIGNMENT NOTE" }] }
    worksheet13.getCell(3, 6).value = intConsignText
    worksheet13.getCell(3, 6).font = { size: 11, name: "Arial" }
    worksheet13.getCell(3, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(3, 7).value = intConsignText
    worksheet13.getCell(3, 7).font = { size: 11, name: "Arial" }
    worksheet13.getCell(3, 7).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(3, 8).value = intConsignText
    worksheet13.getCell(3, 8).font = { size: 11, name: "Arial" }
    worksheet13.getCell(3, 8).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(3, 9).value = intConsignText
    worksheet13.getCell(3, 9).font = { size: 11, name: "Arial" }
    worksheet13.getCell(3, 9).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(3, 10).value = intConsignText
    worksheet13.getCell(3, 10).font = { size: 11, name: "Arial" }
    worksheet13.getCell(3, 10).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(3, 11).value = intConsignText
    worksheet13.getCell(3, 11).font = { size: 11, name: "Arial" }
    worksheet13.getCell(3, 11).alignment = { horizontal: "left", vertical: "top" }
    
    worksheet13.getCell(4, 1).value = senderText
    worksheet13.getCell(4, 1).font = { size: 10, name: "Arial" }
    worksheet13.getCell(4, 1).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(4, 2).value = senderText
    worksheet13.getCell(4, 2).font = { size: 10, name: "Arial" }
    worksheet13.getCell(4, 2).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(4, 3).value = senderText
    worksheet13.getCell(4, 3).font = { size: 10, name: "Arial" }
    worksheet13.getCell(4, 3).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(4, 4).value = senderText
    worksheet13.getCell(4, 4).font = { size: 10, name: "Arial" }
    worksheet13.getCell(4, 4).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(4, 5).value = senderText
    worksheet13.getCell(4, 5).font = { size: 10, name: "Arial" }
    worksheet13.getCell(4, 5).alignment = { horizontal: "center", vertical: "top" }
    
    const cmrClause = "This carriage is subject, nothwith- standing any clause to the contrary to the Convention on the Contract for the international Carriage of goods by road (CMR)."
    worksheet13.getCell(4, 6).value = cmrClause
    worksheet13.getCell(4, 6).font = { size: 7, name: "Arial" }
    worksheet13.getCell(4, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(4, 7).value = cmrClause
    worksheet13.getCell(4, 7).font = { size: 7, name: "Arial" }
    worksheet13.getCell(4, 7).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(4, 8).value = cmrClause
    worksheet13.getCell(4, 8).font = { size: 7, name: "Arial" }
    worksheet13.getCell(4, 8).alignment = { horizontal: "left", vertical: "top" }
    
    const cmrClauseHu = "A fuvarozásra elétrő megállapodás esetén is a nemzetközi árufuvarozási egyezmény CMR rendelkezései az irányagók "
    worksheet13.getCell(4, 9).value = cmrClauseHu
    worksheet13.getCell(4, 9).font = { size: 7, name: "Arial" }
    worksheet13.getCell(4, 9).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(4, 10).value = cmrClauseHu
    worksheet13.getCell(4, 10).font = { size: 7, name: "Arial" }
    worksheet13.getCell(4, 10).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(4, 11).value = cmrClauseHu
    worksheet13.getCell(4, 11).font = { size: 7, name: "Arial" }
    worksheet13.getCell(4, 11).alignment = { horizontal: "left", vertical: "top" }
    
    worksheet13.getCell(5, 1).value = "2. Átvevő (Név, cím, ország) Consignee (Name, Address, Country)      "
    worksheet13.getCell(5, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(5, 1).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(5, 2).value = "2. Átvevő (Név, cím, ország) Consignee (Name, Address, Country)      "
    worksheet13.getCell(5, 2).font = { size: 8, name: "Arial" }
    worksheet13.getCell(5, 2).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(5, 3).value = "2. Átvevő (Név, cím, ország) Consignee (Name, Address, Country)      "
    worksheet13.getCell(5, 3).font = { size: 8, name: "Arial" }
    worksheet13.getCell(5, 3).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(5, 4).value = "2. Átvevő (Név, cím, ország) Consignee (Name, Address, Country)      "
    worksheet13.getCell(5, 4).font = { size: 8, name: "Arial" }
    worksheet13.getCell(5, 4).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(5, 5).value = "2. Átvevő (Név, cím, ország) Consignee (Name, Address, Country)      "
    worksheet13.getCell(5, 5).font = { size: 8, name: "Arial" }
    worksheet13.getCell(5, 5).alignment = { horizontal: "left", vertical: "top" }
    
    const carrierLabel = "16. Carrier (Name, Address, Country) Fuvarozó (Név, cím, ország)"
    for (let i = 6; i <= 11; i++) {
      worksheet13.getCell(5, i).value = carrierLabel
      worksheet13.getCell(5, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(5, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    for (let i = 6; i <= 11; i++) {
      worksheet13.getCell(6, i).value = carrierLabel
      worksheet13.getCell(6, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(6, i).alignment = { horizontal: "left", vertical: "top" }
      worksheet13.getCell(7, i).value = carrierLabel
      worksheet13.getCell(7, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(7, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    worksheet13.getCell(8, 1).value = "3. Az áru átvételének helye és iőpontja.                                                     Place of delivery of the goods"
    worksheet13.getCell(8, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(8, 1).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(8, 2).value = "3. Az áru átvételének helye és iőpontja.                                                     Place of delivery of the goods"
    worksheet13.getCell(8, 2).font = { size: 8, name: "Arial" }
    worksheet13.getCell(8, 2).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(8, 3).value = "3. Az áru átvételének helye és iőpontja.                                                     Place of delivery of the goods"
    worksheet13.getCell(8, 3).font = { size: 8, name: "Arial" }
    worksheet13.getCell(8, 3).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(8, 4).value = "3. Az áru átvételének helye és iőpontja.                                                     Place of delivery of the goods"
    worksheet13.getCell(8, 4).font = { size: 8, name: "Arial" }
    worksheet13.getCell(8, 4).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(8, 5).value = "3. Az áru átvételének helye és iőpontja.                                                     Place of delivery of the goods"
    worksheet13.getCell(8, 5).font = { size: 8, name: "Arial" }
    worksheet13.getCell(8, 5).alignment = { horizontal: "left", vertical: "top" }
    
    const successiveCarrier = "17  Successive carriers (Name, Address, Country) További fuvarozó (Név, cím, ország)"
    for (let i = 6; i <= 11; i++) {
      for (let row = 8; row <= 11; row++) {
        worksheet13.getCell(row, i).value = successiveCarrier
        worksheet13.getCell(row, i).font = { size: 8, name: "Arial" }
        worksheet13.getCell(row, i).alignment = { horizontal: "left", vertical: "top" }
      }
    }
    
    worksheet13.getCell(9, 1).value = "Place/Ort/helység"
    worksheet13.getCell(9, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(9, 1).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(9, 2).value = effectiveSettings.senderCity
    worksheet13.getCell(9, 2).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(9, 2).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(9, 3).value = effectiveSettings.senderCity
    worksheet13.getCell(9, 3).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(9, 3).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(9, 4).value = effectiveSettings.senderCity
    worksheet13.getCell(9, 4).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(9, 4).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(9, 5).value = effectiveSettings.senderCity
    worksheet13.getCell(9, 5).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(9, 5).alignment = { horizontal: "left", vertical: "middle" }
    
    worksheet13.getCell(10, 1).value = "Country/Land/ország"
    worksheet13.getCell(10, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(10, 1).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(10, 2).value = effectiveSettings.senderCountry
    worksheet13.getCell(10, 2).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(10, 2).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(10, 3).value = effectiveSettings.senderCountry
    worksheet13.getCell(10, 3).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(10, 3).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(10, 4).value = effectiveSettings.senderCountry
    worksheet13.getCell(10, 4).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(10, 4).alignment = { horizontal: "left", vertical: "middle" }
    worksheet13.getCell(10, 5).value = effectiveSettings.senderCountry
    worksheet13.getCell(10, 5).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(10, 5).alignment = { horizontal: "left", vertical: "middle" }
    
    worksheet13.getCell(11, 1).value = "4. Az áru átvételének helye és időponja                                                   Place and date of taking over of the goods"
    worksheet13.getCell(11, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(11, 1).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(11, 2).value = "4. Az áru átvételének helye és időponja                                                   Place and date of taking over of the goods"
    worksheet13.getCell(11, 2).font = { size: 8, name: "Arial" }
    worksheet13.getCell(11, 2).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(11, 3).value = "4. Az áru átvételének helye és időponja                                                   Place and date of taking over of the goods"
    worksheet13.getCell(11, 3).font = { size: 8, name: "Arial" }
    worksheet13.getCell(11, 3).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(11, 4).value = "4. Az áru átvételének helye és időponja                                                   Place and date of taking over of the goods"
    worksheet13.getCell(11, 4).font = { size: 8, name: "Arial" }
    worksheet13.getCell(11, 4).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(11, 5).value = "4. Az áru átvételének helye és időponja                                                   Place and date of taking over of the goods"
    worksheet13.getCell(11, 5).font = { size: 8, name: "Arial" }
    worksheet13.getCell(11, 5).alignment = { horizontal: "left", vertical: "top" }
    
    worksheet13.getCell(12, 1).value = "Place/Ort/helység"
    worksheet13.getCell(12, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(12, 1).alignment = { horizontal: "left", vertical: "middle" }
    
    const carrierReservations = "18. Carrier's reservations and observations\nA fuvarozó fenntartásai és bejegyzése"
    for (let i = 6; i <= 11; i++) {
      for (let row = 12; row <= 14; row++) {
        worksheet13.getCell(row, i).value = carrierReservations
        worksheet13.getCell(row, i).font = row === 12 ? { size: 8, name: "Arial" } : { size: 11, name: "Calibri" }
        worksheet13.getCell(row, i).alignment = { horizontal: "left", vertical: "top" }
      }
    }
    
    worksheet13.getCell(13, 1).value = "Country/Land/ország"
    worksheet13.getCell(13, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(13, 1).alignment = { horizontal: "left", vertical: "middle" }
    
    worksheet13.getCell(14, 1).value = "5. Mellékelt okmány, Documents attached"
    worksheet13.getCell(14, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(14, 1).alignment = { vertical: "top" }
    
    worksheet13.getCell(15, 1).value = "6. Marks and Nos\n     Jel és szám"
    worksheet13.getCell(15, 1).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 1).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(15, 2).value = "7. Number of packages  Darabszám                                        "
    worksheet13.getCell(15, 2).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 2).alignment = { vertical: "top" }
    worksheet13.getCell(15, 3).value = "8. Method of packing   Csomagolás"
    worksheet13.getCell(15, 3).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 3).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(15, 4).value = "8. Method of packing   Csomagolás"
    worksheet13.getCell(15, 4).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 4).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(15, 5).value = "8. Method of packing   Csomagolás"
    worksheet13.getCell(15, 5).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 5).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(15, 6).value = "9. Nature of the goods  Áru megnevezése"
    worksheet13.getCell(15, 6).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(15, 7).value = "10. Statistical num.\nStatisztikai szám"
    worksheet13.getCell(15, 7).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 7).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(15, 8).value = "10. Statistical num.\nStatisztikai szám"
    worksheet13.getCell(15, 8).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 8).alignment = { horizontal: "center", vertical: "top" }
    
    const grossWeightText = {
      richText: [
        { text: "11. Gross weight " },
        { font: { bold: true, size: 7, name: "Arial" }, text: "kg" },
        { font: { size: 7, name: "Arial" }, text: "\nBruttósúly i " },
        { font: { bold: true, size: 7, name: "Arial" }, text: "kg" }
      ]
    }
    worksheet13.getCell(15, 9).value = grossWeightText
    worksheet13.getCell(15, 9).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 9).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(15, 10).value = grossWeightText
    worksheet13.getCell(15, 10).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 10).alignment = { horizontal: "center", vertical: "top" }
    worksheet13.getCell(15, 11).value = "12. Volume in m3\nTérfogat m3"
    worksheet13.getCell(15, 11).font = { size: 7, name: "Arial" }
    worksheet13.getCell(15, 11).alignment = { horizontal: "left", vertical: "top" }
    
    let totalAmount = 0
    let totalBoxes = 0
    let totalPallets = 0
    let totalWeight = 0
    
    orders.forEach((order, index) => {
      const startRow = 16 + index
      worksheet13.getCell(startRow, 1).value = order.productName || ''
      worksheet13.getCell(startRow, 2).value = order.amountPc || 0
      worksheet13.getCell(startRow, 3).value = 'Dobozban'
      worksheet13.getCell(startRow, 6).value = order.designation || ''
      worksheet13.getCell(startRow, 9).value = order.grossWeightKg || ''
      
      totalAmount += order.amountPc || 0
      totalBoxes += order.boxesCount || 0
      totalPallets += order.palletsCount || 0
      const weight = typeof order.grossWeightKg === 'string' 
        ? parseFloat(order.grossWeightKg.replace(',', '.')) || 0
        : order.grossWeightKg || 0
      totalWeight += weight
    })
    
    const summaryRow = 19
    
    const senderInstructions = "13. Sender's instructions (Customs and other formalities)\nFeladó rendelkezései (Vám és egyéb hivatalos kezelés)"
    for (let i = 1; i <= 5; i++) {
      worksheet13.getCell(summaryRow, i).value = senderInstructions
      worksheet13.getCell(summaryRow, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(summaryRow, i).alignment = { horizontal: "left", vertical: "top" }
      worksheet13.getCell(summaryRow + 1, i).value = senderInstructions
      worksheet13.getCell(summaryRow + 1, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(summaryRow + 1, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    const toBePayedText = {
      richText: [
        { font: { size: 8, name: "Arial" }, text: "19. " },
        { font: { vertAlign: "superscript" as const, size: 10, name: "Arial" }, text: "To be paied by" },
        { font: { vertAlign: "superscript" as const, size: 7, name: "Arial" }, text: ":\n" },
        { font: { size: 7, name: "Arial" }, text: "         Fiezetendő:" }
      ]
    }
    worksheet13.getCell(summaryRow, 6).value = toBePayedText
    worksheet13.getCell(summaryRow, 6).font = { size: 10, name: "Arial" }
    worksheet13.getCell(summaryRow, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(summaryRow, 7).value = "Sender\nFeladő"
    worksheet13.getCell(summaryRow, 7).font = { size: 7, name: "Arial" }
    worksheet13.getCell(summaryRow, 7).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(summaryRow, 9).value = "Currency\nPénznem"
    worksheet13.getCell(summaryRow, 9).font = { size: 7, name: "Arial" }
    worksheet13.getCell(summaryRow, 9).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(summaryRow, 11).value = "Consignee\nÁtvevő"
    worksheet13.getCell(summaryRow, 11).font = { size: 7, name: "Arial" }
    worksheet13.getCell(summaryRow, 11).alignment = { horizontal: "left", vertical: "top" }
    
    worksheet13.getCell(20, 6).value = "Carriage charges /Fuvardíj"
    worksheet13.getCell(20, 6).font = { size: 7, name: "Arial" }
    worksheet13.getCell(20, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(21, 6).value = "Supplem charges Pluszköltség"
    worksheet13.getCell(21, 6).font = { size: 7, name: "Arial" }
    worksheet13.getCell(21, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(22, 6).value = "Other charges Extra / más egyéb költség"
    worksheet13.getCell(22, 6).font = { size: 7, name: "Arial" }
    worksheet13.getCell(22, 6).alignment = { horizontal: "left", vertical: "top" }
    worksheet13.getCell(23, 6).value = "Total to be paied\nTeljes költség"
    worksheet13.getCell(23, 6).font = { size: 7, name: "Arial" }
    worksheet13.getCell(23, 6).alignment = { horizontal: "left", vertical: "top" }
    
    const cashOnDeliveryText = {
      richText: [
        { font: { vertAlign: "subscript" as const, size: 8, name: "Arial" }, text: "14. " },
        { font: { size: 7, name: "Arial" }, text: "Cash on delivery\n      Visszatérítés " }
      ]
    }
    worksheet13.getCell(24, 1).value = cashOnDeliveryText
    worksheet13.getCell(24, 1).font = { size: 10, name: "Arial" }
    worksheet13.getCell(24, 1).alignment = { horizontal: "left", vertical: "top" }
    
    worksheet13.getCell(25, 1).value = "15. Directions as to payment for carriage\n      Fuvardíjfizetési meghagyások"
    worksheet13.getCell(25, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(25, 1).alignment = { horizontal: "left", vertical: "top" }
    
    const specialAgreements = "20. Special agreements\n      Egyedi megállapodások"
    for (let i = 6; i <= 11; i++) {
      worksheet13.getCell(25, i).value = specialAgreements
      worksheet13.getCell(25, i).font = i === 6 ? { size: 8, name: "Arial" } : { size: 11, name: "Calibri" }
      worksheet13.getCell(25, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    worksheet13.getCell(26, 1).value = "21. Ausgefertigt in          Kiállitás helye,"
    worksheet13.getCell(26, 1).font = { size: 8, name: "Arial" }
    worksheet13.getCell(26, 1).alignment = { vertical: "top" }
    worksheet13.getCell(26, 2).value = effectiveSettings.placeIssued
    worksheet13.getCell(26, 2).font = { bold: true, size: 10, name: "Times New Roman" }
    worksheet13.getCell(26, 2).alignment = { horizontal: "center", vertical: "middle" }
    worksheet13.getCell(26, 4).value = "am       on"
    worksheet13.getCell(26, 4).font = { size: 10, name: "Times New Roman" }
    worksheet13.getCell(26, 4).alignment = { vertical: "top" }
    
    const goodsReceivedText = {
      richText: [
        { font: { vertAlign: "subscript" as const, size: 8, name: "Arial" }, text: "24." },
        { font: { size: 8, name: "Arial" }, text: "Goods received             Date    \n    Áru átvétele                  dátum\n                                                                                                " }
      ]
    }
    for (let i = 8; i <= 11; i++) {
      worksheet13.getCell(26, i).value = goodsReceivedText
      worksheet13.getCell(26, i).font = i === 8 ? { size: 8, name: "Arial" } : { size: 11, name: "Calibri" }
      worksheet13.getCell(26, i).alignment = { horizontal: "left", vertical: "top" }
      worksheet13.getCell(27, i).value = goodsReceivedText
      worksheet13.getCell(27, i).font = { size: 11, name: "Calibri" }
      worksheet13.getCell(27, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    const senderSignature = "22. A feladó aláírása és bélyegzője   \nSignature and stamp of the sender"
    for (let i = 1; i <= 3; i++) {
      worksheet13.getCell(27, i).value = senderSignature
      worksheet13.getCell(27, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(27, i).alignment = { horizontal: "left", vertical: "top" }
      worksheet13.getCell(28, i).value = senderSignature
      worksheet13.getCell(28, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(28, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    const carrierSignature = "23. Fuvaroó aláírása és bélyegzője\nSignature and stamp of the carrier"
    for (let i = 4; i <= 7; i++) {
      worksheet13.getCell(27, i).value = carrierSignature
      worksheet13.getCell(27, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(27, i).alignment = { horizontal: "center", vertical: "top" }
      worksheet13.getCell(28, i).value = carrierSignature
      worksheet13.getCell(28, i).font = { size: 8, name: "Arial" }
      worksheet13.getCell(28, i).alignment = { horizontal: "center", vertical: "top" }
    }
    
    const consigneeSignature = "Signature and stamp of the consignee       Az átvevő aláírása és bélyezője"
    for (let i = 8; i <= 11; i++) {
      worksheet13.getCell(28, i).value = consigneeSignature
      worksheet13.getCell(28, i).font = { size: 10, name: "Times New Roman" }
      worksheet13.getCell(28, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    const vehicleText = {
      richText: [
        { font: { size: 8, name: "Arial" }, text: "25. Vehicle       " },
        { font: { size: 7, name: "Arial" }, text: "\n        Jármű" }
      ]
    }
    worksheet13.getCell(29, 1).value = vehicleText
    worksheet13.getCell(29, 1).font = { size: 6, name: "Arial" }
    worksheet13.getCell(29, 1).alignment = { vertical: "top" }
    
    const regNumber = "Registration number- Kennzeichen- Rendszám"
    for (let i = 2; i <= 5; i++) {
      worksheet13.getCell(29, i).value = regNumber
      worksheet13.getCell(29, i).font = { size: 9, name: "Arial" }
      worksheet13.getCell(29, i).alignment = { horizontal: "left", vertical: "top" }
    }
    
    worksheet13.columns = [
      { width: 12 },
      { width: 12 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 12 }
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

    console.log('CMR fájl letöltve ExcelJS-sel:', fileName)

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
      console.log('onExportSaved callback meghívása...')
      onExportSaved({
        type: 'cmr',
        customer: firstCustomer,
        orderIds: orders.map(o => o.id),
        fileName,
        exportDate,
        exportData,
      }, sequenceNumber)
      console.log('Callback végrehajtva')
    }
    
    toast.success(`CMR létrehozva! Fájl: ${fileName}`, { duration: 8000 })
    toast.info(`Sablon forrás: src/lib/cmrDirectExport.ts (ExcelJS generálás)`, { duration: 8000 })
    console.log('=== CMR Export Befejezve ===')
  } catch (error) {
    console.error('CMR export hiba:', error)
    toast.error('CMR export sikertelen: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'))
  }
}
