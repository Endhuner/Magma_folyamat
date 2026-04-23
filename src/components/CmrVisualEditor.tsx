import { useState, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { FloppyDisk, Play, Plus, Trash, ArrowsClockwise, Table, Upload, FolderOpen } from '@phosphor-icons/react'
import * as ExcelJS from 'exceljs'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'

type CellDefinition = {
  id: string
  cell: string
  value: string
  dataSource: 'static' | 'dynamic' | 'formula'
  dynamicField?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  alignment?: 'left' | 'center' | 'right'
  verticalAlignment?: 'top' | 'middle' | 'bottom'
  bgColor?: string
  textColor?: string
  merge?: string
  border?: 'none' | 'thin' | 'medium' | 'thick'
}

type ColumnDefinition = {
  index: number
  width: number
}

const DEFAULT_CELLS: CellDefinition[] = [
  { id: '1', cell: 'A1', value: 'NEMZETKÖZI FUVARLEVÉL - CMR', dataSource: 'static', fontSize: 16, bold: true, alignment: 'center', merge: 'A1:K1' },
  { id: '2', cell: 'K2', value: 'Szám: {{sequenceNumber}}', dataSource: 'dynamic', dynamicField: 'sequenceNumber', fontSize: 12, bold: true, alignment: 'right' },
  { id: '3', cell: 'A4', value: '1. Feladó (Név, cím, ország)', dataSource: 'static', fontSize: 11, bold: true, underline: true },
  { id: '4', cell: 'A5', value: '{{senderName}}', dataSource: 'dynamic', dynamicField: 'senderName', fontSize: 11 },
  { id: '5', cell: 'A6', value: '{{senderAddress}}', dataSource: 'dynamic', dynamicField: 'senderAddress', fontSize: 10 },
  { id: '6', cell: 'A7', value: '{{senderCity}}, {{senderCountry}}', dataSource: 'dynamic', dynamicField: 'senderLocation', fontSize: 10 },
  { id: '7', cell: 'A8', value: 'Adószám: {{senderTaxNumber}}', dataSource: 'dynamic', dynamicField: 'senderTaxNumber', fontSize: 10 },
]

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { index: 1, width: 25 },
  { index: 2, width: 30 },
  { index: 3, width: 16 },
  { index: 4, width: 14 },
  { index: 5, width: 14 },
  { index: 6, width: 14 },
  { index: 7, width: 16 },
]

interface CmrVisualEditorProps {
  orders: Order[]
  customers: Customer[]
  products: Product[]
  deliveryNotes: DeliveryNote[]
  selectedOrderIds: string[]
  cmrSettings: CmrLayoutSettings
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, sequenceNumber?: string) => void
}

