import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Eye, ArrowCounterClockwise, Palette, TextAa, Download, Upload, FloppyDisk, Clock } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'

interface TemplateStyles {
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
  tableColumnWidths: string
}

interface TemplateSave {
  id: string
  name: string
  type: 'cmr' | 'delivery'
  styles: TemplateStyles
  htmlTemplate?: string
  timestamp: string
}

const DEFAULT_CMR_STYLES: TemplateStyles = {
  primaryColor: '#000000',
  secondaryColor: '#666666',
  textColor: '#000000',
  headerFontSize: '14pt',
  bodyFontSize: '10pt',
  borderWidth: '1px',
  borderColor: '#000000',
  borderRadius: '0px',
  backgroundColor: '#ffffff',
  tableBgColor: '#ffffff',
  tableHeaderBgColor: '#e0e0e0',
  tableHeaderTextColor: '#000000',
  padding: '8px',
  cellPadding: '4px',
  pageMargin: '5px',
  cellMarginTop: '0px',
  cellMarginBottom: '0px',
  cellMarginLeft: '0px',
  cellMarginRight: '0px',
  tableColumnWidths: 'auto',
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
  cellMarginTop: '1px',
  cellMarginBottom: '1px',
  cellMarginLeft: '1px',
  cellMarginRight: '1px',
  tableColumnWidths: 'auto',
}

