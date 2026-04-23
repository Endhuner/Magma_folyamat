import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash, Play, Download, Copy, ArrowsOutCardinal, TextAlignLeft, TextAlignCenter, TextAlignRight, FileArrowDown, Package, MagnifyingGlass } from '@phosphor-icons/react'
import { toast } from 'sonner'
import * as ExcelJS from 'exceljs'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { exportOrdersWithExcelJSTemplate } from '@/lib/exceljsTemplateExport'

type CellAlignment = 'left' | 'center' | 'right'
type CellVerticalAlignment = 'top' | 'middle' | 'bottom'
type CellType = 'static' | 'variable' | 'formula' | 'header'

interface CellConfig {
  id: string
  cell: string
  value: string
  type: CellType
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  alignment?: CellAlignment
  verticalAlignment?: CellVerticalAlignment
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

const AVAILABLE_VARIABLES = {
  delivery: [
    '{{sequenceNumber}}',
    '{{customerName}}',
    '{{customerAddress}}',
    '{{customerCity}}',
    '{{customerCountry}}',
    '{{customerTaxNumber}}',
    '{{senderName}}',
    '{{senderAddress}}',
    '{{currentDate}}',
    '{{productName}}',
    '{{designation}}',
    '{{amountPc}}',
    '{{boxesCount}}',
    '{{palletsCount}}',
    '{{grossWeight}}',
    '{{material}}',
    '{{surfaceTreatment}}',
    '{{totalAmount}}',
    '{{totalBoxes}}',
    '{{totalPallets}}',
    '{{totalWeight}}',
  ],
  cmr: [
    '{{sequenceNumber}}',
    '{{customerName}}',
    '{{customerAddress}}',
    '{{customerCity}}',
    '{{customerCountry}}',
    '{{customerTaxNumber}}',
    '{{customerPostalCode}}',
    '{{senderName}}',
    '{{senderAddress}}',
    '{{senderCity}}',
    '{{senderCountry}}',
    '{{senderTaxNumber}}',
    '{{senderPhone}}',
    '{{senderEmail}}',
    '{{placeOfTakingOver}}',
    '{{placeIssued}}',
    '{{currentDate}}',
    '{{carrierName}}',
    '{{carrierAddress}}',
    '{{vehiclePlate}}',
    '{{productName}}',
    '{{designation}}',
    '{{packagingMethod}}',
    '{{amountPc}}',
    '{{boxesCount}}',
    '{{palletsCount}}',
    '{{grossWeight}}',
    '{{material}}',
    '{{surfaceTreatment}}',
    '{{totalAmount}}',
    '{{totalBoxes}}',
    '{{totalPallets}}',
    '{{totalWeight}}',
  ]
}

interface ExcelJSEditorProps {
  orders?: Order[]
  customers?: Customer[]
  products?: Product[]
  deliveryNotes?: DeliveryNote[]
  selectedOrderIds?: string[]
  cmrSettings?: any
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void
}

export function ExcelJSEditor({
  orders = [],
  customers = [],
  products = [],
  deliveryNotes = [],
  selectedOrderIds = [],
  cmrSettings,
  onExportSaved
}: ExcelJSEditorProps = {}) {
  const [templates, setTemplates] = useKV<ExcelJSTemplate[]>('exceljs-templates', [])
  const [currentTemplate, setCurrentTemplate] = useState<ExcelJSTemplate | null>(null)
  const [selectedCell, setSelectedCell] = useState<CellConfig | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [templateForExport, setTemplateForExport] = useState<ExcelJSTemplate | null>(null)
  const [orderSelectionDialogOpen, setOrderSelectionDialogOpen] = useState(false)
  const [localSelectedOrderIds, setLocalSelectedOrderIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  const [newCellAddress, setNewCellAddress] = useState('')
  const [newCellValue, setNewCellValue] = useState('')
  const [newCellType, setNewCellType] = useState<CellType>('static')

  const createDefaultCmrTemplate = (): ExcelJSTemplate => {
    return {
      id: `template-${Date.now()}`,
      name: 'CMR Alapértelmezett Sablon',
      type: 'cmr',
      description: 'Nemzetközi Fuvarlevél (CMR) - Az aktuális cmrDirectExport.ts alapján',
      sheetName: 'CMR',
      cells: [
        { id: 'cell-1', cell: 'A1', value: 'NEMZETKÖZI FUVARLEVÉL - CMR', type: 'header', bold: true, fontSize: 16, alignment: 'center', merge: 'K1' },
        { id: 'cell-2', cell: 'K2', value: 'Szám: {{sequenceNumber}}', type: 'variable', bold: true, fontSize: 12, alignment: 'right' },
        
        { id: 'cell-3', cell: 'A4', value: '1. Feladó (Név, cím, ország)', type: 'header', bold: true, fontSize: 11, underline: true },
        { id: 'cell-4', cell: 'A5', value: '{{senderName}}', type: 'variable', fontSize: 11 },
        { id: 'cell-5', cell: 'A6', value: '{{senderAddress}}', type: 'variable', fontSize: 10 },
        { id: 'cell-6', cell: 'A7', value: '{{senderCity}}, {{senderCountry}}', type: 'variable', fontSize: 10 },
        { id: 'cell-7', cell: 'A8', value: 'Adószám: {{senderTaxNumber}}', type: 'variable', fontSize: 10 },
        { id: 'cell-8', cell: 'A9', value: 'Tel: {{senderPhone}}', type: 'variable', fontSize: 10 },
        { id: 'cell-9', cell: 'A10', value: 'Email: {{senderEmail}}', type: 'variable', fontSize: 10 },
        
        { id: 'cell-10', cell: 'A12', value: '2. Átvevő (Címzett)', type: 'header', bold: true, fontSize: 11, underline: true },
        { id: 'cell-11', cell: 'A13', value: '{{customerName}}', type: 'variable', bold: true, fontSize: 12 },
        { id: 'cell-12', cell: 'A14', value: '{{customerAddress}}', type: 'variable', fontSize: 10 },
        { id: 'cell-13', cell: 'A15', value: '{{customerCity}}, {{customerCountry}}', type: 'variable', fontSize: 10 },
        { id: 'cell-14', cell: 'A16', value: 'Adószám: {{customerTaxNumber}}', type: 'variable', fontSize: 10 },
        
        { id: 'cell-15', cell: 'A18', value: '3. Áru átvételének helye és időpontja', type: 'header', bold: true, fontSize: 10, underline: true },
        { id: 'cell-16', cell: 'A19', value: '{{placeOfTakingOver}}', type: 'variable', fontSize: 10 },
        { id: 'cell-17', cell: 'A20', value: 'Dátum: {{currentDate}}', type: 'variable', fontSize: 10 },
        
        { id: 'cell-18', cell: 'F18', value: '4. Áru kiszállításának helye és időpontja', type: 'header', bold: true, fontSize: 10, underline: true },
        { id: 'cell-19', cell: 'F19', value: '{{customerCity}}, {{customerCountry}}', type: 'variable', fontSize: 10 },
        
        { id: 'cell-20', cell: 'A22', value: '14. Fuvarozó (Név, cím, ország)', type: 'header', bold: true, fontSize: 10, underline: true },
        { id: 'cell-21', cell: 'A23', value: '{{carrierName}}', type: 'variable', fontSize: 10 },
        { id: 'cell-22', cell: 'A24', value: '{{carrierAddress}}', type: 'variable', fontSize: 10 },
        { id: 'cell-23', cell: 'A25', value: 'Rendszám: {{vehiclePlate}}', type: 'variable', fontSize: 10 },
        
        { id: 'cell-24', cell: 'A27', value: 'Termék név', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
        { id: 'cell-25', cell: 'B27', value: 'Megnevezés', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
        { id: 'cell-26', cell: 'C27', value: 'Csomagolás módja', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
        { id: 'cell-27', cell: 'D27', value: 'Mennyiség (db)', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
        { id: 'cell-28', cell: 'E27', value: 'Dobozok száma', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
        { id: 'cell-29', cell: 'F27', value: 'Raklapok száma', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
        { id: 'cell-30', cell: 'G27', value: 'Bruttó súly (kg)', type: 'header', bold: true, fontSize: 10, backgroundColor: 'FF0066CC', textColor: 'FFFFFFFF', alignment: 'center', border: true },
      ],
      columns: [
        { index: 1, width: 25 },
        { index: 2, width: 30 },
        { index: 3, width: 16 },
        { index: 4, width: 14 },
        { index: 5, width: 14 },
        { index: 6, width: 14 },
        { index: 7, width: 16 },
        { index: 8, width: 12 },
        { index: 9, width: 12 },
        { index: 10, width: 12 },
        { index: 11, width: 12 },
      ],
      rowHeights: {
        1: 30,
        27: 35
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  const handleCreateTemplate = (type: 'delivery' | 'cmr') => {
    const template: ExcelJSTemplate = type === 'cmr' 
      ? createDefaultCmrTemplate()
      : {
          id: `template-${Date.now()}`,
          name: `Új Szállítólevél sablon`,
          type,
          description: '',
          sheetName: 'Szállítólevél',
          cells: [],
          columns: Array.from({ length: 15 }, (_, i) => ({ index: i + 1, width: 12 })),
          rowHeights: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
    setCurrentTemplate(template)
    toast.success(type === 'cmr' ? 'CMR alapértelmezett sablon betöltve - most testreszabhatja!' : 'Új sablon létrehozva')
  }

  const handleSaveTemplate = () => {
    if (!currentTemplate) return
    
    const existing = templates?.find(t => t.id === currentTemplate.id)
    if (existing) {
      setTemplates((current) =>
        (current || []).map(t => t.id === currentTemplate.id 
          ? { ...currentTemplate, updatedAt: new Date().toISOString() }
          : t
        )
      )
      toast.success('Sablon mentve')
    } else {
      setTemplates((current) => [...(current || []), currentTemplate])
      toast.success('Új sablon hozzáadva')
    }
  }

  const handleLoadTemplate = (template: ExcelJSTemplate) => {
    setCurrentTemplate({ ...template })
    setSelectedCell(null)
    toast.success(`Sablon betöltve: ${template.name}`)
  }

  const handleDeleteTemplate = (id: string) => {
    setTemplates((current) => (current || []).filter(t => t.id !== id))
    if (currentTemplate?.id === id) {
      setCurrentTemplate(null)
    }
    toast.success('Sablon törölve')
  }

  const handleAddCell = () => {
    if (!currentTemplate || !newCellAddress) {
      toast.error('Cím megadása kötelező')
      return
    }

    const newCell: CellConfig = {
      id: `cell-${Date.now()}`,
      cell: newCellAddress.toUpperCase(),
      value: newCellValue,
      type: newCellType,
      fontSize: 11,
      alignment: 'left',
      verticalAlignment: 'middle'
    }

    setCurrentTemplate({
      ...currentTemplate,
      cells: [...currentTemplate.cells, newCell]
    })

    setNewCellAddress('')
    setNewCellValue('')
    setNewCellType('static')
    toast.success(`Cella hozzáadva: ${newCell.cell}`)
  }

  const handleUpdateCell = (cellId: string, updates: Partial<CellConfig>) => {
    if (!currentTemplate) return

    setCurrentTemplate({
      ...currentTemplate,
      cells: currentTemplate.cells.map(c => 
        c.id === cellId ? { ...c, ...updates } : c
      )
    })

    if (selectedCell?.id === cellId) {
      setSelectedCell({ ...selectedCell, ...updates })
    }
  }

  const handleDeleteCell = (cellId: string) => {
    if (!currentTemplate) return

    setCurrentTemplate({
      ...currentTemplate,
      cells: currentTemplate.cells.filter(c => c.id !== cellId)
    })

    if (selectedCell?.id === cellId) {
      setSelectedCell(null)
    }
    toast.success('Cella törölve')
  }

  const handlePreviewExport = async () => {
    if (!currentTemplate) return

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(currentTemplate.sheetName)

      currentTemplate.cells.forEach(cellConfig => {
        const cell = worksheet.getCell(cellConfig.cell)
        
        cell.value = cellConfig.value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return `[${key}]`
        })

        if (cellConfig.merge) {
          worksheet.mergeCells(`${cellConfig.cell}:${cellConfig.merge}`)
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

      currentTemplate.columns.forEach(col => {
        worksheet.getColumn(col.index).width = col.width
      })

      Object.entries(currentTemplate.rowHeights).forEach(([rowNum, height]) => {
        worksheet.getRow(parseInt(rowNum)).height = height
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentTemplate.name}_preview.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Előnézet letöltve')
    } catch (error) {
      console.error('Preview export error:', error)
      toast.error('Előnézet hiba: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'))
    }
  }

  const handleDuplicateCell = (cell: CellConfig) => {
    if (!currentTemplate) return

    const newCell: CellConfig = {
      ...cell,
      id: `cell-${Date.now()}`,
      cell: cell.cell + '_copy'
    }

    setCurrentTemplate({
      ...currentTemplate,
      cells: [...currentTemplate.cells, newCell]
    })
    toast.success('Cella másolva')
  }

  const handleExportWithTemplate = (template: ExcelJSTemplate) => {
    setTemplateForExport(template)
    
    if (selectedOrderIds.length > 0) {
      setLocalSelectedOrderIds(selectedOrderIds)
      setExportDialogOpen(true)
    } else {
      setOrderSelectionDialogOpen(true)
    }
  }

  const handleOrderSelectionConfirm = () => {
    if (localSelectedOrderIds.length === 0) {
      toast.error('Válasszon ki legalább egy rendelést')
      return
    }
    
    setOrderSelectionDialogOpen(false)
    setExportDialogOpen(true)
  }

  const handleConfirmExport = async () => {
    if (!templateForExport) return

    const ordersToExport = orders.filter(o => localSelectedOrderIds.includes(o.id))
    
    if (ordersToExport.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések az exportáláshoz')
      return
    }

    const firstCustomer = ordersToExport[0]?.customer
    const hasMultipleCustomers = ordersToExport.some(o => o.customer !== firstCustomer)
    
    if (hasMultipleCustomers) {
      toast.error('Kérem, egyszerre csak egy vevő rendeléseit válassza ki')
      return
    }

    await exportOrdersWithExcelJSTemplate(
      templateForExport,
      ordersToExport,
      customers,
      products,
      deliveryNotes,
      cmrSettings,
      onExportSaved
    )

    setExportDialogOpen(false)
    setTemplateForExport(null)
    setLocalSelectedOrderIds([])
  }

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customer.toLowerCase().includes(query) ||
      order.productName.toLowerCase().includes(query) ||
      order.designation.toLowerCase().includes(query)
    )
  })

  const toggleOrderSelection = (orderId: string) => {
    setLocalSelectedOrderIds(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const toggleAllOrders = () => {
    if (localSelectedOrderIds.length === filteredOrders.length) {
      setLocalSelectedOrderIds([])
    } else {
      setLocalSelectedOrderIds(filteredOrders.map(o => o.id))
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary text-primary-foreground rounded-lg">
            <Package className="w-6 h-6" weight="duotone" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2">CMR Sablon Testreszabás</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Az <strong>ExcelJS Sablon Szerkesztő</strong> lehetővé teszi a CMR dokumentumok teljes testreszabását. 
              Kattintson az <strong>"Új CMR"</strong> gombra egy alapértelmezett CMR sablon betöltéséhez, amely az aktuális cmrDirectExport.ts kódon alapul.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="gap-1">
                <Plus className="w-3 h-3" />
                Cellák hozzáadása/szerkesztése
              </Badge>
              <Badge variant="default" className="gap-1">
                <ArrowsOutCardinal className="w-3 h-3" />
                Elrendezés testreszabása
              </Badge>
              <Badge variant="default" className="gap-1">
                <Copy className="w-3 h-3" />
                Változók beszúrása
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {selectedOrderIds.length > 0 && (
        <div className="p-4 bg-accent/10 border border-accent rounded-lg">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" weight="duotone" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">
                {selectedOrderIds.length} rendelés kiválasztva a Rendelések fülről
              </h4>
              <p className="text-sm text-muted-foreground">
                Kattintson az "Export" gombra bármelyik sablon kártyáján a kiválasztott rendelések exportálásához azzal a sablonnal.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">ExcelJS Sablon Szerkesztő</h2>
          <p className="text-muted-foreground">
            Vizuális szerkesztő Excel exportok testreszabásához
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleCreateTemplate('delivery')} variant="default">
            <Plus className="w-4 h-4 mr-2" />
            Új Szállítólevél
          </Button>
          <Button onClick={() => handleCreateTemplate('cmr')} variant="secondary">
            <Plus className="w-4 h-4 mr-2" />
            Új CMR
          </Button>
        </div>
      </div>

      {!currentTemplate && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates || []).map(template => (
            <Card key={template.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <Badge variant={template.type === 'delivery' ? 'default' : 'secondary'} className="text-xs mt-1">
                    {template.type === 'delivery' ? 'Szállítólevél' : 'CMR'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {template.description || 'Nincs leírás'}
              </p>
              <div className="text-xs text-muted-foreground mb-3">
                {template.cells.length} cella • {template.columns.length} oszlop
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleLoadTemplate(template)} className="flex-1">
                  Szerkesztés
                </Button>
                <Button 
                  size="sm" 
                  variant="default" 
                  onClick={() => handleExportWithTemplate(template)}
                  className="gap-1"
                >
                  <FileArrowDown className="w-4 h-4" />
                  Export
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteTemplate(template.id)}>
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {currentTemplate && (
        <Tabs defaultValue="cells" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="cells">Cellák</TabsTrigger>
              <TabsTrigger value="layout">Elrendezés</TabsTrigger>
              <TabsTrigger value="variables">Változók</TabsTrigger>
              <TabsTrigger value="settings">Beállítások</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreviewExport}>
                <Play className="w-4 h-4 mr-2" />
                Előnézet
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Mentés
              </Button>
              <Button variant="outline" onClick={() => setCurrentTemplate(null)}>
                Bezárás
              </Button>
            </div>
          </div>

          <TabsContent value="cells" className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Új cella hozzáadása</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Cella cím (pl: A1)</Label>
                  <Input
                    value={newCellAddress}
                    onChange={(e) => setNewCellAddress(e.target.value.toUpperCase())}
                    placeholder="A1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Érték vagy változó</Label>
                  <Input
                    value={newCellValue}
                    onChange={(e) => setNewCellValue(e.target.value)}
                    placeholder="Szöveg vagy {{változó}}"
                  />
                </div>
                <div>
                  <Label>Típus</Label>
                  <Select value={newCellType} onValueChange={(v) => setNewCellType(v as CellType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Statikus</SelectItem>
                      <SelectItem value="variable">Változó</SelectItem>
                      <SelectItem value="header">Fejléc</SelectItem>
                      <SelectItem value="formula">Formula</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddCell} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Cella hozzáadása
              </Button>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Cellák listája ({currentTemplate.cells.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentTemplate.cells.map(cell => (
                    <div
                      key={cell.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCell?.id === cell.id ? 'bg-accent border-accent-foreground' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedCell(cell)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono">
                              {cell.cell}
                            </Badge>
                            <Badge variant={
                              cell.type === 'header' ? 'default' :
                              cell.type === 'variable' ? 'secondary' : 'outline'
                            }>
                              {cell.type}
                            </Badge>
                          </div>
                          <p className="text-sm truncate">{cell.value}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicateCell(cell)
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCell(cell.id)
                            }}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {selectedCell && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Cella szerkesztése: {selectedCell.cell}</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Érték</Label>
                      <Textarea
                        value={selectedCell.value}
                        onChange={(e) => handleUpdateCell(selectedCell.id, { value: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Betűméret</Label>
                        <Input
                          type="number"
                          value={selectedCell.fontSize || 11}
                          onChange={(e) => handleUpdateCell(selectedCell.id, { fontSize: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Típus</Label>
                        <Select
                          value={selectedCell.type}
                          onValueChange={(v) => handleUpdateCell(selectedCell.id, { type: v as CellType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Statikus</SelectItem>
                            <SelectItem value="variable">Változó</SelectItem>
                            <SelectItem value="header">Fejléc</SelectItem>
                            <SelectItem value="formula">Formula</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={selectedCell.bold || false}
                          onCheckedChange={(checked) => handleUpdateCell(selectedCell.id, { bold: checked })}
                        />
                        <Label>Félkövér</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={selectedCell.italic || false}
                          onCheckedChange={(checked) => handleUpdateCell(selectedCell.id, { italic: checked })}
                        />
                        <Label>Dőlt</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={selectedCell.underline || false}
                          onCheckedChange={(checked) => handleUpdateCell(selectedCell.id, { underline: checked })}
                        />
                        <Label>Aláhúzott</Label>
                      </div>
                    </div>

                    <div>
                      <Label>Igazítás</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant={selectedCell.alignment === 'left' ? 'default' : 'outline'}
                          onClick={() => handleUpdateCell(selectedCell.id, { alignment: 'left' })}
                        >
                          <TextAlignLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedCell.alignment === 'center' ? 'default' : 'outline'}
                          onClick={() => handleUpdateCell(selectedCell.id, { alignment: 'center' })}
                        >
                          <TextAlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedCell.alignment === 'right' ? 'default' : 'outline'}
                          onClick={() => handleUpdateCell(selectedCell.id, { alignment: 'right' })}
                        >
                          <TextAlignRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Háttérszín (pl: FFFF00)</Label>
                        <Input
                          value={selectedCell.backgroundColor || ''}
                          onChange={(e) => handleUpdateCell(selectedCell.id, { backgroundColor: e.target.value })}
                          placeholder="FFFF00"
                        />
                      </div>
                      <div>
                        <Label>Szövegszín (pl: FF000000)</Label>
                        <Input
                          value={selectedCell.textColor || ''}
                          onChange={(e) => handleUpdateCell(selectedCell.id, { textColor: e.target.value })}
                          placeholder="FF000000"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Összevonás (pl: C1)</Label>
                      <Input
                        value={selectedCell.merge || ''}
                        onChange={(e) => handleUpdateCell(selectedCell.id, { merge: e.target.value.toUpperCase() })}
                        placeholder="C1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selectedCell.border || false}
                        onCheckedChange={(checked) => handleUpdateCell(selectedCell.id, { border: checked })}
                      />
                      <Label>Szegély</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selectedCell.wrapText || false}
                        onCheckedChange={(checked) => handleUpdateCell(selectedCell.id, { wrapText: checked })}
                      />
                      <Label>Tördelés</Label>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Oszlop szélességek</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4">
                {currentTemplate.columns.map(col => (
                  <div key={col.index}>
                    <Label className="text-xs">Oszlop {col.index}</Label>
                    <Input
                      type="number"
                      value={col.width}
                      onChange={(e) => {
                        setCurrentTemplate({
                          ...currentTemplate,
                          columns: currentTemplate.columns.map(c =>
                            c.index === col.index ? { ...c, width: parseFloat(e.target.value) } : c
                          )
                        })
                      }}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Sor magasságok</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adja meg a sor számát és magasságát. Alapértelmezett magasság: 15
              </p>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Sor száma (pl: 1)"
                    className="flex-1"
                    id="row-number-input"
                  />
                  <Input
                    type="number"
                    placeholder="Magasság (pl: 30)"
                    className="flex-1"
                    id="row-height-input"
                  />
                  <Button
                    onClick={() => {
                      const rowNumInput = document.getElementById('row-number-input') as HTMLInputElement
                      const rowHeightInput = document.getElementById('row-height-input') as HTMLInputElement
                      const rowNum = parseInt(rowNumInput?.value || '0')
                      const rowHeight = parseFloat(rowHeightInput?.value || '15')
                      
                      if (rowNum > 0) {
                        setCurrentTemplate({
                          ...currentTemplate,
                          rowHeights: {
                            ...currentTemplate.rowHeights,
                            [rowNum]: rowHeight
                          }
                        })
                        if (rowNumInput) rowNumInput.value = ''
                        if (rowHeightInput) rowHeightInput.value = ''
                        toast.success(`Sor ${rowNum} magasság: ${rowHeight}`)
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Hozzáadás
                  </Button>
                </div>

                {Object.entries(currentTemplate.rowHeights).length > 0 && (
                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-semibold mb-2">Beállított sor magasságok:</h4>
                    <div className="space-y-2">
                      {Object.entries(currentTemplate.rowHeights).map(([rowNum, height]) => (
                        <div key={rowNum} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">
                            <span className="font-mono font-semibold">Sor {rowNum}:</span> {height}px
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newHeights = { ...currentTemplate.rowHeights }
                              delete newHeights[parseInt(rowNum)]
                              setCurrentTemplate({
                                ...currentTemplate,
                                rowHeights: newHeights
                              })
                              toast.success(`Sor ${rowNum} magasság törölve`)
                            }}
                          >
                            <Trash className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="variables" className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Elérhető változók</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Kattintson a változóra a vágólapra másoláshoz
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {AVAILABLE_VARIABLES[currentTemplate.type].map(variable => (
                  <Button
                    key={variable}
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs justify-start"
                    onClick={() => {
                      navigator.clipboard.writeText(variable)
                      toast.success(`Másolva: ${variable}`)
                    }}
                  >
                    {variable}
                  </Button>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Sablon beállítások</h3>
              <div className="space-y-4">
                <div>
                  <Label>Sablon neve</Label>
                  <Input
                    value={currentTemplate.name}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Leírás</Label>
                  <Textarea
                    value={currentTemplate.description}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Munkalap neve</Label>
                  <Input
                    value={currentTemplate.sheetName}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, sheetName: e.target.value })}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={orderSelectionDialogOpen} onOpenChange={setOrderSelectionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Rendelések kiválasztása exportáláshoz</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Keresés rendelés, vevő vagy termék szerint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localSelectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                  onChange={toggleAllOrders}
                  className="w-4 h-4 rounded border-input"
                />
                <Label className="cursor-pointer" onClick={toggleAllOrders}>
                  Összes kijelölése
                </Label>
              </div>
              <span className="text-sm text-muted-foreground">
                {localSelectedOrderIds.length} / {filteredOrders.length} kiválasztva
              </span>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              <div className="divide-y">
                {filteredOrders.map(order => (
                  <div
                    key={order.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      localSelectedOrderIds.includes(order.id) ? 'bg-accent' : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleOrderSelection(order.id)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={localSelectedOrderIds.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="mt-1 w-4 h-4 rounded border-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {order.orderNumber}
                          </Badge>
                          <Badge>{order.status}</Badge>
                        </div>
                        <p className="font-semibold truncate">{order.productName}</p>
                        <p className="text-sm text-muted-foreground truncate">{order.customer}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{order.amountPc} db</span>
                          {order.orderDate && <span>{new Date(order.orderDate).toLocaleDateString('hu-HU')}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setOrderSelectionDialogOpen(false)
              setLocalSelectedOrderIds([])
            }}>
              Mégse
            </Button>
            <Button onClick={handleOrderSelectionConfirm} disabled={localSelectedOrderIds.length === 0}>
              Tovább ({localSelectedOrderIds.length} rendelés)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rendelések exportálása sablonnal</DialogTitle>
          </DialogHeader>

          {templateForExport && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="w-8 h-8 text-primary" weight="duotone" />
                  <div>
                    <h3 className="font-semibold">{templateForExport.name}</h3>
                    <Badge variant={templateForExport.type === 'delivery' ? 'default' : 'secondary'} className="text-xs mt-1">
                      {templateForExport.type === 'delivery' ? 'Szállítólevél' : 'CMR'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {templateForExport.description || 'Nincs leírás'}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Kiválasztott rendelések</h4>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm">
                    <span className="font-semibold">{localSelectedOrderIds.length}</span> rendelés lesz exportálva
                  </p>
                  {orders.filter(o => localSelectedOrderIds.includes(o.id)).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Vevő: {orders.find(o => localSelectedOrderIds.includes(o.id))?.customer}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-accent/10 border border-accent rounded-lg">
                <p className="text-sm">
                  A sablon változói automatikusan kitöltésre kerülnek a kiválasztott rendelések adataival.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setExportDialogOpen(false)
              setLocalSelectedOrderIds([])
            }}>
              Mégse
            </Button>
            <Button onClick={handleConfirmExport} className="gap-2">
              <FileArrowDown className="w-4 h-4" />
              Exportálás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