export function CmrVisualEditor({
  orders,
  customers,
  deliveryNotes,
  selectedOrderIds,
  cmrSettings,
  onExportSaved
}: CmrVisualEditorProps) {
  const [cells, setCells] = useKV<CellDefinition[]>('cmr-visual-cells', DEFAULT_CELLS)
  const [columns, setColumns] = useKV<ColumnDefinition[]>('cmr-visual-columns', DEFAULT_COLUMNS)
  const [selectedCell, setSelectedCell] = useState<CellDefinition | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, string>>({})
  const [loadedFileName, setLoadedFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id))
    const firstCustomer = selectedOrders[0]?.customer || 'export'
    const customerInfo = customers.find(c => c.name === firstCustomer)
    const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'cmr')

    setPreviewData({
      sequenceNumber,
      senderName: cmrSettings.senderName || '',
      senderAddress: cmrSettings.senderAddress || '',
      senderCity: cmrSettings.senderCity || '',
      senderCountry: cmrSettings.senderCountry || '',
      senderTaxNumber: cmrSettings.senderTaxNumber || '',
      senderPhone: cmrSettings.senderPhone || '',
      senderEmail: cmrSettings.senderEmail || '',
      customerName: customerInfo?.name || firstCustomer,
      customerAddress: customerInfo?.fullAddress || '',
      customerCity: customerInfo?.city || '',
      customerCountry: customerInfo?.country || '',
      customerTaxNumber: customerInfo?.taxNumber || '',
      placeOfTakingOver: cmrSettings.placeOfTakingOver || '',
      placeIssued: cmrSettings.placeIssued || '',
      carrierName: cmrSettings.carrierName || '',
      carrierAddress: cmrSettings.carrierAddress || '',
      vehiclePlate: cmrSettings.vehiclePlate || '',
      date: new Date().toLocaleDateString('hu-HU'),
    })
  }, [orders, customers, deliveryNotes, selectedOrderIds, cmrSettings])

  const addNewCell = () => {
    const newCell: CellDefinition = {
      id: Date.now().toString(),
      cell: 'A1',
      value: 'Új cella',
      dataSource: 'static',
      fontSize: 11,
    }
    setCells(current => [...(current || []), newCell])
    setSelectedCell(newCell)
  }

  const updateCell = (id: string, updates: Partial<CellDefinition>) => {
    setCells(current =>
      (current || []).map(cell => cell.id === id ? { ...cell, ...updates } : cell)
    )
    if (selectedCell?.id === id) {
      setSelectedCell(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const deleteCell = (id: string) => {
    setCells(current => (current || []).filter(cell => cell.id !== id))
    if (selectedCell?.id === id) {
      setSelectedCell(null)
    }
  }

  const addColumn = () => {
    const maxIndex = Math.max(...(columns || []).map(c => c.index), 0)
    setColumns(current => [...(current || []), { index: maxIndex + 1, width: 15 }])
  }

  const updateColumn = (index: number, width: number) => {
    setColumns(current =>
      (current || []).map(col => col.index === index ? { ...col, width } : col)
    )
  }

  const deleteColumn = (index: number) => {
    setColumns(current => (current || []).filter(col => col.index !== index))
  }

  const resetToDefault = () => {
    if (confirm('Biztosan visszaállítod az alapértelmezett sablont? Minden módosítás elvész.')) {
      setCells(DEFAULT_CELLS)
      setColumns(DEFAULT_COLUMNS)
      setSelectedCell(null)
      toast.success('Alapértelmezett sablon visszaállítva')
    }
  }

  const loadFullCmrTemplate = async () => {
    if (!confirm('Betöltöd a teljes CMR sablont? Minden jelenlegi módosítás elvész.')) {
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('CMR', {
        pageSetup: { paperSize: 9, orientation: 'portrait' }
      })

      worksheet.getColumn(1).width = 7
      worksheet.getColumn(2).width = 9.29
      worksheet.getColumn(3).width = 10.86
      worksheet.getColumn(4).width = 9.71
      worksheet.getColumn(5).width = 9.71
      worksheet.getColumn(6).width = 13.29
      worksheet.getColumn(7).width = 8.71
      worksheet.getColumn(8).width = 9.14
      worksheet.getColumn(9).width = 8.71
      worksheet.getColumn(10).width = 9.14
      worksheet.getColumn(11).width = 9.57

      worksheet.getRow(1).height = 15
      worksheet.getRow(2).height = 45
      worksheet.getRow(3).height = 15
      worksheet.getRow(4).height = 15
      worksheet.getRow(5).height = 15
      worksheet.getRow(6).height = 15
      worksheet.getRow(7).height = 15
      worksheet.getRow(8).height = 15
      worksheet.getRow(9).height = 15
      worksheet.getRow(10).height = 15
      worksheet.getRow(11).height = 15
      worksheet.getRow(12).height = 15
      worksheet.getRow(13).height = 15
      worksheet.getRow(14).height = 15
      worksheet.getRow(15).height = 30
      worksheet.getRow(16).height = 15
      worksheet.getRow(17).height = 15
      worksheet.getRow(18).height = 15
      worksheet.getRow(19).height = 30
      worksheet.getRow(20).height = 15
      worksheet.getRow(21).height = 15
      worksheet.getRow(22).height = 15
      worksheet.getRow(23).height = 15
      worksheet.getRow(24).height = 15
      worksheet.getRow(25).height = 30
      worksheet.getRow(26).height = 30
      worksheet.getRow(27).height = 30
      worksheet.getRow(28).height = 15
      worksheet.getRow(29).height = 15

      worksheet.getCell(1, 11).value = "Saját rendelési szám"
      worksheet.getCell(1, 11).font = { bold: true, size: 10, name: "Arial" }
      worksheet.getCell(1, 11).alignment = { horizontal: "center", vertical: "middle" }
      
      const senderInfo = {
        richText: [
          { text: "1. Feladó (Név, cím, ország), Sender (Name, Address, Country)\n" },
          { font: { bold: true, size: 10, name: "Arial", family: 2, charset: 238 }, text: "Magma Kft\nH-1211 Budapest, Déli utca 13.\nHU10368152-2-43" }
        ]
      }

      for (let row = 2; row <= 5; row++) {
        for (let col = 1; col <= 5; col++) {
          worksheet.getCell(row, col).value = senderInfo
          worksheet.getCell(row, col).font = { size: 10, name: "Arial" }
          worksheet.getCell(row, col).alignment = { horizontal: "center", vertical: "top" }
        }
      }

      for (let row = 2; row <= 4; row++) {
        for (let col = 6; col <= 11; col++) {
          if (row === 2) {
            worksheet.getCell(row, col).value = "NEMZETKÖZI FUVARLEVÉL"
            worksheet.getCell(row, col).font = { size: 11, name: "Arial" }
          } else if (row === 3) {
            worksheet.getCell(row, col).value = { richText: [{ font: { size: 11, name: "Arial", family: 2 }, text: "INTERNATIONAL CONSIGNMENT NOTE" }] }
            worksheet.getCell(row, col).font = { size: 11, name: "Arial" }
          } else if (row === 4) {
            worksheet.getCell(row, col).value = "This carriage is subject, nothwith- standing any clause to the contrary to the Convention on the Contract for the international Carriage of goods by road (CMR)."
            worksheet.getCell(row, col).font = { size: 7, name: "Arial" }
          }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      for (let col = 9; col <= 11; col++) {
        worksheet.getCell(4, col).value = "A fuvarozásra elétrő megállapodás esetén is a nemzetközi árufuvarozási egyezmény CMR rendelkezései az irányagók "
      }

      for (let col = 1; col <= 5; col++) {
        worksheet.getCell(5, col).value = "2. Átvevő (Név, cím, ország) Consignee (Name, Address, Country)      "
        worksheet.getCell(5, col).font = { size: 8, name: "Arial" }
        worksheet.getCell(5, col).alignment = { horizontal: "left", vertical: "top" }
      }

      for (let col = 6; col <= 11; col++) {
        for (let row = 5; row <= 7; row++) {
          worksheet.getCell(row, col).value = "16. Carrier (Name, Address, Country) Fuvarozó (Név, cím, ország)"
          worksheet.getCell(row, col).font = { size: 8, name: "Arial" }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      for (let col = 1; col <= 5; col++) {
        worksheet.getCell(8, col).value = "3. Az áru átvételének helye és iőpontja.                                                     Place of delivery of the goods"
        worksheet.getCell(8, col).font = { size: 8, name: "Arial" }
        worksheet.getCell(8, col).alignment = { horizontal: "left", vertical: "top" }
      }

      for (let col = 6; col <= 11; col++) {
        for (let row = 8; row <= 11; row++) {
          worksheet.getCell(row, col).value = "17  Successive carriers (Name, Address, Country) További fuvarozó (Név, cím, ország)"
          worksheet.getCell(row, col).font = { size: 8, name: "Arial" }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      worksheet.getCell(9, 1).value = "Place/Ort/helység"
      worksheet.getCell(9, 1).font = { size: 8, name: "Arial" }
      worksheet.getCell(9, 1).alignment = { horizontal: "left", vertical: "middle" }

      for (let col = 2; col <= 5; col++) {
        worksheet.getCell(9, col).value = "Budapest"
        worksheet.getCell(9, col).font = { bold: true, size: 10, name: "Times New Roman" }
        worksheet.getCell(9, col).alignment = { horizontal: "left", vertical: "middle" }
      }

      worksheet.getCell(10, 1).value = "Country/Land/ország"
      worksheet.getCell(10, 1).font = { size: 8, name: "Arial" }
      worksheet.getCell(10, 1).alignment = { horizontal: "left", vertical: "middle" }

      for (let col = 2; col <= 5; col++) {
        worksheet.getCell(10, col).value = "Hungary"
        worksheet.getCell(10, col).font = { bold: true, size: 10, name: "Times New Roman" }
        worksheet.getCell(10, col).alignment = { horizontal: "left", vertical: "middle" }
      }

      for (let col = 1; col <= 5; col++) {
        worksheet.getCell(11, col).value = "4. Az áru átvételének helye és időponja                                                   Place and date of taking over of the goods"
        worksheet.getCell(11, col).font = { size: 8, name: "Arial" }
        worksheet.getCell(11, col).alignment = { horizontal: "left", vertical: "top" }
      }

      worksheet.getCell(12, 1).value = "Place/Ort/helység"
      worksheet.getCell(12, 1).font = { size: 8, name: "Arial" }
      worksheet.getCell(12, 1).alignment = { horizontal: "left", vertical: "middle" }

      const carrierReservation = "18. Carrier's reservations and observations\nA fuvarozó fenntartásai és bejegyzése"
      for (let col = 6; col <= 11; col++) {
        for (let row = 12; row <= 14; row++) {
          worksheet.getCell(row, col).value = carrierReservation
          worksheet.getCell(row, col).font = row === 12 && col === 6 ? { size: 8, name: "Arial" } : { size: 11, name: "Calibri" }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      worksheet.getCell(13, 1).value = "Country/Land/ország"
      worksheet.getCell(13, 1).font = { size: 8, name: "Arial" }
      worksheet.getCell(13, 1).alignment = { horizontal: "left", vertical: "middle" }

      worksheet.getCell(14, 1).value = "5. Mellékelt okmány, Documents attached"
      worksheet.getCell(14, 1).font = { size: 8, name: "Arial" }
      worksheet.getCell(14, 1).alignment = { vertical: "top" }

      worksheet.getCell(15, 1).value = "6. Marks and Nos\n     Jel és szám"
      worksheet.getCell(15, 1).font = { size: 7, name: "Arial" }
      worksheet.getCell(15, 1).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(15, 2).value = "7. Number of packages  Darabszám                                        "
      worksheet.getCell(15, 2).font = { size: 7, name: "Arial" }
      worksheet.getCell(15, 2).alignment = { vertical: "top" }

      for (let col = 3; col <= 5; col++) {
        worksheet.getCell(15, col).value = "8. Method of packing   Csomagolás"
        worksheet.getCell(15, col).font = { size: 7, name: "Arial" }
        worksheet.getCell(15, col).alignment = { horizontal: "left", vertical: "top" }
      }

      worksheet.getCell(15, 6).value = "9. Nature of the goods  Áru megnevezése"
      worksheet.getCell(15, 6).font = { size: 7, name: "Arial" }
      worksheet.getCell(15, 6).alignment = { horizontal: "left", vertical: "top" }

      for (let col = 7; col <= 8; col++) {
        worksheet.getCell(15, col).value = "10. Statistical num.\nStatisztikai szám"
        worksheet.getCell(15, col).font = { size: 7, name: "Arial" }
        worksheet.getCell(15, col).alignment = { horizontal: "center", vertical: "top" }
      }

      const grossWeight = {
        richText: [
          { text: "11. Gross weight " },
          { font: { bold: true, size: 7, name: "Arial", family: 2 }, text: "kg" },
          { font: { size: 7, name: "Arial", family: 2 }, text: "\nBruttósúly i " },
          { font: { bold: true, size: 7, name: "Arial", family: 2 }, text: "kg" }
        ]
      }

      for (let col = 9; col <= 10; col++) {
        worksheet.getCell(15, col).value = grossWeight
        worksheet.getCell(15, col).font = { size: 7, name: "Arial" }
        worksheet.getCell(15, col).alignment = { horizontal: "center", vertical: "top" }
      }

      worksheet.getCell(15, 11).value = "12. Volume in m3\nTérfogat m3"
      worksheet.getCell(15, 11).font = { size: 7, name: "Arial" }
      worksheet.getCell(15, 11).alignment = { horizontal: "left", vertical: "top" }

      for (let col = 1; col <= 5; col++) {
        for (let row = 19; row <= 20; row++) {
          worksheet.getCell(row, col).value = "13. Sender's instructions (Customs and other formalities)\nFeladó rendelkezései (Vám és egyéb hivatalos kezelés)"
          worksheet.getCell(row, col).font = { size: 8, name: "Arial" }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      worksheet.getCell(19, 6).value = {
        richText: [
          { font: { size: 8, name: "Arial", family: 2 } as any, text: "19. " },
          { font: { vertAlign: "superscript", size: 10, name: "Arial", family: 2 } as any, text: "To be paied by" },
          { font: { vertAlign: "superscript", size: 7, name: "Arial", family: 2 } as any, text: ":\n" },
          { font: { size: 7, name: "Arial", family: 2 } as any, text: "         Fiezetendő:" }
        ]
      }
      worksheet.getCell(19, 6).font = { size: 10, name: "Arial" }
      worksheet.getCell(19, 6).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(19, 7).value = "Sender\nFeladő"
      worksheet.getCell(19, 7).font = { size: 7, name: "Arial" }
      worksheet.getCell(19, 7).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(19, 8).value = "Sender\nFeladő"
      worksheet.getCell(19, 8).font = { size: 11, name: "Calibri" }
      worksheet.getCell(19, 8).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(19, 9).value = "Currency\nPénznem"
      worksheet.getCell(19, 9).font = { size: 7, name: "Arial" }
      worksheet.getCell(19, 9).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(19, 10).value = "Currency\nPénznem"
      worksheet.getCell(19, 10).font = { size: 11, name: "Calibri" }
      worksheet.getCell(19, 10).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(19, 11).value = "Consignee\nÁtvevő"
      worksheet.getCell(19, 11).font = { size: 7, name: "Arial" }
      worksheet.getCell(19, 11).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(20, 6).value = "Carriage charges /Fuvardíj"
      worksheet.getCell(20, 6).font = { size: 7, name: "Arial" }
      worksheet.getCell(20, 6).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(21, 6).value = "Supplem charges Pluszköltség"
      worksheet.getCell(21, 6).font = { size: 7, name: "Arial" }
      worksheet.getCell(21, 6).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(22, 6).value = "Other charges Extra / más egyéb költség"
      worksheet.getCell(22, 6).font = { size: 7, name: "Arial" }
      worksheet.getCell(22, 6).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(23, 6).value = "Total to be paied\nTeljes költség"
      worksheet.getCell(23, 6).font = { size: 7, name: "Arial" }
      worksheet.getCell(23, 6).alignment = { horizontal: "left", vertical: "top" }

      const cashOnDelivery = {
        richText: [
          { font: { vertAlign: "subscript", size: 8, name: "Arial", family: 2 } as any, text: "14. " },
          { font: { size: 7, name: "Arial", family: 2 } as any, text: "Cash on delivery\n      Visszatérítés " }
        ]
      }

      worksheet.getCell(24, 1).value = cashOnDelivery
      worksheet.getCell(24, 1).font = { size: 10, name: "Arial" }
      worksheet.getCell(24, 1).alignment = { horizontal: "left", vertical: "top" }

      worksheet.getCell(24, 2).value = cashOnDelivery
      worksheet.getCell(24, 2).font = { size: 11, name: "Calibri" }
      worksheet.getCell(24, 2).alignment = { horizontal: "left", vertical: "top" }

      const paymentDirections = "15. Directions as to payment for carriage\n      Fuvardíjfizetési meghagyások"
      for (let col = 1; col <= 5; col++) {
        worksheet.getCell(25, col).value = paymentDirections
        worksheet.getCell(25, col).font = col === 1 ? { size: 8, name: "Arial" } : { size: 11, name: "Calibri" }
        worksheet.getCell(25, col).alignment = { horizontal: "left", vertical: "top" }
      }

      const specialAgreements = "20. Special agreements\n      Egyedi megállapodások"
      for (let col = 6; col <= 11; col++) {
        worksheet.getCell(25, col).value = specialAgreements
        worksheet.getCell(25, col).font = col === 6 ? { size: 8, name: "Arial" } : { size: 11, name: "Calibri" }
        worksheet.getCell(25, col).alignment = { horizontal: "left", vertical: "top" }
      }

      worksheet.getCell(26, 1).value = "21. Ausgefertigt in          Kiállitás helye,"
      worksheet.getCell(26, 1).font = { size: 8, name: "Arial" }
      worksheet.getCell(26, 1).alignment = { vertical: "top" }

      worksheet.getCell(26, 2).value = "Budapest"
      worksheet.getCell(26, 2).font = { bold: true, size: 10, name: "Times New Roman" }
      worksheet.getCell(26, 2).alignment = { horizontal: "center", vertical: "middle" }

      worksheet.getCell(26, 4).value = "am       on"
      worksheet.getCell(26, 4).font = { size: 10, name: "Times New Roman" }
      worksheet.getCell(26, 4).alignment = { vertical: "top" }

      const goodsReceived = {
        richText: [
          { font: { vertAlign: "subscript", size: 8, name: "Arial", family: 2 } as any, text: "24." },
          { font: { size: 8, name: "Arial", family: 2 } as any, text: "Goods received             Date    \n    Áru átvétele                  dátum\n                                                                                                " }
        ]
      }

      for (let col = 8; col <= 11; col++) {
        for (let row = 26; row <= 27; row++) {
          worksheet.getCell(row, col).value = goodsReceived
          worksheet.getCell(row, col).font = { size: col === 8 ? 8 : 11, name: col === 8 ? "Arial" : "Calibri" }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      const senderSignature = "22. A feladó aláírása és bélyegzője   \nSignature and stamp of the sender"
      for (let col = 1; col <= 3; col++) {
        for (let row = 27; row <= 28; row++) {
          worksheet.getCell(row, col).value = senderSignature
          worksheet.getCell(row, col).font = { size: 8, name: "Arial" }
          worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "top" }
        }
      }

      const carrierSignature = "23. Fuvaroó aláírása és bélyegzője\nSignature and stamp of the carrier"
      for (let col = 4; col <= 7; col++) {
        for (let row = 27; row <= 28; row++) {
          worksheet.getCell(row, col).value = carrierSignature
          worksheet.getCell(row, col).font = { size: 8, name: "Arial" }
          worksheet.getCell(row, col).alignment = { horizontal: "center", vertical: "top" }
        }
      }

      const consigneeSignature = "Signature and stamp of the consignee       Az átvevő aláírása és bélyezője"
      for (let col = 8; col <= 11; col++) {
        worksheet.getCell(28, col).value = consigneeSignature
        worksheet.getCell(28, col).font = { size: 10, name: "Times New Roman" }
        worksheet.getCell(28, col).alignment = { horizontal: "left", vertical: "top" }
      }

      worksheet.getCell(29, 1).value = {
        richText: [
          { font: { size: 8, name: "Arial", family: 2 }, text: "25. Vehicle       " },
          { font: { size: 7, name: "Arial", family: 2 }, text: "\n        Jármű" }
        ]
      }
      worksheet.getCell(29, 1).font = { size: 6, name: "Arial" }
      worksheet.getCell(29, 1).alignment = { vertical: "top" }

      for (let col = 2; col <= 5; col++) {
        worksheet.getCell(29, col).value = "Registration number- Kennzeichen- Rendszám"
        worksheet.getCell(29, col).font = { size: 9, name: "Arial" }
        worksheet.getCell(29, col).alignment = { horizontal: "left", vertical: "top" }
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'cmr_teljes_sablon.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Teljes CMR sablon exportálva: cmr_teljes_sablon.xlsx')
    } catch (error) {
      console.error('Teljes sablon létrehozási hiba:', error)
      toast.error('Sablon exportálás sikertelen')
    }
  }

  const loadExistingTemplate = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)
      
      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        toast.error('Nem található munkalap a file-ban')
        return
      }

      const loadedCells: CellDefinition[] = []
      const loadedColumns: ColumnDefinition[] = []

      worksheet.columns.forEach((col, index) => {
        if (col.width) {
          loadedColumns.push({
            index: index + 1,
            width: col.width
          })
        }
      })

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.value !== null && cell.value !== undefined) {
            const cellAddress = cell.address
            let cellValue = ''
            
            if (typeof cell.value === 'object' && cell.value && 'richText' in cell.value) {
              cellValue = (cell.value as any).richText.map((rt: any) => rt.text).join('')
            } else {
              cellValue = String(cell.value)
            }

            const cellDef: CellDefinition = {
              id: `${rowNumber}-${colNumber}-${Date.now()}`,
              cell: cellAddress,
              value: cellValue,
              dataSource: cellValue.includes('{{') ? 'dynamic' : 'static',
              fontSize: cell.font?.size || 11,
              bold: cell.font?.bold || false,
              italic: cell.font?.italic || false,
              underline: cell.font?.underline ? true : false,
              alignment: cell.alignment?.horizontal as any || 'left',
              verticalAlignment: cell.alignment?.vertical as any || 'top',
              bgColor: cell.fill && 'fgColor' in cell.fill && cell.fill.fgColor ? (cell.fill.fgColor as any).argb : undefined,
              textColor: cell.font?.color ? (cell.font.color as any).argb : undefined,
              border: cell.border?.top?.style ? (cell.border.top.style as any) : 'none'
            }

            loadedCells.push(cellDef)
          }
        })
      })

      if (loadedCells.length > 0) {
        setCells(loadedCells)
        setLoadedFileName(file.name)
        toast.success(`${loadedCells.length} cella betöltve a sablonból`)
      }

      if (loadedColumns.length > 0) {
        setColumns(loadedColumns)
      }

    } catch (error) {
      console.error('File betöltési hiba:', error)
      toast.error('Nem sikerült betölteni a sablont')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      loadExistingTemplate(file)
    }
  }

  const replacePlaceholders = (text: string, data: Record<string, string>): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '')
  }

  const testExport = async () => {
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id))
    
    if (selectedOrders.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('CMR')

      ;(cells || []).forEach(cellDef => {
        const cellRef = cellDef.cell
        const cell = worksheet.getCell(cellRef)

        let cellValue = cellDef.value
        if (cellDef.dataSource === 'dynamic') {
          cellValue = replacePlaceholders(cellValue, previewData)
        }

        cell.value = cellValue

        if (cellDef.fontSize) {
          cell.font = {
            ...cell.font,
            size: cellDef.fontSize,
            bold: cellDef.bold,
            italic: cellDef.italic,
            underline: cellDef.underline,
            color: cellDef.textColor ? { argb: cellDef.textColor } : undefined
          }
        }

        if (cellDef.alignment || cellDef.verticalAlignment) {
          cell.alignment = {
            horizontal: cellDef.alignment,
            vertical: cellDef.verticalAlignment,
            wrapText: true
          }
        }

        if (cellDef.bgColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: cellDef.bgColor }
          }
        }

        if (cellDef.border && cellDef.border !== 'none') {
          const borderStyle = cellDef.border
          cell.border = {
            top: { style: borderStyle as any },
            left: { style: borderStyle as any },
            bottom: { style: borderStyle as any },
            right: { style: borderStyle as any }
          }
        }

        if (cellDef.merge) {
          worksheet.mergeCells(cellDef.merge)
        }
      })

      ;(columns || []).forEach(col => {
        worksheet.getColumn(col.index).width = col.width
      })

      const firstCustomer = selectedOrders[0]?.customer || 'export'
      const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
      const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
      const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'cmr')
      const fileName = `${sequenceNumber}_${safeCustomerName}.xlsx`

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

      const customerInfo = customers.find(c => c.name === firstCustomer)
      const fullAddress = customerInfo?.fullAddress || ''
      
      const exportData = selectedOrders.map(order => ({
        'Szállítólevél száma': sequenceNumber,
        'Vevő': order.customer || '',
        'Vevő cím': fullAddress,
        'Termék név': order.productName || '',
      }))

      if (onExportSaved) {
        const exportDate = new Date().toISOString().split('T')[0]
        onExportSaved({
          type: 'cmr',
          customer: firstCustomer,
          orderIds: selectedOrders.map(o => o.id),
          fileName,
          exportDate,
          exportData,
        }, sequenceNumber)
      }

      toast.success(`CMR teszt export létrehozva: ${fileName}`)
    } catch (error) {
      console.error('Teszt export hiba:', error)
      toast.error('Export sikertelen')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">CMR Vizuális Szerkesztő</h2>
          <p className="text-muted-foreground">Excel-szerű cellaszerkesztés a CMR sablonhoz</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefault}>
            <ArrowsClockwise className="w-4 h-4 mr-2" />
            Alapértelmezett
          </Button>
          <Button variant="default" onClick={loadFullCmrTemplate}>
            <FloppyDisk className="w-4 h-4 mr-2" />
            Teljes CMR Sablon
          </Button>
          <Button variant="secondary" onClick={testExport}>
            <Play className="w-4 h-4 mr-2" />
            Teszt Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cells" className="w-full">
        <TabsList>
          <TabsTrigger value="cells">Cellák</TabsTrigger>
          <TabsTrigger value="columns">Oszlopok</TabsTrigger>
          <TabsTrigger value="preview">Előnézet</TabsTrigger>
        </TabsList>

        <TabsContent value="cells" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Cella definíciók ({(cells || []).length})</h3>
            <Button onClick={addNewCell}>
              <Plus className="w-4 h-4 mr-2" />
              Új cella
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              <h4 className="font-semibold">Cellalista</h4>
              <div className="space-y-2">
                {(cells || []).map(cell => (
                  <div
                    key={cell.id}
                    className={`p-3 border rounded-lg cursor-pointer transition ${
                      selectedCell?.id === cell.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                    }`}
                    onClick={() => setSelectedCell(cell)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-mono font-bold text-sm text-primary">{cell.cell}</div>
                        <div className="text-sm mt-1 truncate">{cell.value}</div>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs bg-muted px-2 py-1 rounded">{cell.dataSource}</span>
                          {cell.bold && <span className="text-xs bg-accent/20 px-2 py-1 rounded">Bold</span>}
                          {cell.merge && <span className="text-xs bg-secondary/20 px-2 py-1 rounded">Merged</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCell(cell.id)
                        }}
                      >
                        <Trash className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <h4 className="font-semibold">Cella szerkesztése</h4>
              {selectedCell ? (
                <div className="space-y-4">
                  <div>
                    <Label>Cella pozíció (pl. A1, B5, K2)</Label>
                    <Input
                      value={selectedCell.cell}
                      onChange={(e) => updateCell(selectedCell.id, { cell: e.target.value.toUpperCase() })}
                      placeholder="A1"
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <Label>Érték / Szöveg</Label>
                    <Input
                      value={selectedCell.value}
                      onChange={(e) => updateCell(selectedCell.id, { value: e.target.value })}
                      placeholder="Cella tartalma"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Használj &#123;&#123;változó&#125;&#125; helyőrzőket (pl. &#123;&#123;senderName&#125;&#125;)
                    </p>
                  </div>

                  <div>
                    <Label>Adatforrás</Label>
                    <Select
                      value={selectedCell.dataSource}
                      onValueChange={(value) => updateCell(selectedCell.id, { dataSource: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Statikus</SelectItem>
                        <SelectItem value="dynamic">Dinamikus</SelectItem>
                        <SelectItem value="formula">Formula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Betűméret</Label>
                      <Input
                        type="number"
                        value={selectedCell.fontSize || 11}
                        onChange={(e) => updateCell(selectedCell.id, { fontSize: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Igazítás</Label>
                      <Select
                        value={selectedCell.alignment || 'left'}
                        onValueChange={(value) => updateCell(selectedCell.id, { alignment: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Bal</SelectItem>
                          <SelectItem value="center">Közép</SelectItem>
                          <SelectItem value="right">Jobb</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCell.bold || false}
                        onChange={(e) => updateCell(selectedCell.id, { bold: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Félkövér</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCell.italic || false}
                        onChange={(e) => updateCell(selectedCell.id, { italic: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Dőlt</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCell.underline || false}
                        onChange={(e) => updateCell(selectedCell.id, { underline: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Aláhúzott</span>
                    </label>
                  </div>

                  <div>
                    <Label>Cellák egyesítése (pl. A1:K1)</Label>
                    <Input
                      value={selectedCell.merge || ''}
                      onChange={(e) => updateCell(selectedCell.id, { merge: e.target.value })}
                      placeholder="A1:K1"
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <Label>Szegély</Label>
                    <Select
                      value={selectedCell.border || 'none'}
                      onValueChange={(value) => updateCell(selectedCell.id, { border: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs</SelectItem>
                        <SelectItem value="thin">Vékony</SelectItem>
                        <SelectItem value="medium">Közepes</SelectItem>
                        <SelectItem value="thick">Vastag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Háttérszín (ARGB)</Label>
                      <Input
                        value={selectedCell.bgColor || ''}
                        onChange={(e) => updateCell(selectedCell.id, { bgColor: e.target.value })}
                        placeholder="FF0066CC"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label>Szövegszín (ARGB)</Label>
                      <Input
                        value={selectedCell.textColor || ''}
                        onChange={(e) => updateCell(selectedCell.id, { textColor: e.target.value })}
                        placeholder="FFFFFFFF"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <Button variant="secondary" className="w-full" onClick={() => {
                    const newCopy: CellDefinition = {
                      ...selectedCell,
                      id: Date.now().toString(),
                      cell: 'A1'
                    }
                    setCells(current => [...(current || []), newCopy])
                    toast.success('Cella másolva')
                  }}>
                    <FloppyDisk className="w-4 h-4 mr-2" />
                    Másolás
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Válassz ki egy cellát a szerkesztéshez
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="columns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Oszlopszélességek</h3>
            <Button onClick={addColumn}>
              <Plus className="w-4 h-4 mr-2" />
              Új oszlop
            </Button>
          </div>

          <Card className="p-4">
            <div className="space-y-3">
              {(columns || []).sort((a, b) => a.index - b.index).map(col => (
                <div key={col.index} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="w-20 font-mono">Oszlop {col.index}</Label>
                    <Input
                      type="number"
                      value={col.width}
                      onChange={(e) => updateColumn(col.index, parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-12">px</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteColumn(col.index)}
                  >
                    <Trash className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Adatok előnézete</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {Object.entries(previewData).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-mono text-muted-foreground">&#123;&#123;{key}&#125;&#125;:</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">
              <Table className="w-5 h-5 inline mr-2" />
              Cella előnézet
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {(cells || []).slice(0, 20).map(cell => (
                    <tr key={cell.id} className="border-b">
                      <td className="px-3 py-2 font-mono font-bold bg-muted">{cell.cell}</td>
                      <td className="px-3 py-2">
                        {cell.dataSource === 'dynamic' 
                          ? replacePlaceholders(cell.value, previewData)
                          : cell.value
                        }
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{cell.dataSource}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