export function HtmlTemplateEditor() {
  const [orders] = useKV<Order[]>('orders', [])
  const [customers] = useKV<Customer[]>('customers', [])
  const [products] = useKV<Product[]>('products', [])
  
  const [cmrStyles, setCmrStyles] = useKV<TemplateStyles>('cmr-html-styles', DEFAULT_CMR_STYLES)
  const [deliveryStyles, setDeliveryStyles] = useKV<TemplateStyles>('delivery-html-styles', DEFAULT_DELIVERY_STYLES)
  const [templateSaves, setTemplateSaves] = useKV<TemplateSave[]>('template-saves', [])
  
  const [activeTab, setActiveTab] = useState<'cmr' | 'delivery'>('delivery')
  const [previewMode, setPreviewMode] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [htmlImportDialogOpen, setHtmlImportDialogOpen] = useState(false)
  const [importedHtml, setImportedHtml] = useState('')

  const currentStyles = activeTab === 'cmr' ? cmrStyles : deliveryStyles
  const setCurrentStyles = activeTab === 'cmr' ? setCmrStyles : setDeliveryStyles
  const defaultStyles = activeTab === 'cmr' ? DEFAULT_CMR_STYLES : DEFAULT_DELIVERY_STYLES

  const sampleOrders = useMemo(() => {
    if (orders && orders.length > 0) {
      return orders.slice(0, 2)
    }
    return [
      {
        id: '1',
        orderNumber: 'ORD-001',
        ownOrderNumber: 'CUST-001',
        customer: 'Példa Cég Kft',
        productName: 'Alkatrész A',
        designation: 'Példa megnevezés',
        material: 'Acél',
        surfaceTreatment: 'Horganyzott',
        amountPc: 100,
        boxesCount: 5,
        palletsCount: 1,
        grossWeightKg: '250',
        status: 'Folyamatban',
        orderDate: new Date().toISOString(),
        requiredDate: '',
        pickupDate: '',
        invoiced: '',
        ready: '',
        requiredMaterialKg: '',
        plannedProductionHours: '',
        deliveryNote: '',
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        orderNumber: 'ORD-002',
        ownOrderNumber: 'CUST-002',
        customer: 'Példa Cég Kft',
        productName: 'Alkatrész B',
        designation: 'Másik példa',
        material: 'Alumínium',
        surfaceTreatment: 'Eloxált',
        amountPc: 50,
        boxesCount: 3,
        palletsCount: 1,
        grossWeightKg: '120',
        status: 'Folyamatban',
        orderDate: new Date().toISOString(),
        requiredDate: '',
        pickupDate: '',
        invoiced: '',
        ready: '',
        requiredMaterialKg: '',
        plannedProductionHours: '',
        deliveryNote: '',
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as Order[]
  }, [orders])

  const sampleCustomer = useMemo(() => {
    const customerName = sampleOrders[0]?.customer
    if (customers && customers.length > 0) {
      const found = customers.find(c => c.name === customerName)
      if (found) return found
    }
    return {
      id: 'sample',
      name: 'Példa Cég Kft',
      fullAddress: 'Példa utca 123',
      street: 'Példa utca 123',
      city: 'Budapest',
      postalCode: '1234',
      country: 'Magyarország',
      taxNumber: '12345678-1-23',
      language: 'hu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Customer
  }, [customers, sampleOrders])

  const generatePreviewHtml = () => {
    if (activeTab === 'delivery') {
      return generateDeliveryPreview()
    } else {
      return generateCmrPreview()
    }
  }

  const generateDeliveryPreview = () => {
    const totalQuantity = sampleOrders.reduce((sum, order) => sum + (order.amountPc || 0), 0)
    const totalBoxes = sampleOrders.reduce((sum, order) => sum + (order.boxesCount || 0), 0)
    const totalPallets = sampleOrders.reduce((sum, order) => sum + (order.palletsCount || 0), 0)
    const totalGrossWeight = sampleOrders.reduce((sum, order) => sum + (parseFloat(String(order.grossWeightKg || 0)) || 0), 0)

    return `
      <!DOCTYPE html>
      <html lang="hu">
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            font-size: ${currentStyles?.bodyFontSize || '10pt'};
            line-height: 1.3;
            color: ${currentStyles?.textColor || '#000'};
            background: #f5f5f5;
            padding: ${currentStyles?.pageMargin || '10px'};
          }
          
          .delivery-document {
            max-width: 100%;
            margin: 0 auto;
            background: ${currentStyles?.backgroundColor || 'white'};
            padding: ${currentStyles?.padding || '10px'};
            border-radius: ${currentStyles?.borderRadius || '0'};
          }
          
          .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: ${currentStyles?.borderWidth || '2px'} solid ${currentStyles?.primaryColor || '#2c5aa0'};
            padding-bottom: 10px;
          }
          
          .header h1 {
            font-size: ${currentStyles?.headerFontSize || '20pt'};
            font-weight: bold;
            color: ${currentStyles?.primaryColor || '#2c5aa0'};
            margin-bottom: 5px;
          }
          
          .sequence-number {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: calc(${currentStyles?.headerFontSize || '20pt'} * 0.7);
            font-weight: bold;
            color: ${currentStyles?.primaryColor || '#2c5aa0'};
          }
          
          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .info-box {
            border: ${currentStyles?.borderWidth || '2px'} solid ${currentStyles?.borderColor || '#2c5aa0'};
            padding: ${currentStyles?.padding || '10px'};
            border-radius: ${currentStyles?.borderRadius || '5px'};
            background: ${currentStyles?.tableBgColor || '#f8f9fa'};
          }
          
          .info-box h3 {
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 1.1);
            font-weight: bold;
            color: ${currentStyles?.primaryColor || '#2c5aa0'};
            margin-bottom: 8px;
            border-bottom: 1px solid ${currentStyles?.primaryColor || '#2c5aa0'};
            padding-bottom: 3px;
          }
          
          .info-box p {
            margin: 3px 0;
            font-size: ${currentStyles?.bodyFontSize || '10pt'};
          }
          
          .delivery-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.9);
          }
          
          .delivery-table th,
          .delivery-table td {
            border: 1px solid ${currentStyles?.secondaryColor || '#333'};
            padding: ${currentStyles?.cellPadding || '6px'};
            margin-top: ${currentStyles?.cellMarginTop || '0px'};
            margin-bottom: ${currentStyles?.cellMarginBottom || '0px'};
            margin-left: ${currentStyles?.cellMarginLeft || '0px'};
            margin-right: ${currentStyles?.cellMarginRight || '0px'};
            text-align: left;
          }
          
          .delivery-table th {
            background: ${currentStyles?.tableHeaderBgColor || '#2c5aa0'};
            color: ${currentStyles?.tableHeaderTextColor || 'white'};
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
            background: ${currentStyles?.tableBgColor || '#f8f9fa'};
          }
          
          .delivery-table tfoot {
            font-weight: bold;
            background: #e0e0e0;
          }
          
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 30px;
          }
          
          .signature-box {
            border: 1px solid ${currentStyles?.secondaryColor || '#333'};
            padding: ${currentStyles?.padding || '10px'};
            min-height: 100px;
            border-radius: ${currentStyles?.borderRadius || '5px'};
          }
          
          .signature-label {
            font-size: ${currentStyles?.bodyFontSize || '10pt'};
            font-weight: bold;
            margin-bottom: 10px;
            color: ${currentStyles?.primaryColor || '#2c5aa0'};
          }
          
          .signature-space {
            margin-top: 50px;
            border-top: 1px solid ${currentStyles?.secondaryColor || '#666'};
            padding-top: 5px;
            text-align: center;
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.8);
            color: ${currentStyles?.secondaryColor || '#666'};
          }
        </style>
      </head>
      <body>
        <div class="delivery-document">
          <div class="sequence-number">Szám: DN-2024-001</div>
          
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
              <p><strong>${sampleCustomer.name}</strong></p>
              <p>${sampleCustomer.street}</p>
              <p>${sampleCustomer.city}, ${sampleCustomer.postalCode}</p>
              <p>${sampleCustomer.country}</p>
              <p>Adószám: ${sampleCustomer.taxNumber}</p>
            </div>
          </div>
          
          <table class="delivery-table">
            <thead>
              <tr>
                <th>Saját rendelési szám</th>
                <th>Vevő rendelési száma</th>
                <th>Termék név</th>
                <th>Megnevezés</th>
                <th>Anyag</th>
                <th>Felületkezelés</th>
                <th>Mennyiség (db)</th>
                <th>Dobozok száma</th>
                <th>Raklapok száma</th>
                <th>Bruttó súly (kg)</th>
              </tr>
            </thead>
            <tbody>
              ${sampleOrders.map(order => `
                <tr>
                  <td class="center">${order.orderNumber || '-'}</td>
                  <td class="center">${order.ownOrderNumber || '-'}</td>
                  <td>${order.productName || '-'}</td>
                  <td>${order.designation || '-'}</td>
                  <td>${order.material || '-'}</td>
                  <td>${order.surfaceTreatment || '-'}</td>
                  <td class="center">${order.amountPc || 0}</td>
                  <td class="center">${order.boxesCount || '-'}</td>
                  <td class="center">${order.palletsCount || '-'}</td>
                  <td class="right">${order.grossWeightKg || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6" class="right"><strong>Összesen:</strong></td>
                <td class="center"><strong>${totalQuantity}</strong></td>
                <td class="center"><strong>${totalBoxes}</strong></td>
                <td class="center"><strong>${totalPallets}</strong></td>
                <td class="right"><strong>${totalGrossWeight.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
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
      </body>
      </html>
    `
  }

  const generateCmrPreview = () => {
    return `
      <!DOCTYPE html>
      <html lang="hu">
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            font-size: ${currentStyles?.bodyFontSize || '10pt'};
            line-height: 1.3;
            color: ${currentStyles?.textColor || '#000'};
            background: #f5f5f5;
            padding: ${currentStyles?.pageMargin || '5px'};
          }
          
          .cmr-document {
            max-width: 100%;
            margin: 0 auto;
            background: ${currentStyles?.backgroundColor || 'white'};
            padding: ${currentStyles?.padding || '8px'};
            border-radius: ${currentStyles?.borderRadius || '0'};
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: ${currentStyles?.borderWidth || '2px'} solid ${currentStyles?.primaryColor || '#000'};
            padding-bottom: 5px;
          }
          
          .header h1 {
            font-size: ${currentStyles?.headerFontSize || '14pt'};
            font-weight: bold;
            color: ${currentStyles?.primaryColor || '#000'};
            margin-bottom: 2px;
          }
          
          .header h2 {
            font-size: calc(${currentStyles?.headerFontSize || '14pt'} * 0.8);
            font-weight: normal;
            font-style: italic;
          }
          
          .sequence-number {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 1.2);
            font-weight: bold;
          }
          
          .cmr-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 10px;
          }
          
          .section {
            border: ${currentStyles?.borderWidth || '1px'} solid ${currentStyles?.borderColor || '#000'};
            padding: ${currentStyles?.padding || '8px'};
            background: ${currentStyles?.backgroundColor || '#fff'};
            border-radius: ${currentStyles?.borderRadius || '0'};
          }
          
          .section-title {
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.9);
            font-weight: bold;
            margin-bottom: 5px;
            text-decoration: underline;
            color: ${currentStyles?.primaryColor || '#000'};
          }
          
          .section-content {
            font-size: ${currentStyles?.bodyFontSize || '10pt'};
            line-height: 1.4;
          }
          
          .full-width {
            grid-column: 1 / -1;
          }
          
          .goods-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.9);
          }
          
          .goods-table th,
          .goods-table td {
            border: ${currentStyles?.borderWidth || '1px'} solid ${currentStyles?.borderColor || '#000'};
            padding: ${currentStyles?.cellPadding || '4px'};
            margin-top: ${currentStyles?.cellMarginTop || '0px'};
            margin-bottom: ${currentStyles?.cellMarginBottom || '0px'};
            margin-left: ${currentStyles?.cellMarginLeft || '0px'};
            margin-right: ${currentStyles?.cellMarginRight || '0px'};
            text-align: left;
          }
          
          .goods-table th {
            background: ${currentStyles?.tableHeaderBgColor || '#e0e0e0'};
            color: ${currentStyles?.tableHeaderTextColor || '#000'};
            font-weight: bold;
            text-align: center;
          }
          
          .goods-table td.center {
            text-align: center;
          }
          
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            margin-top: 20px;
          }
          
          .signature-box {
            border: ${currentStyles?.borderWidth || '1px'} solid ${currentStyles?.borderColor || '#000'};
            padding: ${currentStyles?.padding || '8px'};
            min-height: 80px;
            border-radius: ${currentStyles?.borderRadius || '0'};
          }
          
          .signature-label {
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.8);
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .signature-space {
            margin-top: 40px;
            border-top: 1px solid ${currentStyles?.secondaryColor || '#666'};
            padding-top: 3px;
            text-align: center;
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.7);
          }
          
          .notice-box {
            border: ${currentStyles?.borderWidth || '1px'} solid ${currentStyles?.borderColor || '#000'};
            padding: 5px;
            font-size: calc(${currentStyles?.bodyFontSize || '10pt'} * 0.7);
            text-align: center;
            margin-bottom: 10px;
            background: ${currentStyles?.tableBgColor || '#f9f9f9'};
            border-radius: ${currentStyles?.borderRadius || '0'};
          }
        </style>
      </head>
      <body>
        <div class="cmr-document">
          <div class="sequence-number">Saját rendelési szám: CMR-2024-001</div>
          
          <div class="header">
            <h1>NEMZETKÖZI FUVARLEVÉL</h1>
            <h2>INTERNATIONAL CONSIGNMENT NOTE</h2>
          </div>
          
          <div class="notice-box">
            This carriage is subject, notwithstanding any clause to the contrary to the Convention on the Contract for the international Carriage of goods by road (CMR).
          </div>
          
          <div class="cmr-grid">
            <div class="section">
              <div class="section-title">1. Feladó (Név, cím, ország)<br>Sender (Name, Address, Country)</div>
              <div class="section-content">
                <strong>Magma Kft</strong><br>
                H-1211 Budapest, Déli utca 13.<br>
                Budapest, Magyarország<br>
                Adószám: HU10368152-2-43
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">2. Átvevő (Név, cím, ország)<br>Consignee (Name, Address, Country)</div>
              <div class="section-content">
                <strong>${sampleCustomer.name}</strong><br>
                ${sampleCustomer.street}<br>
                ${sampleCustomer.city}, ${sampleCustomer.country}<br>
                Adószám: ${sampleCustomer.taxNumber}
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">3. Az áru átvételének helye és időpontja<br>Place and date of delivery of the goods</div>
              <div class="section-content">
                Helység / Place: <strong>Budapest, Hungary</strong><br>
                Ország / Country: <strong>Magyarország</strong>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">4. Az áru leadásának helye és időpontja<br>Place and date of taking over of the goods</div>
              <div class="section-content">
                Helység / Place: <strong>${sampleCustomer.city}</strong><br>
                Ország / Country: <strong>${sampleCustomer.country}</strong>
              </div>
            </div>
          </div>
          
          <div class="section full-width">
            <div class="section-title">6. Az áru megjelölése<br>Marks and numbers</div>
            <table class="goods-table">
              <thead>
                <tr>
                  <th>Termék név</th>
                  <th>Mennyiség (db)</th>
                  <th>Súly (kg)</th>
                </tr>
              </thead>
              <tbody>
                ${sampleOrders.map(order => `
                  <tr>
                    <td>${order.productName || '-'}</td>
                    <td class="center">${order.amountPc || 0}</td>
                    <td class="center">${order.grossWeightKg || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Feladó aláírása</div>
              <div class="signature-space">(aláírás)</div>
            </div>
            
            <div class="signature-box">
              <div class="signature-label">Fuvarozó aláírása</div>
              <div class="signature-space">(aláírás)</div>
            </div>
            
            <div class="signature-box">
              <div class="signature-label">Átvevő aláírása</div>
              <div class="signature-space">(aláírás)</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const handleStyleChange = (key: keyof TemplateStyles, value: string) => {
    setCurrentStyles((current) => ({
      ...(current || defaultStyles),
      [key]: value,
    }))
  }

  const handleReset = () => {
    setCurrentStyles(defaultStyles)
    toast.success('Beállítások visszaállítva az alapértelmezett értékekre')
  }

  const handleExport = () => {
    try {
      const fullTemplate = {
        version: '1.0',
        type: activeTab,
        styles: currentStyles,
        htmlTemplate: generatePreviewHtml(),
        exportedAt: new Date().toISOString()
      }
      
      const dataStr = JSON.stringify(fullTemplate, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${activeTab}-template-full.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Teljes sablon exportálva (JSON + HTML)')
    } catch (error) {
      toast.error('Exportálás sikertelen')
    }
  }

  const handleImport = () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json'
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (event) => {
            try {
              const importedData = JSON.parse(event.target?.result as string)
              
              if (importedData.version && importedData.htmlTemplate) {
                setCurrentStyles(importedData.styles)
                toast.success('Teljes sablon importálva (JSON + HTML)')
              } else if (importedData.primaryColor) {
                setCurrentStyles(importedData as TemplateStyles)
                toast.success('Sablon beállítások importálva')
              } else {
                toast.error('Érvénytelen formátum')
              }
            } catch (error) {
              toast.error('Érvénytelen formátum')
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    } catch (error) {
      toast.error('Importálás sikertelen')
    }
  }

  const handleSave = () => {
    if (!saveName.trim()) {
      toast.error('Adja meg a sablon nevét')
      return
    }
    
    const newSave: TemplateSave = {
      id: Date.now().toString(),
      name: saveName,
      type: activeTab,
      styles: currentStyles || defaultStyles,
      htmlTemplate: generatePreviewHtml(),
      timestamp: new Date().toISOString(),
    }
    
    setTemplateSaves((current) => [...(current || []), newSave])
    toast.success(`Sablon mentve: ${saveName}`)
    setSaveName('')
    setSaveDialogOpen(false)
  }

  const handleRestore = (save: TemplateSave) => {
    setCurrentStyles(save.styles)
    toast.success(`Sablon visszaállítva: ${save.name}`)
    setRestoreDialogOpen(false)
  }

  const handleDeleteSave = (id: string) => {
    setTemplateSaves((current) => (current || []).filter(s => s.id !== id))
    toast.success('Mentés törölve')
  }

  const handleExportSave = (save: TemplateSave) => {
    try {
      const fullTemplate = {
        version: '1.0',
        type: save.type,
        styles: save.styles,
        htmlTemplate: save.htmlTemplate || generatePreviewHtml(),
        exportedAt: new Date().toISOString(),
        originalName: save.name
      }
      
      const dataStr = JSON.stringify(fullTemplate, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${save.name.replace(/\s+/g, '-')}-template.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`Sablon exportálva: ${save.name}`)
    } catch (error) {
      toast.error('Exportálás sikertelen')
    }
  }

  const handleDownloadHtml = (save: TemplateSave) => {
    try {
      const htmlContent = save.htmlTemplate || generatePreviewHtml()
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(htmlBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${save.name.replace(/\s+/g, '-')}-template.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`HTML sablon letöltve: ${save.name}`)
    } catch (error) {
      toast.error('Letöltés sikertelen')
    }
  }

  const handleHtmlImport = () => {
    setHtmlImportDialogOpen(true)
  }

  const parseHtmlToStyles = (html: string): Partial<TemplateStyles> => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const style = doc.querySelector('style')
    
    if (!style) {
      toast.error('Nem található style tag a HTML-ben')
      return {}
    }
    
    const cssText = style.textContent || ''
    const extractedStyles: Partial<TemplateStyles> = {}
    
    const extractCssValue = (pattern: RegExp): string | undefined => {
      const match = cssText.match(pattern)
      return match ? match[1].trim() : undefined
    }
    
    const bgColor = extractCssValue(/background:\s*([#\w]+);/)
    if (bgColor) extractedStyles.backgroundColor = bgColor
    
    const textColor = extractCssValue(/color:\s*([#\w]+);/)
    if (textColor) extractedStyles.textColor = textColor
    
    const fontSize = extractCssValue(/font-size:\s*([\dpt]+);/)
    if (fontSize) extractedStyles.bodyFontSize = fontSize
    
    const borderWidth = extractCssValue(/border(?:-width)?:\s*([\dpx]+)/)
    if (borderWidth) extractedStyles.borderWidth = borderWidth
    
    const borderColor = extractCssValue(/border(?:-color)?:\s*([#\w]+)/)
    if (borderColor) extractedStyles.borderColor = borderColor
    
    const borderRadius = extractCssValue(/border-radius:\s*([\dpx]+);/)
    if (borderRadius) extractedStyles.borderRadius = borderRadius
    
    const padding = extractCssValue(/padding:\s*([\dpx]+);/)
    if (padding) extractedStyles.padding = padding
    
    return extractedStyles
  }

  const handleApplyImportedHtml = () => {
    try {
      const extractedStyles = parseHtmlToStyles(importedHtml)
      
      if (Object.keys(extractedStyles).length === 0) {
        toast.error('Nem sikerült stílusokat kinyerni a HTML-ből')
        return
      }
      
      setCurrentStyles((current) => ({
        ...(current || defaultStyles),
        ...extractedStyles,
      }))
      
      toast.success(`${Object.keys(extractedStyles).length} stílus importálva`)
      setImportedHtml('')
      setHtmlImportDialogOpen(false)
    } catch (error) {
      toast.error('HTML feldolgozás sikertelen')
    }
  }

  const filteredSaves = useMemo(() => {
    return (templateSaves || []).filter(save => save.type === activeTab)
  }, [templateSaves, activeTab])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">HTML Sablon Szerkesztő</h2>
          <p className="text-muted-foreground">
            Vizuális szerkesztés élő előnézettel
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleHtmlImport} className="gap-2">
            <Upload className="w-4 h-4" />
            HTML Importálás
          </Button>
          <Button variant="outline" onClick={handleImport} className="gap-2">
            <Upload className="w-4 h-4" />
            JSON Importálás
          </Button>
          <Button variant="outline" onClick={() => {
            try {
              const htmlContent = generatePreviewHtml()
              const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
              const url = URL.createObjectURL(htmlBlob)
              const link = document.createElement('a')
              link.href = url
              link.download = `${activeTab}-template.html`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(url)
              toast.success('HTML sablon exportálva')
            } catch (error) {
              toast.error('HTML exportálás sikertelen')
            }
          }} className="gap-2">
            <Download className="w-4 h-4" />
            HTML Exportálás
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Teljes Exportálás (JSON)
          </Button>
          <Button variant="default" onClick={() => setSaveDialogOpen(true)} className="gap-2">
            <FloppyDisk className="w-4 h-4" />
            Mentés
          </Button>
          <Button variant="secondary" onClick={() => setRestoreDialogOpen(true)} className="gap-2">
            <Clock className="w-4 h-4" />
            Visszaállítás
          </Button>
          <Button
            variant={previewMode ? 'default' : 'outline'}
            onClick={() => setPreviewMode(!previewMode)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Előnézet be' : 'Előnézet ki'}
          </Button>
          <Button variant="secondary" onClick={handleReset} className="gap-2">
            <ArrowCounterClockwise className="w-4 h-4" />
            Alapértelmezett
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cmr' | 'delivery')}>
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2">
          <TabsTrigger value="delivery">Szállítólevél</TabsTrigger>
          <TabsTrigger value="cmr">CMR</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-primary" weight="duotone" />
                  <h3 className="text-lg font-semibold">Színek</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="primary-color">Elsődleges szín</Label>
                      <Input
                        id="primary-color"
                        type="color"
                        value={currentStyles?.primaryColor || '#2c5aa0'}
                        onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="secondary-color">Másodlagos szín</Label>
                      <Input
                        id="secondary-color"
                        type="color"
                        value={currentStyles?.secondaryColor || '#666666'}
                        onChange={(e) => handleStyleChange('secondaryColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="text-color">Szöveg szín</Label>
                      <Input
                        id="text-color"
                        type="color"
                        value={currentStyles?.textColor || '#000000'}
                        onChange={(e) => handleStyleChange('textColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bg-color">Háttérszín</Label>
                      <Input
                        id="bg-color"
                        type="color"
                        value={currentStyles?.backgroundColor || '#ffffff'}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="table-bg">Táblázat háttér</Label>
                      <Input
                        id="table-bg"
                        type="color"
                        value={currentStyles?.tableBgColor || '#f8f9fa'}
                        onChange={(e) => handleStyleChange('tableBgColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="border-color">Keret szín</Label>
                      <Input
                        id="border-color"
                        type="color"
                        value={currentStyles?.borderColor || '#2c5aa0'}
                        onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="table-header-bg">Táblázat fejléc háttér</Label>
                      <Input
                        id="table-header-bg"
                        type="color"
                        value={currentStyles?.tableHeaderBgColor || '#2c5aa0'}
                        onChange={(e) => handleStyleChange('tableHeaderBgColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="table-header-text">Táblázat fejléc szöveg</Label>
                      <Input
                        id="table-header-text"
                        type="color"
                        value={currentStyles?.tableHeaderTextColor || '#ffffff'}
                        onChange={(e) => handleStyleChange('tableHeaderTextColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TextAa className="w-5 h-5 text-primary" weight="duotone" />
                  <h3 className="text-lg font-semibold">Tipográfia és Elrendezés</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="header-font">Cím betűméret</Label>
                      <Select
                        value={currentStyles?.headerFontSize || '20pt'}
                        onValueChange={(value) => handleStyleChange('headerFontSize', value)}
                      >
                        <SelectTrigger id="header-font">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="14pt">14pt</SelectItem>
                          <SelectItem value="16pt">16pt</SelectItem>
                          <SelectItem value="18pt">18pt</SelectItem>
                          <SelectItem value="20pt">20pt</SelectItem>
                          <SelectItem value="22pt">22pt</SelectItem>
                          <SelectItem value="24pt">24pt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="body-font">Törzs betűméret</Label>
                      <Select
                        value={currentStyles?.bodyFontSize || '10pt'}
                        onValueChange={(value) => handleStyleChange('bodyFontSize', value)}
                      >
                        <SelectTrigger id="body-font">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8pt">8pt</SelectItem>
                          <SelectItem value="9pt">9pt</SelectItem>
                          <SelectItem value="10pt">10pt</SelectItem>
                          <SelectItem value="11pt">11pt</SelectItem>
                          <SelectItem value="12pt">12pt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="border-width">Keret vastagság</Label>
                      <Select
                        value={currentStyles?.borderWidth || '2px'}
                        onValueChange={(value) => handleStyleChange('borderWidth', value)}
                      >
                        <SelectTrigger id="border-width">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1px">1px</SelectItem>
                          <SelectItem value="2px">2px</SelectItem>
                          <SelectItem value="3px">3px</SelectItem>
                          <SelectItem value="4px">4px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="border-radius">Kerekítés</Label>
                      <Select
                        value={currentStyles?.borderRadius || '5px'}
                        onValueChange={(value) => handleStyleChange('borderRadius', value)}
                      >
                        <SelectTrigger id="border-radius">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">0px (Éles)</SelectItem>
                          <SelectItem value="3px">3px</SelectItem>
                          <SelectItem value="5px">5px</SelectItem>
                          <SelectItem value="8px">8px</SelectItem>
                          <SelectItem value="10px">10px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="padding">Belső margó</Label>
                    <Select
                      value={currentStyles?.padding || '10px'}
                      onValueChange={(value) => handleStyleChange('padding', value)}
                    >
                      <SelectTrigger id="padding">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5px">5px (Kompakt)</SelectItem>
                        <SelectItem value="8px">8px</SelectItem>
                        <SelectItem value="10px">10px (Alapértelmezett)</SelectItem>
                        <SelectItem value="12px">12px</SelectItem>
                        <SelectItem value="15px">15px (Bő)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cell-padding">Cella padding</Label>
                      <Select
                        value={currentStyles?.cellPadding || '6px'}
                        onValueChange={(value) => handleStyleChange('cellPadding', value)}
                      >
                        <SelectTrigger id="cell-padding">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2px">2px (Minimum)</SelectItem>
                          <SelectItem value="4px">4px (Kicsi)</SelectItem>
                          <SelectItem value="6px">6px (Alapértelmezett)</SelectItem>
                          <SelectItem value="8px">8px</SelectItem>
                          <SelectItem value="10px">10px (Bő)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="page-margin">Oldal margó</Label>
                      <Select
                        value={currentStyles?.pageMargin || '10px'}
                        onValueChange={(value) => handleStyleChange('pageMargin', value)}
                      >
                        <SelectTrigger id="page-margin">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">0px (Nincs)</SelectItem>
                          <SelectItem value="5px">5px (Minimum)</SelectItem>
                          <SelectItem value="10px">10px (Alapértelmezett)</SelectItem>
                          <SelectItem value="15px">15px</SelectItem>
                          <SelectItem value="20px">20px (Normál)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Cella margók (távolság cellák között)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="cell-margin-top" className="text-xs">Felső</Label>
                        <Select
                          value={currentStyles?.cellMarginTop || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginTop', value)}
                        >
                          <SelectTrigger id="cell-margin-top" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cell-margin-bottom" className="text-xs">Alsó</Label>
                        <Select
                          value={currentStyles?.cellMarginBottom || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginBottom', value)}
                        >
                          <SelectTrigger id="cell-margin-bottom" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cell-margin-left" className="text-xs">Bal</Label>
                        <Select
                          value={currentStyles?.cellMarginLeft || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginLeft', value)}
                        >
                          <SelectTrigger id="cell-margin-left" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cell-margin-right" className="text-xs">Jobb</Label>
                        <Select
                          value={currentStyles?.cellMarginRight || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginRight', value)}
                        >
                          <SelectTrigger id="cell-margin-right" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {previewMode && (
              <Card className="p-6 overflow-hidden">
                <h3 className="text-lg font-semibold mb-4">Élő Előnézet</h3>
                <div className="border rounded-lg overflow-auto" style={{ maxHeight: '800px' }}>
                  <iframe
                    srcDoc={generatePreviewHtml()}
                    className="w-full border-0"
                    style={{ minHeight: '600px', transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%' }}
                    title="Template Preview"
                  />
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cmr" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-primary" weight="duotone" />
                  <h3 className="text-lg font-semibold">Színek</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-primary-color">Elsődleges szín</Label>
                      <Input
                        id="cmr-primary-color"
                        type="color"
                        value={currentStyles?.primaryColor || '#000000'}
                        onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cmr-secondary-color">Másodlagos szín</Label>
                      <Input
                        id="cmr-secondary-color"
                        type="color"
                        value={currentStyles?.secondaryColor || '#666666'}
                        onChange={(e) => handleStyleChange('secondaryColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-text-color">Szöveg szín</Label>
                      <Input
                        id="cmr-text-color"
                        type="color"
                        value={currentStyles?.textColor || '#000000'}
                        onChange={(e) => handleStyleChange('textColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cmr-bg-color">Háttérszín</Label>
                      <Input
                        id="cmr-bg-color"
                        type="color"
                        value={currentStyles?.backgroundColor || '#ffffff'}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-table-bg">Táblázat háttér</Label>
                      <Input
                        id="cmr-table-bg"
                        type="color"
                        value={currentStyles?.tableBgColor || '#f9f9f9'}
                        onChange={(e) => handleStyleChange('tableBgColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cmr-border-color">Keret szín</Label>
                      <Input
                        id="cmr-border-color"
                        type="color"
                        value={currentStyles?.borderColor || '#000000'}
                        onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-table-header-bg">Táblázat fejléc háttér</Label>
                      <Input
                        id="cmr-table-header-bg"
                        type="color"
                        value={currentStyles?.tableHeaderBgColor || '#e0e0e0'}
                        onChange={(e) => handleStyleChange('tableHeaderBgColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cmr-table-header-text">Táblázat fejléc szöveg</Label>
                      <Input
                        id="cmr-table-header-text"
                        type="color"
                        value={currentStyles?.tableHeaderTextColor || '#000000'}
                        onChange={(e) => handleStyleChange('tableHeaderTextColor', e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TextAa className="w-5 h-5 text-primary" weight="duotone" />
                  <h3 className="text-lg font-semibold">Tipográfia és Elrendezés</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-header-font">Cím betűméret</Label>
                      <Select
                        value={currentStyles?.headerFontSize || '14pt'}
                        onValueChange={(value) => handleStyleChange('headerFontSize', value)}
                      >
                        <SelectTrigger id="cmr-header-font">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12pt">12pt</SelectItem>
                          <SelectItem value="14pt">14pt</SelectItem>
                          <SelectItem value="16pt">16pt</SelectItem>
                          <SelectItem value="18pt">18pt</SelectItem>
                          <SelectItem value="20pt">20pt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cmr-body-font">Törzs betűméret</Label>
                      <Select
                        value={currentStyles?.bodyFontSize || '10pt'}
                        onValueChange={(value) => handleStyleChange('bodyFontSize', value)}
                      >
                        <SelectTrigger id="cmr-body-font">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8pt">8pt</SelectItem>
                          <SelectItem value="9pt">9pt</SelectItem>
                          <SelectItem value="10pt">10pt</SelectItem>
                          <SelectItem value="11pt">11pt</SelectItem>
                          <SelectItem value="12pt">12pt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-border-width">Keret vastagság</Label>
                      <Select
                        value={currentStyles?.borderWidth || '1px'}
                        onValueChange={(value) => handleStyleChange('borderWidth', value)}
                      >
                        <SelectTrigger id="cmr-border-width">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1px">1px</SelectItem>
                          <SelectItem value="2px">2px</SelectItem>
                          <SelectItem value="3px">3px</SelectItem>
                          <SelectItem value="4px">4px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cmr-border-radius">Kerekítés</Label>
                      <Select
                        value={currentStyles?.borderRadius || '0px'}
                        onValueChange={(value) => handleStyleChange('borderRadius', value)}
                      >
                        <SelectTrigger id="cmr-border-radius">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">0px (Éles)</SelectItem>
                          <SelectItem value="3px">3px</SelectItem>
                          <SelectItem value="5px">5px</SelectItem>
                          <SelectItem value="8px">8px</SelectItem>
                          <SelectItem value="10px">10px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cmr-padding">Belső margó</Label>
                    <Select
                      value={currentStyles?.padding || '8px'}
                      onValueChange={(value) => handleStyleChange('padding', value)}
                    >
                      <SelectTrigger id="cmr-padding">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5px">5px (Kompakt)</SelectItem>
                        <SelectItem value="8px">8px (Alapértelmezett)</SelectItem>
                        <SelectItem value="10px">10px</SelectItem>
                        <SelectItem value="12px">12px</SelectItem>
                        <SelectItem value="15px">15px (Bő)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cmr-cell-padding">Cella padding</Label>
                      <Select
                        value={currentStyles?.cellPadding || '4px'}
                        onValueChange={(value) => handleStyleChange('cellPadding', value)}
                      >
                        <SelectTrigger id="cmr-cell-padding">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2px">2px (Minimum)</SelectItem>
                          <SelectItem value="4px">4px (Alapértelmezett)</SelectItem>
                          <SelectItem value="6px">6px</SelectItem>
                          <SelectItem value="8px">8px</SelectItem>
                          <SelectItem value="10px">10px (Bő)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cmr-page-margin">Oldal margó</Label>
                      <Select
                        value={currentStyles?.pageMargin || '5px'}
                        onValueChange={(value) => handleStyleChange('pageMargin', value)}
                      >
                        <SelectTrigger id="cmr-page-margin">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">0px (Nincs)</SelectItem>
                          <SelectItem value="5px">5px (Alapértelmezett)</SelectItem>
                          <SelectItem value="10px">10px</SelectItem>
                          <SelectItem value="15px">15px</SelectItem>
                          <SelectItem value="20px">20px (Normál)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Cella margók (távolság cellák között)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="cmr-cell-margin-top" className="text-xs">Felső</Label>
                        <Select
                          value={currentStyles?.cellMarginTop || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginTop', value)}
                        >
                          <SelectTrigger id="cmr-cell-margin-top" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cmr-cell-margin-bottom" className="text-xs">Alsó</Label>
                        <Select
                          value={currentStyles?.cellMarginBottom || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginBottom', value)}
                        >
                          <SelectTrigger id="cmr-cell-margin-bottom" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cmr-cell-margin-left" className="text-xs">Bal</Label>
                        <Select
                          value={currentStyles?.cellMarginLeft || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginLeft', value)}
                        >
                          <SelectTrigger id="cmr-cell-margin-left" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cmr-cell-margin-right" className="text-xs">Jobb</Label>
                        <Select
                          value={currentStyles?.cellMarginRight || '0px'}
                          onValueChange={(value) => handleStyleChange('cellMarginRight', value)}
                        >
                          <SelectTrigger id="cmr-cell-margin-right" className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">0px</SelectItem>
                            <SelectItem value="1px">1px</SelectItem>
                            <SelectItem value="2px">2px</SelectItem>
                            <SelectItem value="3px">3px</SelectItem>
                            <SelectItem value="4px">4px</SelectItem>
                            <SelectItem value="5px">5px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {previewMode && (
              <Card className="p-6 overflow-hidden">
                <h3 className="text-lg font-semibold mb-4">Élő Előnézet</h3>
                <div className="border rounded-lg overflow-auto" style={{ maxHeight: '800px' }}>
                  <iframe
                    srcDoc={generatePreviewHtml()}
                    className="w-full border-0"
                    style={{ minHeight: '600px', transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%' }}
                    title="Template Preview"
                  />
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sablon mentése</DialogTitle>
            <DialogDescription>
              Mentse el a jelenlegi {activeTab === 'cmr' ? 'CMR' : 'Szállítólevél'} sablon beállításait későbbi visszaállításhoz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="save-name">Mentés neve</Label>
              <Input
                id="save-name"
                placeholder="pl. Kék Szállítólevél v1"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSave}>
              <FloppyDisk className="w-4 h-4 mr-2" />
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sablon visszaállítása</DialogTitle>
            <DialogDescription>
              Válasszon egy mentett {activeTab === 'cmr' ? 'CMR' : 'Szállítólevél'} sablon beállítást a visszaállításhoz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {filteredSaves.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nincs mentett sablon ehhez a típushoz. Használja a "Mentés" gombot az aktuális beállítások mentéséhez.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {filteredSaves.map((save) => (
                  <Card key={save.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{save.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(save.timestamp).toLocaleString('hu-HU')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadHtml(save)}
                          title="HTML sablon letöltése"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportSave(save)}
                          title="Teljes sablon exportálása JSON-ként"
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRestore(save)}
                        >
                          Visszaállítás
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteSave(save.id)}
                        >
                          Törlés
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={htmlImportDialogOpen} onOpenChange={setHtmlImportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>HTML sablon importálás</DialogTitle>
            <DialogDescription>
              Illesszen be egy HTML dokumentumot a stílusok automatikus kinyeréséhez.
              A rendszer elemzi a CSS stílusokat és alkalmazza őket a sablonra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="html-import">HTML tartalom</Label>
              <Textarea
                id="html-import"
                placeholder="Illessze be a teljes HTML dokumentumot ide..."
                value={importedHtml}
                onChange={(e) => setImportedHtml(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
            <Alert>
              <AlertDescription>
                A rendszer a következő stílusokat keresi: háttérszín, szövegszín, betűméret, keretvastagság, keretszín, kerekítés, padding.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHtmlImportDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleApplyImportedHtml} disabled={!importedHtml.trim()}>
              <Upload className="w-4 h-4 mr-2" />
              Stílusok alkalmazása
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
