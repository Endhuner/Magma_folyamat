import { useState, useMemo, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { OrderDialog } from '@/components/OrderDialog'
import { OrdersTable } from '@/components/OrdersTable'
import { OrderBulkImportDialog } from '@/components/OrderBulkImportDialog'
import { Dashboard } from '@/components/Dashboard'
import { CustomersTable } from '@/components/CustomersTable'
import { CustomerDialog } from '@/components/CustomerDialog'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { ProductsTable } from '@/components/ProductsTable'
import { ProductDialog } from '@/components/ProductDialog'
import { ProductBulkImportDialog } from '@/components/ProductBulkImportDialog'
import { DeliveryNotesTable } from '@/components/DeliveryNotesTable'
import { CmrSettingsDialog } from '@/components/CmrSettingsDialog'
import { DeliverySettingsDialog } from '@/components/DeliverySettingsDialog'
import { BackupRestore } from '@/components/BackupRestore'
import { ValidationDialog } from '@/components/ValidationDialog'
import { GithubStyleTemplateEditor } from '@/components/GithubStyleTemplateEditor'
import { HtmlTemplateEditor } from '@/components/HtmlTemplateEditor'
import { TemplateBackupRestore } from '@/components/TemplateBackupRestore'
import { DocumentFilterDialog } from '@/components/DocumentFilterDialog'
import { OrderColumnFilterDialog } from '@/components/OrderColumnFilterDialog'
import { ProductionView } from '@/components/ProductionView'
import { Order, OrderStatus, Customer, Product, DeliveryNote, InventoryItem, InventoryTransaction } from '@/lib/types'
import { calculateDashboardMetrics, parseYear } from '@/lib/helpers'
import { computeAutoFieldsForOrder } from '@/lib/orderService'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { Plus, Factory, Funnel, MagnifyingGlass, Upload, ArrowCounterClockwise, X, FileText, Truck, CaretDown, CopySimple, Download } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { exportCmrAsHtml } from '@/lib/cmrHtmlTemplate'
import { exportDeliveryAsHtml, TemplateStyles } from '@/lib/deliveryHtmlTemplate'
import { validateCmrExport, validateDeliveryExport, ValidationResult } from '@/lib/exportValidation'
import { DEFAULT_DELIVERY_TEMPLATE_HTML, DEFAULT_DELIVERY_TEMPLATE_CSS } from '@/lib/defaultDeliveryTemplate'
import { generateLabels, previewLabels, LabelTemplate, exportLabelTemplate, exportMultipleLabelTemplates, generateLabelsWithPrintSettings } from '@/lib/labelTemplate'
import { generateLabelsByCustomer } from '@/lib/labelTemplate'
import { LabelTemplateDialog } from '@/components/LabelTemplateDialog'
import { LabelPrintSettingsDialog, PrintSettings } from '@/components/LabelPrintSettingsDialog'
import { InventoryTable } from '@/components/InventoryTable'
import { InventoryDialog } from '@/components/InventoryDialog'
import { InventoryAdjustDialog } from '@/components/InventoryAdjustDialog'
import { InventoryDeductionDialog } from '@/components/InventoryDeductionDialog'
import { deductInventoryForOrders, applyInventoryDeduction, InventoryDeductionResult } from '@/lib/inventoryService'

function stripDiacritics(s: string): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isDelivered(status: string): boolean {
  const st = stripDiacritics(status)
  return st === 'kiszallitva' || st.includes('kiszallitva')
}

type LastAction = 
  | { type: 'delete', orders: Order[] }
  | { type: 'edit', orderId: string, before: Order }
  | null

function App() {
  const [orders, setOrders] = useKV<Order[]>('orders', [])
  const [customers, setCustomers] = useKV<Customer[]>('customers', [])
  const [products, setProducts] = useKV<Product[]>('products', [])
  const [deliveryNotes, setDeliveryNotes] = useKV<DeliveryNote[]>('deliveryNotes', [])
  const [inventory, setInventory] = useKV<InventoryItem[]>('inventory', [])
  const [inventoryTransactions, setInventoryTransactions] = useKV<InventoryTransaction[]>('inventoryTransactions', [])
  const [customerSequences, setCustomerSequences] = useKV<Record<string, number>>('customerSequences', {})
  const [savedTemplates, setSavedTemplates] = useKV<any[]>('saved-templates', [])
  const [cmrSettings] = useKV<CmrLayoutSettings>('cmr-layout-settings', {
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
  })
  
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [orderBulkImportDialogOpen, setOrderBulkImportDialogOpen] = useState(false)
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productBulkImportDialogOpen, setProductBulkImportDialogOpen] = useState(false)
  const [cmrSettingsDialogOpen, setCmrSettingsDialogOpen] = useState(false)
  const [deliverySettingsDialogOpen, setDeliverySettingsDialogOpen] = useState(false)
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  const [currentTab, setCurrentTab] = useState('dashboard')
  
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [hideDelivered, setHideDelivered] = useState(true)
  
  const currentYear = new Date().getFullYear()
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [yearFilterEnabled, setYearFilterEnabled] = useState(true)
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [lastAction, setLastAction] = useState<LastAction>(null)
  
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('')
  
  const [validationDialogOpen, setValidationDialogOpen] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExportType, setPendingExportType] = useState<'cmr' | 'delivery' | null>(null)
  
  const [deliveryStyles] = useKV<Partial<TemplateStyles>>('delivery-html-styles', {})
  
  const [documentFilters, setDocumentFilters] = useKV<Array<{id: string, name: string, columns: string[]}>>('document-filters', [])
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [newFilterDialogOpen, setNewFilterDialogOpen] = useState(false)

  const [orderColumnFilters, setOrderColumnFilters] = useKV<Array<{id: string, name: string, columns: string[]}>>('order-column-filters', [])
  const [activeOrderFilterId, setActiveOrderFilterId] = useState<string | null>(null)
  const [newOrderFilterDialogOpen, setNewOrderFilterDialogOpen] = useState(false)

  const [labelTemplates, setLabelTemplates] = useKV<LabelTemplate[]>('label-templates', [])
  const [activeLabelTemplateId, setActiveLabelTemplateId] = useKV<string | null>('active-label-template', null)
  const [labelTemplateDialogOpen, setLabelTemplateDialogOpen] = useState(false)
  const [selectedLabelTemplate, setSelectedLabelTemplate] = useState<LabelTemplate | null>(null)
  const labelImportInputRef = useRef<HTMLInputElement>(null)

  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [inventoryAdjustDialogOpen, setInventoryAdjustDialogOpen] = useState(false)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)
  const [inventorySearchQuery, setInventorySearchQuery] = useState('')
  const [inventoryDeductionDialogOpen, setInventoryDeductionDialogOpen] = useState(false)
  const [pendingDeductionResult, setPendingDeductionResult] = useState<InventoryDeductionResult | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ orderIds: string[], status: OrderStatus } | null>(null)
  const [labelPrintSettingsDialogOpen, setLabelPrintSettingsDialogOpen] = useState(false)

  const yearOptions = useMemo(() => {
    const set = new Set<number>()
    for (const o of orders ?? []) {
      const yOrder = parseYear(o.orderDate)
      if (yOrder) set.add(yOrder)
    }
    const years = Array.from(set).sort((a, b) => b - a)
    return years
  }, [orders])
  
  useEffect(() => {
    if (yearOptions.length > 0 && selectedYears.length === 0) {
      if (yearOptions.includes(currentYear)) {
        setSelectedYears([currentYear])
      } else {
        setSelectedYears([yearOptions[0]])
      }
    }
  }, [yearOptions, selectedYears.length, currentYear])

  useEffect(() => {
    const initializeDefaultTemplates = () => {
      const deliveryTemplateName = 'Szállítólevél Sablon - 2026.03.13 12:32'
      const deliveryTemplateExists = (savedTemplates || []).some(t => t.name === deliveryTemplateName)
      
      if (!deliveryTemplateExists) {
        const newTemplateId = `template-delivery-${Date.now()}`
        const newTemplate = {
          id: newTemplateId,
          name: deliveryTemplateName,
          timestamp: new Date('2026-03-13T12:32:00').toISOString(),
          size: JSON.stringify({ html: DEFAULT_DELIVERY_TEMPLATE_HTML, css: DEFAULT_DELIVERY_TEMPLATE_CSS }).length,
          data: {
            id: newTemplateId,
            name: deliveryTemplateName,
            type: 'delivery' as const,
            html: DEFAULT_DELIVERY_TEMPLATE_HTML,
            css: DEFAULT_DELIVERY_TEMPLATE_CSS,
            timestamp: new Date('2026-03-13T12:32:00').toISOString(),
            description: 'Alapértelmezett szállítólevél sablon',
            margins: {
              top: '10',
              right: '10',
              bottom: '10',
              left: '10'
            }
          }
        }
        
        setSavedTemplates((current) => [...(current || []), newTemplate])
        console.log('✅ Szállítólevél sablon inicializálva:', deliveryTemplateName)
      }

      const cmrTemplateName = 'CMR Sablon - 2026.03.13 12:42'
      const cmrTemplateExists = (savedTemplates || []).some(t => t.name === cmrTemplateName)
      
      if (!cmrTemplateExists) {
        const DEFAULT_CMR_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMR - {{sequenceNumber}}</title>
</head>
<body>
  <div class="cmr-document">
    <div class="sequence-number">Saját rendelési szám: {{sequenceNumber}}</div>
    
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
          <strong>{{senderName}}</strong><br>
          {{senderAddress}}<br>
          {{senderCity}}, {{senderCountry}}<br>
          Adószám: {{senderTaxNumber}}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">2. Átvevő (Név, cím, ország)<br>Consignee (Name, Address, Country)</div>
        <div class="section-content">
          <strong>{{customerName}}</strong><br>
          {{customerAddress}}<br>
          {{customerCity}}, {{customerCountry}}<br>
          {{customerTaxNumber}}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">3. Az áru átvételének helye és időpontja<br>Place and date of delivery of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>{{pickupLocation}}</strong><br>
          Ország / Country: <strong>{{senderCountry}}</strong>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">4. Az áru leadásának helye és időpontja<br>Place and date of taking over of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>{{customerCity}}</strong><br>
          Ország / Country: <strong>{{customerCountry}}</strong>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">16. Carrier (Name, Address, Country)<br>Fuvarozó (Név, cím, ország)</div>
        <div class="section-content">
          {{carrierName}}<br>
          {{carrierAddress}}
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
        {{#items}}
        <tr>
          <td class="center">{{index}}</td>
          <td class="center">{{ownOrderNumber}}</td>
          <td class="center">{{quantity}}</td>
          <td>{{packaging}}</td>
          <td>{{productName}}<br><small>{{designation}}</small></td>
          <td class="right">{{weight}}</td>
        </tr>
        {{/items}}
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
          Sender / Feladó: ☐<br>
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
          <strong>{{pickupLocation}}</strong><br>
          Dátum: {{issueDate}}
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
          Rendszám / Registration number: <strong>{{vehiclePlate}}</strong>
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
</html>`

        const DEFAULT_CMR_TEMPLATE_CSS = `@page {
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
}`

        const newCmrTemplateId = `template-cmr-${Date.now()}`
        const newCmrTemplate = {
          id: newCmrTemplateId,
          name: cmrTemplateName,
          timestamp: new Date('2026-03-13T12:42:00').toISOString(),
          size: JSON.stringify({ html: DEFAULT_CMR_TEMPLATE_HTML, css: DEFAULT_CMR_TEMPLATE_CSS }).length,
          data: {
            id: newCmrTemplateId,
            name: cmrTemplateName,
            type: 'cmr' as const,
            html: DEFAULT_CMR_TEMPLATE_HTML,
            css: DEFAULT_CMR_TEMPLATE_CSS,
            timestamp: new Date('2026-03-13T12:42:00').toISOString(),
            description: 'Alapértelmezett CMR sablon',
            margins: {
              top: '10',
              right: '10',
              bottom: '10',
              left: '10'
            }
          }
        }
        
        setSavedTemplates((current) => [...(current || []), newCmrTemplate])
        console.log('✅ CMR sablon inicializálva:', cmrTemplateName)
      }
    }
    
    if (savedTemplates !== undefined) {
      initializeDefaultTemplates()
    }
  }, [savedTemplates, setSavedTemplates])

  const handleSaveOrder = (orderData: Partial<Order>) => {
    if (selectedOrder) {
      const before = orders?.find(o => o.id === selectedOrder.id)
      if (before) {
        setLastAction({ type: 'edit', orderId: selectedOrder.id, before: { ...before } })
      }
      
      setOrders((current) =>
        (current || []).map((order) =>
          order.id === selectedOrder.id ? { ...order, ...orderData } : order
        )
      )
      toast.success('Rendelés sikeresen frissítve')
    } else {
      const autoFields = computeAutoFieldsForOrder(
        orderData.customer || '',
        orderData.productName || '',
        orderData.amountPc || 0,
        products || []
      )
      
      const newOrder: Order = {
        id: Date.now().toString(),
        ...orderData,
        ...autoFields,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Order
      
      setOrders((current) => [...(current || []), newOrder])
      toast.success('Rendelés sikeresen létrehozva')
    }
    setSelectedOrder(null)
  }

  const handleEditOrder = (id: string) => {
    const order = (orders || []).find((o) => o.id === id)
    if (order) {
      setSelectedOrder(order)
      setOrderDialogOpen(true)
    }
  }

  const handleDeleteOrder = (id: string) => {
    const order = (orders || []).find(o => o.id === id)
    if (order) {
      setLastAction({ type: 'delete', orders: [order] })
    }
    setOrders((current) => (current || []).filter((o) => o.id !== id))
    toast.success('Rendelés sikeresen törölve')
  }

  const handleDuplicateOrder = (id: string) => {
    const order = (orders || []).find(o => o.id === id)
    if (!order) return

    const duplicatedOrder: Order = {
      ...order,
      id: Date.now().toString(),
      orderNumber: '',
      ownOrderNumber: '',
      deliveryNote: '',
      cmr: '',
      status: 'Felvéve',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setOrders((current) => [...(current || []), duplicatedOrder])
    toast.success('Rendelés sikeresen duplikálva')
  }

  const handleDeleteSelectedOrders = () => {
    if (selectedOrderIds.length === 0) return
    
    const deletedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    setLastAction({ type: 'delete', orders: deletedOrders })
    
    setOrders((current) => (current || []).filter(o => !selectedOrderIds.includes(o.id)))
    setSelectedOrderIds([])
    toast.success(`${deletedOrders.length} rendelés törölve`)
  }

  const handleStatusChange = (id: string, status: OrderStatus) => {
    const ordersToChange = [id]
    handleBatchStatusChange(ordersToChange, status)
  }

  const handleBatchStatusChange = (orderIds: string[], status: OrderStatus) => {
    const ordersToUpdate = (orders || []).filter(o => orderIds.includes(o.id))
    const isChangingToDelivered = isDelivered(status)
    
    if (isChangingToDelivered && ordersToUpdate.length > 0) {
      const deductionResult = deductInventoryForOrders(
        ordersToUpdate,
        inventory || [],
        products || []
      )
      
      if (deductionResult.deductedItems.length > 0 || deductionResult.failedItems.length > 0) {
        setPendingDeductionResult(deductionResult)
        setPendingStatusChange({ orderIds, status })
        setInventoryDeductionDialogOpen(true)
        return
      }
    }
    
    executeStatusChange(orderIds, status)
  }

  const executeStatusChange = (orderIds: string[], status: OrderStatus) => {
    orderIds.forEach(id => {
      const before = orders?.find(o => o.id === id)
      if (before) {
        setLastAction({ type: 'edit', orderId: id, before: { ...before } })
      }
    })
    
    setOrders((current) =>
      (current || []).map(o => 
        orderIds.includes(o.id) 
          ? { ...o, status, updatedAt: new Date().toISOString() } 
          : o
      )
    )
  }

  const handleConfirmInventoryDeduction = () => {
    if (!pendingDeductionResult || !pendingStatusChange) return
    
    const updatedInventory = applyInventoryDeduction(inventory || [], pendingDeductionResult)
    setInventory(updatedInventory)
    
    pendingDeductionResult.transactions.forEach(transaction => {
      setInventoryTransactions((current) => [...(current || []), transaction])
    })
    
    executeStatusChange(pendingStatusChange.orderIds, pendingStatusChange.status)
    
    if (pendingDeductionResult.deductedItems.length > 0) {
      toast.success(`Készlet csökkentve: ${pendingDeductionResult.deductedItems.length} tétel`)
    }
    if (pendingDeductionResult.failedItems.length > 0) {
      toast.warning(`${pendingDeductionResult.failedItems.length} tétel nem került levonásra`)
    }
    
    setInventoryDeductionDialogOpen(false)
    setPendingDeductionResult(null)
    setPendingStatusChange(null)
  }

  const handleNewOrder = () => {
    setSelectedOrder(null)
    setOrderDialogOpen(true)
  }

  const handleOrderBulkImport = (importedOrders: Partial<Order>[]) => {
    setOrders((current) => [...(current || []), ...(importedOrders as Order[])])
    toast.success(`${importedOrders.length} rendelés sikeresen importálva`)
  }

  const handleUndoLastAction = () => {
    if (!lastAction) return
    
    if (lastAction.type === 'delete') {
      setOrders((current) => [...(current || []), ...lastAction.orders])
      toast.success('Visszavonva')
      setLastAction(null)
    } else if (lastAction.type === 'edit') {
      setOrders((current) =>
        (current || []).map(o => o.id === lastAction.orderId ? lastAction.before : o)
      )
      toast.success('Visszavonva')
      setLastAction(null)
    }
  }

  const handleSaveCustomer = (customerData: Partial<Customer>) => {
    if (selectedCustomer) {
      setCustomers((current) =>
        (current || []).map((c) =>
          c.id === selectedCustomer.id ? { ...c, ...customerData } : c
        )
      )
      toast.success('Vevő sikeresen frissítve')
    } else {
      const newCustomer: Customer = {
        ...customerData,
      } as Customer
      setCustomers((current) => [...(current || []), newCustomer])
      toast.success('Vevő sikeresen létrehozva')
    }
    setSelectedCustomer(null)
  }

  const handleEditCustomer = (id: string) => {
    const customer = (customers || []).find((c) => c.id === id)
    if (customer) {
      setSelectedCustomer(customer)
      setCustomerDialogOpen(true)
    }
  }

  const handleDeleteCustomer = (id: string) => {
    setCustomers((current) => (current || []).filter((c) => c.id !== id))
    toast.success('Vevő sikeresen törölve')
  }

  const handleNewCustomer = () => {
    setSelectedCustomer(null)
    setCustomerDialogOpen(true)
  }

  const handleBulkImport = (importedCustomers: Partial<Customer>[]) => {
    setCustomers((current) => [...(current || []), ...(importedCustomers as Customer[])])
    toast.success(`${importedCustomers.length} vevő sikeresen importálva`)
  }

  const handleSaveProduct = (productData: Partial<Product>) => {
    if (selectedProduct) {
      setProducts((current) =>
        (current || []).map((p) =>
          p.id === selectedProduct.id ? { ...p, ...productData } : p
        )
      )
      toast.success('Termék sikeresen frissítve')
    } else {
      const newProduct: Product = {
        id: `product-${Date.now()}`,
        ...productData,
      } as Product
      setProducts((current) => [...(current || []), newProduct])
      toast.success('Termék sikeresen létrehozva')
    }
    setSelectedProduct(null)
  }

  const handleEditProduct = (id: string) => {
    const product = (products || []).find((p) => p.id === id)
    if (product) {
      setSelectedProduct(product)
      setProductDialogOpen(true)
    }
  }

  const handleDeleteProduct = (id: string) => {
    setProducts((current) => (current || []).filter((p) => p.id !== id))
    toast.success('Termék sikeresen törölve')
  }

  const handleNewProduct = () => {
    setSelectedProduct(null)
    setProductDialogOpen(true)
  }

  const handleProductBulkImport = (importedProducts: Partial<Product>[]) => {
    setProducts((current) => [...(current || []), ...(importedProducts as Product[])])
    toast.success(`${importedProducts.length} termék sikeresen importálva`)
  }

  const handleDeleteDeliveryNote = (id: string) => {
    setDeliveryNotes((current) => (current || []).filter((dn) => dn.id !== id))
    toast.success('Szállítólevél sikeresen törölve')
  }

  const handleUpdateDeliveryNote = (id: string, updatedData: Record<string, string | number | null | undefined>[]) => {
    setDeliveryNotes((current) =>
      (current || []).map((dn) =>
        dn.id === id ? { ...dn, exportData: updatedData, updatedAt: new Date().toISOString() } : dn
      )
    )
    toast.success('Szállítólevél sikeresen frissítve')
  }

  const handleExportDelivery = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }

    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    const validation = validateDeliveryExport(selectedOrders, customers || [], products || [])
    
    if (!validation.isValid || validation.warnings.length > 0) {
      setValidationResult(validation)
      setPendingExportType('delivery')
      setValidationDialogOpen(true)
      return
    }

    await executeDeliveryExport()
  }
  
  const executeDeliveryExport = async () => {
    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    await exportDeliveryAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const newNote = {
          ...deliveryNote,
          id: Date.now().toString(),
          sequenceNumber: sequenceNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setDeliveryNotes((current) => [...(current || []), newNote as any])

        if (sequenceNumber) {
          const orderIdsToUpdate = selectedOrders.map(o => o.id)
          setOrders((current) =>
            (current || []).map(o =>
              orderIdsToUpdate.includes(o.id)
                ? { ...o, deliveryNote: sequenceNumber, updatedAt: new Date().toISOString() }
                : o
            )
          )
        }
      },
      deliveryStyles
    )
  }

  const handleExportCmr = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }

    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    const validation = validateCmrExport(selectedOrders, customers || [], products || [], cmrSettings)
    
    if (!validation.isValid || validation.warnings.length > 0) {
      setValidationResult(validation)
      setPendingExportType('cmr')
      setValidationDialogOpen(true)
      return
    }

    await executeCmrExport()
  }
  
  const executeCmrExport = async () => {
    const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
    
    await exportCmrAsHtml(
      selectedOrders,
      customers || [],
      products || [],
      deliveryNotes || [],
      (deliveryNote, sequenceNumber) => {
        const newNote = {
          ...deliveryNote,
          id: Date.now().toString(),
          sequenceNumber: sequenceNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setDeliveryNotes((current) => [...(current || []), newNote as any])

        if (sequenceNumber) {
          const orderIdsToUpdate = selectedOrders.map(o => o.id)
          setOrders((current) =>
            (current || []).map(o =>
              orderIdsToUpdate.includes(o.id)
                ? { ...o, cmr: sequenceNumber, updatedAt: new Date().toISOString() }
                : o
            )
          )
        }
      },
      cmrSettings
    )
  }
  
  const handleValidationContinue = async () => {
    setValidationDialogOpen(false)
    
    if (pendingExportType === 'cmr') {
      await executeCmrExport()
    } else if (pendingExportType === 'delivery') {
      await executeDeliveryExport()
    }
    
    setPendingExportType(null)
    setValidationResult(null)
  }

  const activeOrders = useMemo(() => {
    let filtered = orders || []
    
    if (hideDelivered) {
      filtered = filtered.filter(o => !isDelivered(o.status))
    }
    
    if (yearFilterEnabled && selectedYears.length > 0 && yearOptions.length > 0) {
      const yearSet = new Set(selectedYears)
      filtered = filtered.filter(o => {
        const yOrder = parseYear(o.orderDate)
        return yOrder != null && yearSet.has(yOrder)
      })
    }
    
    return filtered
  }, [orders, hideDelivered, selectedYears, yearOptions.length, yearFilterEnabled])

  const filteredOrders = useMemo(() => {
    let filtered = activeOrders
    
    const query = stripDiacritics(orderSearchQuery)
    if (query) {
      filtered = filtered.filter(o =>
        stripDiacritics(o.productName).includes(query) ||
        stripDiacritics(o.orderNumber).includes(query) ||
        stripDiacritics(o.customer).includes(query) ||
        stripDiacritics(o.designation).includes(query) ||
        stripDiacritics(o.notes).includes(query) ||
        stripDiacritics(o.material).includes(query)
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }
    
    return filtered
  }, [activeOrders, orderSearchQuery, statusFilter])

  const filteredCustomers = (customers || []).filter((customer) => {
    const query = customerSearchQuery.toLowerCase()
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.city.toLowerCase().includes(query) ||
      customer.country.toLowerCase().includes(query) ||
      customer.taxNumber.toLowerCase().includes(query) ||
      customer.postalCode.toLowerCase().includes(query)
    )
  })

  const filteredProducts = (products || []).filter((product) => {
    const query = productSearchQuery.toLowerCase()
    return (
      product.customer.toLowerCase().includes(query) ||
      product.productName.toLowerCase().includes(query) ||
      product.drawingNumber.toLowerCase().includes(query) ||
      product.articleNumber.toLowerCase().includes(query) ||
      product.material.toLowerCase().includes(query)
    )
  })

  const dashboardFilteredOrders = (orders || []).filter((order) => {
    if (!dashboardSearchQuery) return true
    const query = dashboardSearchQuery.toLowerCase()
    return (
      order.productName.toLowerCase().includes(query) ||
      order.orderNumber.toLowerCase().includes(query) ||
      order.customer.toLowerCase().includes(query)
    )
  })

  const metrics = calculateDashboardMetrics(dashboardFilteredOrders)

  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year))
    } else {
      setSelectedYears([...selectedYears, year])
    }
  }

  const handleFilterByStatus = (status: OrderStatus | 'all') => {
    setCurrentTab('orders')
    setStatusFilter(status)
    setHideDelivered(false)
  }

  const activeWorkCount = useMemo(() => {
    return filteredOrders.filter(o => 
      o.status === 'Folyamatban' || 
      o.status === 'Előkészítve' || 
      o.status === 'Csomagolás alatt'
    ).length
  }, [filteredOrders])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Factory className="w-8 h-8" weight="duotone" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">ProduktívPro</h1>
                <p className="text-sm text-muted-foreground">Termelés Irányítási Rendszer</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Aktív Munkák</p>
              <p className="text-3xl font-bold font-mono text-accent">{activeWorkCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto px-6 py-8">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
          <div className="flex items-center gap-3">
            <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-6 md:grid-cols-6">
              <TabsTrigger value="dashboard">Áttekintés</TabsTrigger>
              <TabsTrigger value="production">Gyártás</TabsTrigger>
              <TabsTrigger value="orders">Rendelések</TabsTrigger>
              <TabsTrigger value="customers">Vevők</TabsTrigger>
              <TabsTrigger value="products">Termékek</TabsTrigger>
              <TabsTrigger value="inventory">Készlet</TabsTrigger>
            </TabsList>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Dokumentumok
                  <CaretDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setCurrentTab('github-editor')}>
                  Sablon Szerkesztő
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCurrentTab('template-saves')}>
                  Sablon Mentések
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCurrentTab('label-templates')}>
                  Címke Sablonok
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="font-semibold text-foreground opacity-100">
                  Dokumentum készítése
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCurrentTab('orders')} className="pl-6">
                  Szállítólevelek készítése
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCurrentTab('documents')}>
                  Dokumentumok
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCurrentTab('saves')}>
                  Mentések
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Keresés rendelések között..."
                value={dashboardSearchQuery}
                onChange={(e) => setDashboardSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Dashboard metrics={metrics} onFilterByStatus={handleFilterByStatus} />

            {(orders || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Factory className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
                <h3 className="text-xl font-semibold mb-2">Nincs rendelés</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Kezdje el az új rendelés létrehozásával a termelés nyomon követéséhez
                </p>
                <Button onClick={handleNewOrder}>
                  <Plus className="w-5 h-5 mr-2" />
                  Első Rendelés Létrehozása
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <ProductionView
              orders={orders || []}
              products={products || []}
              onStatusChange={handleStatusChange}
              onEdit={handleEditOrder}
            />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6 pb-32">
            <div className="bg-card border rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="hide-delivered"
                      checked={hideDelivered}
                      onCheckedChange={setHideDelivered}
                    />
                    <Label htmlFor="hide-delivered" className="cursor-pointer text-sm">
                      Kiszállítva elrejtése
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="year-filter"
                      checked={yearFilterEnabled}
                      onCheckedChange={setYearFilterEnabled}
                    />
                    <Label htmlFor="year-filter" className="cursor-pointer text-sm">
                      Évszám szűrés
                    </Label>
                  </div>

                  {yearFilterEnabled && yearOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Év:</span>
                      <div className="flex gap-2 flex-wrap">
                        {yearOptions.map(year => (
                          <Badge
                            key={year}
                            variant={selectedYears.includes(year) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => toggleYear(year)}
                          >
                            {year}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  {filteredOrders.length} / {(orders || []).length} rendelés
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Keresés (csak aktív sorokban)"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'all')}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Funnel className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Összes státusz</SelectItem>
                    <SelectItem value="Felvéve">Felvéve</SelectItem>
                    <SelectItem value="Szünetel">Szünetel</SelectItem>
                    <SelectItem value="Kiszállítva">Kiszállítva</SelectItem>
                    <SelectItem value="Csomagolás alatt">Csomagolás alatt</SelectItem>
                    <SelectItem value="Folyamatban">Folyamatban</SelectItem>
                    <SelectItem value="Előkészítve">Előkészítve</SelectItem>
                    <SelectItem value="Javítás alatt">Javítás alatt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button onClick={handleNewOrder}>
                  <Plus className="w-5 h-5 mr-2" />
                  Új rendelés
                </Button>
                <Button variant="secondary" onClick={() => setOrderBulkImportDialogOpen(true)}>
                  <Upload className="w-5 h-5 mr-2" />
                  Tömeges Import
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Funnel className="w-4 h-4" />
                      {activeOrderFilterId 
                        ? orderColumnFilters?.find(f => f.id === activeOrderFilterId)?.name || 'Oszlop szűrő'
                        : 'Oszlop szűrő'}
                      <CaretDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onSelect={() => setActiveOrderFilterId(null)}>
                      Összes oszlop (alapértelmezett)
                    </DropdownMenuItem>
                    {(orderColumnFilters || []).map(filter => (
                      <DropdownMenuItem key={filter.id} onSelect={() => setActiveOrderFilterId(filter.id)}>
                        {filter.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button variant="secondary" onClick={() => setNewOrderFilterDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Új szűrő
                </Button>
                
                {activeOrderFilterId && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setOrderColumnFilters((current) => (current || []).filter(f => f.id !== activeOrderFilterId))
                      setActiveOrderFilterId(null)
                      toast.success('Szűrő törölve')
                    }}
                  >
                    Szűrő törlése
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                {selectedOrderIds.length > 0 && (
                  <>
                    <Button variant="default" onClick={handleExportDelivery} className="bg-accent text-accent-foreground">
                      <Truck className="w-5 h-5 mr-2" />
                      Szállító (HTML)
                    </Button>
                    <Button variant="default" onClick={handleExportCmr} className="bg-secondary text-secondary-foreground">
                      <FileText className="w-5 h-5 mr-2" />
                      CMR (HTML)
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <FileText className="w-4 h-4" />
                          Dokumentáció készítés
                          <CaretDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled className="font-semibold text-foreground opacity-100">
                          Címke készítés
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setLabelPrintSettingsDialogOpen(true)} className="pl-6">
                          Címkék nyomtatása (beállítások)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
                          generateLabels(selectedOrders, customers || [], products || [], activeTemplate)
                        }} className="pl-6">
                          Címkék generálása (HTML)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={async () => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          await generateLabelsByCustomer(selectedOrders, customers || [], products || [])
                        }} className="pl-6">
                          Címkék vevőnként (külön fájlok)
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="font-semibold text-foreground opacity-100">
                          Export formátumok
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={async () => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
                          const { exportLabelsAsPDF } = await import('@/lib/labelExportFormats')
                          await exportLabelsAsPDF(selectedOrders, customers || [], products || [], activeTemplate)
                        }} className="pl-6">
                          Export PDF-be
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={async () => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
                          const { exportLabelsAsPNG } = await import('@/lib/labelExportFormats')
                          await exportLabelsAsPNG(selectedOrders, customers || [], products || [], activeTemplate)
                        }} className="pl-6">
                          Export PNG-be
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={async () => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          const { exportLabelsAsCSV } = await import('@/lib/labelExportFormats')
                          exportLabelsAsCSV(selectedOrders, customers || [], products || [])
                        }} className="pl-6">
                          Export CSV-be
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={async () => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          const { exportLabelsAsExcel } = await import('@/lib/labelExportFormats')
                          await exportLabelsAsExcel(selectedOrders, customers || [], products || [])
                        }} className="pl-6">
                          Export Excel-be
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={async () => {
                          if (selectedOrderIds.length === 0) {
                            toast.error('Nincsenek kiválasztott rendelések')
                            return
                          }
                          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
                          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
                          const html = await previewLabels(selectedOrders, customers || [], products || [], activeTemplate)
                          const win = window.open('', '_blank')
                          if (win) {
                            win.document.write(html)
                            win.document.close()
                          }
                        }} className="pl-6">
                          Előnézet megnyitása
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setCurrentTab('label-templates')} className="pl-6">
                          Címke sablon kezelése
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          toast.info('Szállítási dokumentumok - hamarosan')
                        }}>
                          Szállítási dokumentumok készítése
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                {lastAction && (
                  <Button variant="secondary" onClick={handleUndoLastAction}>
                    <ArrowCounterClockwise className="w-5 h-5 mr-2" />
                    Undo
                  </Button>
                )}
                {selectedOrderIds.length > 0 && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default">
                          Státusz váltása ({selectedOrderIds.length})
                          <CaretDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Felvéve')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Felvéve`)
                        }}>
                          Felvéve
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Folyamatban')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Folyamatban`)
                        }}>
                          Folyamatban
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Előkészítve')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Előkészítve`)
                        }}>
                          Előkészítve
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Csomagolás alatt')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Csomagolás alatt`)
                        }}>
                          Csomagolás alatt
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Kiszállítva')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Kiszállítva`)
                        }}>
                          Kiszállítva
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Szünetel')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Szünetel`)
                        }}>
                          Szünetel
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          handleBatchStatusChange(selectedOrderIds, 'Javítás alatt')
                          toast.success(`${selectedOrderIds.length} rendelés státusza: Javítás alatt`)
                        }}>
                          Javítás alatt
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="secondary" onClick={() => setSelectedOrderIds([])}>
                      <X className="w-5 h-5 mr-2" />
                      Kijelölés törlése
                    </Button>
                    <Button variant="secondary" onClick={handleEditOrder.bind(null, selectedOrderIds[0])} disabled={selectedOrderIds.length !== 1}>
                      Kijelölt szerkesztése
                    </Button>
                    <Button variant="secondary" onClick={handleDuplicateOrder.bind(null, selectedOrderIds[0])} disabled={selectedOrderIds.length !== 1}>
                      <CopySimple className="w-5 h-5 mr-2" />
                      Kijelölt duplikálása
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteSelectedOrders}>
                      Kijelöltek törlése ({selectedOrderIds.length})
                    </Button>
                  </>
                )}
              </div>
            </div>

            <OrdersTable
              orders={filteredOrders}
              products={products || []}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
              onDuplicate={handleDuplicateOrder}
              onStatusChange={handleStatusChange}
              selectedIds={selectedOrderIds}
              onSelectionChange={setSelectedOrderIds}
              visibleColumns={activeOrderFilterId 
                ? orderColumnFilters?.find(f => f.id === activeOrderFilterId)?.columns 
                : undefined}
            />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Vevők</h2>
                <p className="text-muted-foreground">Vevői adatok kezelése</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setBulkImportDialogOpen(true)}>
                  <Upload className="w-5 h-5 mr-2" />
                  Tömeges Import
                </Button>
                <Button onClick={handleNewCustomer}>
                  <Plus className="w-5 h-5 mr-2" />
                  Új Vevő
                </Button>
              </div>
            </div>

            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Keresés név, város, ország, irányítószám vagy adószám szerint..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <CustomersTable
              customers={filteredCustomers}
              orders={orders || []}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
            />
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Termékek</h2>
                <p className="text-muted-foreground">Termék adatok kezelése</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setProductBulkImportDialogOpen(true)}>
                  <Upload className="w-5 h-5 mr-2" />
                  Tömeges Import
                </Button>
                <Button onClick={handleNewProduct}>
                  <Plus className="w-5 h-5 mr-2" />
                  Új Termék
                </Button>
              </div>
            </div>

            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Keresés ügyfél, termék név, rajzszám, cikkszám vagy anyag szerint..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ProductsTable
              products={filteredProducts}
              orders={orders || []}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
            />
          </TabsContent>

          <TabsContent value="github-editor" className="space-y-6">
            <GithubStyleTemplateEditor />
          </TabsContent>

          <TabsContent value="template-saves" className="space-y-6">
            <TemplateBackupRestore />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Dokumentumok</h2>
                <p className="text-muted-foreground">Létrehozott szállítólevelek és CMR dokumentumok</p>
              </div>
              
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Funnel className="w-4 h-4" />
                      {activeFilterId 
                        ? documentFilters?.find(f => f.id === activeFilterId)?.name || 'Szűrő választás'
                        : 'Szűrő választás'}
                      <CaretDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => setActiveFilterId(null)}>
                      Összes oszlop (alapértelmezett)
                    </DropdownMenuItem>
                    {(documentFilters || []).map(filter => (
                      <DropdownMenuItem key={filter.id} onSelect={() => setActiveFilterId(filter.id)}>
                        {filter.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button variant="secondary" onClick={() => setNewFilterDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Új szűrő
                </Button>
                
                {activeFilterId && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setDocumentFilters((current) => (current || []).filter(f => f.id !== activeFilterId))
                      setActiveFilterId(null)
                      toast.success('Szűrő törölve')
                    }}
                  >
                    Szűrő törlése
                  </Button>
                )}
              </div>
            </div>

            <DeliveryNotesTable
              deliveryNotes={deliveryNotes || []}
              orders={orders || []}
              customers={customers || []}
              products={products || []}
              onDelete={handleDeleteDeliveryNote}
              onUpdate={handleUpdateDeliveryNote}
              visibleColumns={activeFilterId 
                ? documentFilters?.find(f => f.id === activeFilterId)?.columns 
                : undefined}
            />
          </TabsContent>

          <TabsContent value="saves" className="space-y-6">
            <BackupRestore />
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">Szállítólevelek</h2>
              <p className="text-muted-foreground">Létrehozott szállítólevelek és CMR dokumentumok</p>
            </div>

            <DeliveryNotesTable
              deliveryNotes={deliveryNotes || []}
              orders={orders || []}
              customers={customers || []}
              products={products || []}
              onDelete={handleDeleteDeliveryNote}
              onUpdate={handleUpdateDeliveryNote}
            />
          </TabsContent>

          <TabsContent value="label-templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Címke Sablonok</h2>
                <p className="text-muted-foreground">Címke sablonok kezelése és testreszabása</p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={labelImportInputRef}
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const { importMultipleLabelTemplates } = await import('@/lib/labelTemplate')
                      const imported = await importMultipleLabelTemplates(file)
                      setLabelTemplates((current) => [...(current || []), ...imported])
                      toast.success(`${imported.length} címke sablon importálva`)
                    } catch (error) {
                      console.error('Import error:', error)
                      toast.error('Hiba az importálás során')
                    }
                    if (labelImportInputRef.current) {
                      labelImportInputRef.current.value = ''
                    }
                  }}
                  className="hidden"
                />
                <Button variant="secondary" onClick={() => labelImportInputRef.current?.click()}>
                  <Upload className="w-5 h-5 mr-2" />
                  Importálás
                </Button>
                {(labelTemplates || []).length > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      exportMultipleLabelTemplates(labelTemplates || [])
                    }}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Összes Exportálása
                  </Button>
                )}
                <Button onClick={() => {
                  setSelectedLabelTemplate(null)
                  setLabelTemplateDialogOpen(true)
                }}>
                  <Plus className="w-5 h-5 mr-2" />
                  Új Sablon
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(labelTemplates || []).map((template) => (
                <div
                  key={template.id}
                  className={`border rounded-lg p-4 space-y-3 cursor-pointer transition-all ${
                    activeLabelTemplateId === template.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setActiveLabelTemplateId(template.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                    </div>
                    {activeLabelTemplateId === template.id && (
                      <Badge variant="default" className="ml-2">Aktív</Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{template.labelsPerPage || 40} címke / oldal</p>
                    <p>{template.labelsPerRow || 5} × {template.labelsPerColumn || 8} elrendezés</p>
                    <p className="font-mono">
                      Margók: {template.margins.top}/{template.margins.right}/{template.margins.bottom}/{template.margins.left} mm
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedLabelTemplate(template)
                        setLabelTemplateDialogOpen(true)
                      }}
                    >
                      Szerkesztés
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const demoOrders = orders?.slice(0, 3) || []
                        if (demoOrders.length === 0) {
                          toast.info('Nincs rendelés az előnézethez')
                          return
                        }
                        const html = await previewLabels(demoOrders, customers || [], products || [], template)
                        const win = window.open('', '_blank')
                        if (win) {
                          win.document.write(html)
                          win.document.close()
                        }
                      }}
                    >
                      Előnézet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        const copiedTemplate: LabelTemplate = {
                          ...template,
                          id: `label-template-${Date.now()}`,
                          name: `${template.name} (másolat)`,
                          timestamp: new Date().toISOString()
                        }
                        setLabelTemplates((current) => [...(current || []), copiedTemplate])
                        toast.success('Sablon másolva')
                      }}
                    >
                      Másolás
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveLabelTemplateId(template.id)
                        toast.success(`${template.name} beállítva aktívként`)
                      }}
                    >
                      Aktiválás
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        exportLabelTemplate(template)
                      }}
                    >
                      Exportálás
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (activeLabelTemplateId === template.id) {
                          setActiveLabelTemplateId(null)
                        }
                        setLabelTemplates((current) =>
                          (current || []).filter((t) => t.id !== template.id)
                        )
                        toast.success('Sablon törölve')
                      }}
                    >
                      Törlés
                    </Button>
                  </div>
                </div>
              ))}

              {(labelTemplates || []).length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
                  <FileText className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
                  <h3 className="text-xl font-semibold mb-2">Nincs címke sablon</h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Hozz létre egyedi címke sablonokat a termékek címkézéséhez
                  </p>
                  <Button onClick={() => setLabelTemplateDialogOpen(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Első Sablon Létrehozása
                  </Button>
                </div>
              )}
            </div>

            {activeLabelTemplateId && (
              <div className="border rounded-lg p-4 bg-accent/10">
                <p className="text-sm font-medium">
                  Aktív sablon:{' '}
                  <span className="font-bold">
                    {labelTemplates?.find((t) => t.id === activeLabelTemplateId)?.name || 'Alapértelmezett'}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ez a sablon lesz használva a címkék generálásakor a rendelésekben
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Készlet</h2>
                <p className="text-muted-foreground">Termék készlet nyilvántartás</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => {
                  setSelectedInventoryItem(null)
                  setInventoryDialogOpen(true)
                }}>
                  <Plus className="w-5 h-5 mr-2" />
                  Új tétel
                </Button>
              </div>
            </div>

            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Keresés rajzszám, termék név vagy vevő szerint..."
                value={inventorySearchQuery}
                onChange={(e) => setInventorySearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <InventoryTable
              inventory={(inventory || []).filter(item => {
                if (!inventorySearchQuery) return true
                const query = inventorySearchQuery.toLowerCase()
                return (
                  item.drawingNumber.toLowerCase().includes(query) ||
                  item.productName.toLowerCase().includes(query) ||
                  item.customer.toLowerCase().includes(query)
                )
              })}
              products={products || []}
              orders={orders || []}
              onEdit={(id) => {
                const item = inventory?.find(i => i.id === id)
                if (item) {
                  setSelectedInventoryItem(item)
                  setInventoryDialogOpen(true)
                }
              }}
              onDelete={(id) => {
                setInventory((current) => (current || []).filter(i => i.id !== id))
                toast.success('Készlet tétel törölve')
              }}
              onAdjust={(id) => {
                const item = inventory?.find(i => i.id === id)
                if (item) {
                  setSelectedInventoryItem(item)
                  setInventoryAdjustDialogOpen(true)
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <InventoryDialog
        open={inventoryDialogOpen}
        onClose={() => {
          setInventoryDialogOpen(false)
          setSelectedInventoryItem(null)
        }}
        onSave={(itemData) => {
          if (selectedInventoryItem) {
            setInventory((current) =>
              (current || []).map((item) =>
                item.id === selectedInventoryItem.id ? { ...item, ...itemData } : item
              )
            )
            toast.success('Készlet tétel frissítve')
          } else {
            const newItem: InventoryItem = {
              id: `inv-${Date.now()}`,
              ...itemData,
              createdAt: new Date().toISOString(),
            } as InventoryItem
            setInventory((current) => [...(current || []), newItem])
            toast.success('Készlet tétel létrehozva')
          }
        }}
        item={selectedInventoryItem}
        products={products || []}
      />

      <InventoryAdjustDialog
        open={inventoryAdjustDialogOpen}
        onClose={() => {
          setInventoryAdjustDialogOpen(false)
          setSelectedInventoryItem(null)
        }}
        onSave={(adjustment) => {
          if (!selectedInventoryItem) return

          const transaction: InventoryTransaction = {
            id: `trans-${Date.now()}`,
            inventoryItemId: selectedInventoryItem.id,
            type: adjustment.type,
            quantity: adjustment.quantity,
            notes: adjustment.notes,
            createdAt: new Date().toISOString(),
          }

          setInventoryTransactions((current) => [...(current || []), transaction])

          setInventory((current) =>
            (current || []).map((item) => {
              if (item.id !== selectedInventoryItem.id) return item

              let newQuantity = item.quantity
              if (adjustment.type === 'in') {
                newQuantity += adjustment.quantity
              } else if (adjustment.type === 'out') {
                newQuantity = Math.max(0, newQuantity - adjustment.quantity)
              } else if (adjustment.type === 'adjustment') {
                newQuantity = adjustment.quantity
              }

              return {
                ...item,
                quantity: newQuantity,
                lastUpdated: new Date().toISOString(),
              }
            })
          )

          toast.success('Készlet módosítva')
        }}
        item={selectedInventoryItem}
      />

      <OrderDialog
        open={orderDialogOpen}
        onClose={() => {
          setOrderDialogOpen(false)
          setSelectedOrder(null)
        }}
        onSave={handleSaveOrder}
        order={selectedOrder}
        customers={customers || []}
        products={products || []}
        orders={orders || []}
      />

      <OrderBulkImportDialog
        open={orderBulkImportDialogOpen}
        onClose={() => setOrderBulkImportDialogOpen(false)}
        onImport={handleOrderBulkImport}
      />

      <CustomerDialog
        open={customerDialogOpen}
        onClose={() => {
          setCustomerDialogOpen(false)
          setSelectedCustomer(null)
        }}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
        savedTemplates={savedTemplates?.map(t => t.data).filter(Boolean) || []}
        labelTemplates={labelTemplates || []}
      />

      <BulkImportDialog
        open={bulkImportDialogOpen}
        onClose={() => setBulkImportDialogOpen(false)}
        onImport={handleBulkImport}
      />

      <ProductDialog
        open={productDialogOpen}
        onClose={() => {
          setProductDialogOpen(false)
          setSelectedProduct(null)
        }}
        onSave={handleSaveProduct}
        product={selectedProduct}
      />

      <ProductBulkImportDialog
        open={productBulkImportDialogOpen}
        onClose={() => setProductBulkImportDialogOpen(false)}
        onImport={handleProductBulkImport}
      />

      <CmrSettingsDialog
        open={cmrSettingsDialogOpen}
        onClose={() => setCmrSettingsDialogOpen(false)}
      />

      <DeliverySettingsDialog
        open={deliverySettingsDialogOpen}
        onClose={() => setDeliverySettingsDialogOpen(false)}
      />

      <ValidationDialog
        open={validationDialogOpen}
        onClose={() => {
          setValidationDialogOpen(false)
          setPendingExportType(null)
          setValidationResult(null)
        }}
        onContinue={handleValidationContinue}
        validation={validationResult || { isValid: true, errors: [], warnings: [] }}
        title={pendingExportType === 'cmr' ? 'CMR Export Ellenőrzés' : 'Szállítólevél Export Ellenőrzés'}
        orders={(orders || []).filter(o => selectedOrderIds.includes(o.id))}
        onEditOrder={handleEditOrder}
        onEditSettings={() => {
          if (pendingExportType === 'cmr') {
            setCmrSettingsDialogOpen(true)
          } else if (pendingExportType === 'delivery') {
            setDeliverySettingsDialogOpen(true)
          }
        }}
        exportType={pendingExportType || undefined}
      />

      <DocumentFilterDialog
        open={newFilterDialogOpen}
        onClose={() => setNewFilterDialogOpen(false)}
        onSave={(filter) => {
          const newFilter = {
            id: Date.now().toString(),
            ...filter,
          }
          setDocumentFilters((current) => [...(current || []), newFilter])
          toast.success(`Szűrő "${filter.name}" létrehozva`)
        }}
      />

      <OrderColumnFilterDialog
        open={newOrderFilterDialogOpen}
        onClose={() => setNewOrderFilterDialogOpen(false)}
        onSave={(filter) => {
          const newFilter = {
            id: Date.now().toString(),
            ...filter,
          }
          setOrderColumnFilters((current) => [...(current || []), newFilter])
          setActiveOrderFilterId(newFilter.id)
          toast.success(`Oszlop szűrő "${filter.name}" létrehozva és aktiválva`)
        }}
      />

      <LabelTemplateDialog
        open={labelTemplateDialogOpen}
        onClose={() => {
          setLabelTemplateDialogOpen(false)
          setSelectedLabelTemplate(null)
        }}
        onSave={(template) => {
          if (selectedLabelTemplate) {
            setLabelTemplates((current) =>
              (current || []).map((t) =>
                t.id === selectedLabelTemplate.id ? template : t
              )
            )
            toast.success('Sablon frissítve')
          } else {
            setLabelTemplates((current) => [...(current || []), template])
            toast.success('Sablon létrehozva')
          }
          setLabelTemplateDialogOpen(false)
          setSelectedLabelTemplate(null)
        }}
        template={selectedLabelTemplate || undefined}
        onPreview={async (template) => {
          if (selectedOrderIds.length === 0) {
            const demoOrders = orders?.slice(0, 3) || []
            if (demoOrders.length === 0) {
              toast.info('Nincs rendelés az előnézethez')
              return
            }
            const html = await previewLabels(demoOrders, customers || [], products || [], template)
            const win = window.open('', '_blank')
            if (win) {
              win.document.write(html)
              win.document.close()
            }
          } else {
            const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
            const html = await previewLabels(selectedOrders, customers || [], products || [], template)
            const win = window.open('', '_blank')
            if (win) {
              win.document.write(html)
              win.document.close()
            }
          }
        }}
      />

      <InventoryDeductionDialog
        open={inventoryDeductionDialogOpen}
        onClose={() => {
          setInventoryDeductionDialogOpen(false)
          setPendingDeductionResult(null)
          setPendingStatusChange(null)
        }}
        onConfirm={handleConfirmInventoryDeduction}
        deductionResult={pendingDeductionResult}
      />

      <LabelPrintSettingsDialog
        open={labelPrintSettingsDialogOpen}
        onClose={() => setLabelPrintSettingsDialogOpen(false)}
        onPrint={async (printSettings) => {
          if (selectedOrderIds.length === 0) {
            toast.error('Nincsenek kiválasztott rendelések')
            return
          }
          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
          await generateLabelsWithPrintSettings(
            selectedOrders,
            customers || [],
            products || [],
            activeTemplate,
            printSettings
          )
        }}
        defaultCopies={1}
      />
    </div>
  )
}

export default App
