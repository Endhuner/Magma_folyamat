import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash, Upload, Download, FileArrowDown, MagnifyingGlass, CheckCircle, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import * as ExcelJS from 'exceljs'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { exportOrdersWithExcelJSTemplate } from '@/lib/exceljsTemplateExport'

type CellType = 'static' | 'variable'

interface CellMapping {
  id: string
  cellAddress: string
  variable: string
  description?: string
}

interface StaticCellContent {
  id: string
  cellAddress: string
  text: string
  description?: string
}

interface ExportTemplate {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  description: string
  sourceFile?: string
  cellMappings: CellMapping[]
  staticCells: StaticCellContent[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const AVAILABLE_VARIABLES = {
  delivery: [
    { key: 'sequenceNumber', label: 'Szállítólevél száma', description: 'Automatikusan generált sorszám' },
    { key: 'customerName', label: 'Vevő neve', description: 'Vevő teljes neve' },
    { key: 'customerAddress', label: 'Vevő címe', description: 'Teljes cím' },
    { key: 'customerCity', label: 'Város', description: 'Vevő városa' },
    { key: 'customerCountry', label: 'Ország', description: 'Vevő országa' },
    { key: 'customerTaxNumber', label: 'Adószám', description: 'Vevő adószáma' },
    { key: 'senderName', label: 'Feladó neve', description: 'Saját cég neve' },
    { key: 'senderAddress', label: 'Feladó címe', description: 'Saját cég címe' },
    { key: 'currentDate', label: 'Mai dátum', description: 'Export dátuma' },
    { key: 'productName', label: 'Termék neve', description: 'Termék megnevezése' },
    { key: 'designation', label: 'Megnevezés', description: 'Termék jelölése' },
    { key: 'amountPc', label: 'Mennyiség (db)', description: 'Darabszám' },
    { key: 'boxesCount', label: 'Dobozok száma', description: 'Csomagolás' },
    { key: 'palletsCount', label: 'Raklapok száma', description: 'Raklapok' },
    { key: 'grossWeight', label: 'Bruttó tömeg', description: 'kg-ban' },
    { key: 'material', label: 'Anyag', description: 'Anyagminőség' },
    { key: 'surfaceTreatment', label: 'Felületkezelés', description: 'Kezelés típusa' },
  ],
  cmr: [
    { key: 'sequenceNumber', label: 'Szállítólevél száma', description: 'Automatikusan generált sorszám' },
    { key: 'customerName', label: 'Vevő neve', description: 'Vevő teljes neve' },
    { key: 'customerAddress', label: 'Vevő címe', description: 'Teljes cím' },
    { key: 'customerCity', label: 'Város', description: 'Vevő városa' },
    { key: 'customerCountry', label: 'Ország', description: 'Vevő országa' },
    { key: 'customerTaxNumber', label: 'Vevő adószám', description: 'Vevő adószáma' },
    { key: 'senderName', label: 'Feladó neve', description: 'Saját cég neve' },
    { key: 'senderAddress', label: 'Feladó címe', description: 'Teljes cím' },
    { key: 'senderCity', label: 'Feladó városa', description: 'Város' },
    { key: 'senderCountry', label: 'Feladó országa', description: 'Ország' },
    { key: 'senderTaxNumber', label: 'Feladó adószám', description: 'Adószám' },
    { key: 'senderPhone', label: 'Feladó telefon', description: 'Telefonszám' },
    { key: 'senderEmail', label: 'Feladó email', description: 'Email cím' },
    { key: 'placeOfTakingOver', label: 'Átvétel helye', description: 'CMR átvételi hely' },
    { key: 'placeIssued', label: 'Kiállítás helye', description: 'Dokumentum kiállítási helye' },
    { key: 'currentDate', label: 'Mai dátum', description: 'Export dátuma' },
    { key: 'carrierName', label: 'Fuvarozó neve', description: 'Fuvarozó cég' },
    { key: 'carrierAddress', label: 'Fuvarozó címe', description: 'Teljes cím' },
    { key: 'vehiclePlate', label: 'Rendszám', description: 'Jármű rendszáma' },
  ]
}

interface ExportTemplateEditorProps {
  orders?: Order[]
  customers?: Customer[]
  products?: Product[]
  deliveryNotes?: DeliveryNote[]
  selectedOrderIds?: string[]
  cmrSettings?: any
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void
}

export function ExportTemplateEditor({
  orders = [],
  customers = [],
  products = [],
  deliveryNotes = [],
  selectedOrderIds = [],
  cmrSettings,
  onExportSaved
}: ExportTemplateEditorProps = {}) {
  const [templates, setTemplates] = useKV<ExportTemplate[]>('export-templates', [])
  const [currentTemplate, setCurrentTemplate] = useState<ExportTemplate | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [newMapping, setNewMapping] = useState({ cellAddress: '', variable: '' })
  const [newStaticCell, setNewStaticCell] = useState({ cellAddress: '', text: '', description: '' })
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadDefaultTemplate = async () => {
      const existingDefault = templates?.find(t => t.name === 'Cmr' && t.type === 'cmr')
      if (!existingDefault) {
        const defaultTemplate: ExportTemplate = {
          id: `template-${Date.now()}`,
          name: 'Cmr',
          type: 'cmr',
          description: 'Alapértelmezett CMR sablon - Cmr.xls alapján',
          sourceFile: 'Cmr.xls',
          cellMappings: [
            { id: '1', cellAddress: 'K1', variable: 'sequenceNumber', description: 'Szállítólevél száma' },
            { id: '2', cellAddress: 'A6', variable: 'customerName', description: 'Vevő neve' },
            { id: '3', cellAddress: 'A7', variable: 'customerAddress', description: 'Vevő címe' },
            { id: '4', cellAddress: 'B12', variable: 'customerCity', description: 'Város' },
            { id: '5', cellAddress: 'B13', variable: 'customerCountry', description: 'Ország' },
          ],
          staticCells: [],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        setTemplates((current) => [...(current || []), defaultTemplate])
        toast.success('Alapértelmezett CMR sablon betöltve')
      }
    }
    loadDefaultTemplate()
  }, [])

  const handleCreateTemplate = (type: 'delivery' | 'cmr') => {
    const template: ExportTemplate = {
      id: `template-${Date.now()}`,
      name: `Új ${type === 'delivery' ? 'Szállítólevél' : 'CMR'} sablon`,
      type,
      description: '',
      cellMappings: [],
      staticCells: [],
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setCurrentTemplate(template)
    setDialogOpen(true)
  }

  const handleImportFromExcel = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.xltx'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !currentTemplate) return

      try {
        const buffer = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)
        
        setCurrentTemplate({
          ...currentTemplate,
          sourceFile: file.name,
          updatedAt: new Date().toISOString()
        })
        
        toast.success(`Excel fájl importálva: ${file.name}`)
      } catch (error) {
        console.error('Import error:', error)
        toast.error('Hiba az importálás során')
      }
    }
    input.click()
  }

  const handleSaveTemplate = () => {
    if (!currentTemplate) return
    
    if (!currentTemplate.name.trim()) {
      toast.error('A sablon neve kötelező')
      return
    }

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
      toast.success('Új sablon létrehozva')
    }
    setDialogOpen(false)
    setCurrentTemplate(null)
  }

  const handleAddMapping = () => {
    if (!currentTemplate || !newMapping.cellAddress || !newMapping.variable) {
      toast.error('Cella cím és változó megadása kötelező')
      return
    }

    const mapping: CellMapping = {
      id: `mapping-${Date.now()}`,
      cellAddress: newMapping.cellAddress.toUpperCase(),
      variable: newMapping.variable,
      description: AVAILABLE_VARIABLES[currentTemplate.type]?.find(v => v.key === newMapping.variable)?.label
    }

    setCurrentTemplate({
      ...currentTemplate,
      cellMappings: [...currentTemplate.cellMappings, mapping]
    })

    setNewMapping({ cellAddress: '', variable: '' })
    toast.success(`Hozzárendelés létrehozva: ${mapping.cellAddress} → ${mapping.variable}`)
  }

  const handleDeleteMapping = (mappingId: string) => {
    if (!currentTemplate) return
    
    setCurrentTemplate({
      ...currentTemplate,
      cellMappings: currentTemplate.cellMappings.filter(m => m.id !== mappingId)
    })
    toast.success('Hozzárendelés törölve')
  }

  const handleAddStaticCell = () => {
    if (!currentTemplate || !newStaticCell.cellAddress || !newStaticCell.text) {
      toast.error('Cella cím és szöveg megadása kötelező')
      return
    }

    const staticCell: StaticCellContent = {
      id: `static-${Date.now()}`,
      cellAddress: newStaticCell.cellAddress.toUpperCase(),
      text: newStaticCell.text,
      description: newStaticCell.description
    }

    setCurrentTemplate({
      ...currentTemplate,
      staticCells: [...(currentTemplate.staticCells || []), staticCell]
    })

    setNewStaticCell({ cellAddress: '', text: '', description: '' })
    toast.success(`Statikus cella létrehozva: ${staticCell.cellAddress}`)
  }

  const handleDeleteStaticCell = (cellId: string) => {
    if (!currentTemplate) return
    
    setCurrentTemplate({
      ...currentTemplate,
      staticCells: (currentTemplate.staticCells || []).filter(c => c.id !== cellId)
    })
    toast.success('Statikus cella törölve')
  }

  const handleDeleteTemplate = (id: string) => {
    setTemplates((current) => (current || []).filter(t => t.id !== id))
    toast.success('Sablon törölve')
  }

  const handleActivateTemplate = (id: string) => {
    setTemplates((current) =>
      (current || []).map(t => ({
        ...t,
        isActive: t.id === id
      }))
    )
    toast.success('Sablon aktiválva')
  }

  const handleExportWithTemplate = async (template: ExportTemplate) => {
    if (selectedOrderIds.length === 0) {
      toast.error('Nincsenek kiválasztott rendelések')
      return
    }

    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id))
    
    try {
      const response = await fetch(`/templates/${template.sourceFile || 'Cmr.xls'}`)
      if (!response.ok) {
        throw new Error('Sablon fájl nem található')
      }

      const buffer = await response.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      
      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        throw new Error('A sablonban nem található munkalap')
      }

      const firstCustomer = selectedOrders[0]?.customer || ''
      const customerInfo = customers.find(c => c.name === firstCustomer)
      
      const variableData = buildVariableData(
        selectedOrders,
        customerInfo,
        products,
        deliveryNotes,
        template.type,
        cmrSettings
      )

      template.cellMappings.forEach(mapping => {
        const cell = worksheet.getCell(mapping.cellAddress)
        const value = variableData[mapping.variable]
        if (value !== undefined) {
          cell.value = value
        }
      })

      if (template.staticCells) {
        template.staticCells.forEach(staticCell => {
          const cell = worksheet.getCell(staticCell.cellAddress)
          cell.value = staticCell.text
        })
      }

      const sequenceNumber = variableData.sequenceNumber
      const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
      const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
      const fileName = `${sequenceNumber}_${safeCustomerName}.xlsx`

      const exportBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([exportBuffer], { 
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
          orderIds: selectedOrders.map(o => o.id),
          fileName,
          exportDate: new Date().toISOString(),
          exportData: selectedOrders.map(o => ({
            orderNumber: o.orderNumber,
            productName: o.productName,
            amountPc: o.amountPc
          }))
        }
        onExportSaved(deliveryNote, sequenceNumber)
      }

      toast.success(`${template.type === 'delivery' ? 'Szállítólevél' : 'CMR'} exportálva: ${fileName}`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Hiba az exportálás során: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'))
    }
  }

  const filteredTemplates = (templates || []).filter(t => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.sourceFile?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sablon alapú exportálás</h2>
          <p className="text-muted-foreground">
            Excel sablonok cellahozzárendelése rendelési adatokhoz
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleCreateTemplate('delivery')}>
            <Plus className="w-4 h-4 mr-2" />
            Szállítólevél sablon
          </Button>
          <Button variant="outline" onClick={() => handleCreateTemplate('cmr')}>
            <Plus className="w-4 h-4 mr-2" />
            CMR sablon
          </Button>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Sablonok keresése..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <Card key={template.id} className={`p-4 ${template.isActive ? 'ring-2 ring-success' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.isActive && (
                    <Badge variant="default" className="text-xs bg-success text-success-foreground">
                      Aktív
                    </Badge>
                  )}
                </div>
                <Badge variant={template.type === 'delivery' ? 'default' : 'secondary'} className="text-xs">
                  {template.type === 'delivery' ? 'Szállítólevél' : 'CMR'}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {template.description || 'Nincs leírás'}
            </p>

            {template.sourceFile && (
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-success" weight="fill" />
                <span className="truncate">{template.sourceFile}</span>
              </div>
            )}

            <div className="text-xs text-muted-foreground mb-3">
              {template.cellMappings.length} cellahozzárendelés
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => handleExportWithTemplate(template)}
                disabled={selectedOrderIds.length === 0}
              >
                <FileArrowDown className="w-4 h-4 mr-1" />
                Exportálás
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentTemplate(template)
                  setDialogOpen(true)
                }}
              >
                Szerkesztés
              </Button>
              {!template.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleActivateTemplate(template.id)}
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDeleteTemplate(template.id)}
              >
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card className="p-12 text-center">
          <FileArrowDown className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nincs sablon</h3>
          <p className="text-muted-foreground mb-4">
            Hozzon létre Excel sablon alapú exportálást
          </p>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {currentTemplate?.id ? 'Sablon szerkesztése' : 'Új sablon létrehozása'}
            </DialogTitle>
          </DialogHeader>

          {currentTemplate && (
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="space-y-6 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-name">Sablon neve *</Label>
                    <Input
                      id="template-name"
                      value={currentTemplate.name}
                      onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                      placeholder="pl. CMR sablon v2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-type">Típus</Label>
                    <Select
                      value={currentTemplate.type}
                      onValueChange={(value: 'delivery' | 'cmr') => 
                        setCurrentTemplate({ ...currentTemplate, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivery">Szállítólevél</SelectItem>
                        <SelectItem value="cmr">CMR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="template-description">Leírás</Label>
                  <Input
                    id="template-description"
                    value={currentTemplate.description}
                    onChange={(e) => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                    placeholder="Sablon leírása..."
                  />
                </div>

                <div>
                  <Label>Excel forrásfájl</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      value={currentTemplate.sourceFile || ''}
                      placeholder="Még nincs fájl kiválasztva"
                      readOnly
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handleImportFromExcel}>
                      <Upload className="w-4 h-4 mr-2" />
                      Tallózás
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Cellahozzárendelések</h3>
                      <p className="text-sm text-muted-foreground">
                        Adja meg, hogy melyik cellába kerüljön az adat
                      </p>
                    </div>
                  </div>

                  <Card className="p-4 mb-4 bg-muted">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="cell-address">Cella cím (pl. A1, K1)</Label>
                        <Input
                          id="cell-address"
                          value={newMapping.cellAddress}
                          onChange={(e) => setNewMapping({ ...newMapping, cellAddress: e.target.value })}
                          placeholder="pl. K1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="variable">Változó</Label>
                        <Select
                          value={newMapping.variable}
                          onValueChange={(value) => setNewMapping({ ...newMapping, variable: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Válasszon változót" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_VARIABLES[currentTemplate.type]?.map(v => (
                              <SelectItem key={v.key} value={v.key}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Button onClick={handleAddMapping} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Hozzárendelés hozzáadása
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <div className="space-y-2">
                    {currentTemplate.cellMappings.map(mapping => (
                      <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {mapping.cellAddress}
                          </Badge>
                          <span className="text-sm">→</span>
                          <div>
                            <p className="text-sm font-medium">{mapping.description || mapping.variable}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {`{{${mapping.variable}}}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    {currentTemplate.cellMappings.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Még nincsenek cellahozzárendelések
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Statikus cellák</h3>
                      <p className="text-sm text-muted-foreground">
                        Adjon meg rögzített szöveget tartalmazó cellákat
                      </p>
                    </div>
                  </div>

                  <Card className="p-4 mb-4 bg-muted">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="static-cell-address">Cella cím (pl. A1, B5)</Label>
                        <Input
                          id="static-cell-address"
                          value={newStaticCell.cellAddress}
                          onChange={(e) => setNewStaticCell({ ...newStaticCell, cellAddress: e.target.value })}
                          placeholder="pl. A1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="static-text">Szöveg</Label>
                        <Input
                          id="static-text"
                          value={newStaticCell.text}
                          onChange={(e) => setNewStaticCell({ ...newStaticCell, text: e.target.value })}
                          placeholder="Beírandó szöveg"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="static-description">Leírás (opcionális)</Label>
                        <Input
                          id="static-description"
                          value={newStaticCell.description}
                          onChange={(e) => setNewStaticCell({ ...newStaticCell, description: e.target.value })}
                          placeholder="Pl. Fejléc szöveg"
                        />
                      </div>

                      <div className="col-span-2">
                        <Button onClick={handleAddStaticCell} className="w-full" variant="secondary">
                          <Plus className="w-4 h-4 mr-2" />
                          Statikus cella hozzáadása
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <div className="space-y-2">
                    {(currentTemplate.staticCells || []).map(cell => (
                      <div key={cell.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="font-mono">
                            {cell.cellAddress}
                          </Badge>
                          <span className="text-sm">→</span>
                          <div>
                            <p className="text-sm font-medium">{cell.text}</p>
                            {cell.description && (
                              <p className="text-xs text-muted-foreground">
                                {cell.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteStaticCell(cell.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    {(currentTemplate.staticCells || []).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Még nincsenek statikus cellák
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Elérhető változók</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {AVAILABLE_VARIABLES[currentTemplate.type]?.map(v => (
                      <div key={v.key} className="p-2 border rounded">
                        <p className="font-mono font-medium">{`{{${v.key}}}`}</p>
                        <p className="text-muted-foreground">{v.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSaveTemplate}>
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function buildVariableData(
  orders: Order[],
  customer: Customer | undefined,
  products: Product[],
  deliveryNotes: DeliveryNote[],
  type: 'delivery' | 'cmr',
  cmrSettings?: any
): Record<string, string> {
  const currentDate = new Date().toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, type)

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
    senderName: cmrSettings?.senderName || 'Magma Kft',
    senderAddress: cmrSettings?.senderAddress || 'H-1211 Budapest, Déli utca 13.',
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
    data.senderCity = cmrSettings.senderCity || 'Budapest'
    data.senderCountry = cmrSettings.senderCountry || 'Magyarország'
    data.senderTaxNumber = cmrSettings.senderTaxNumber || 'HU10368152-2-43'
    data.placeOfTakingOver = cmrSettings.placeOfTakingOver || 'Budapest, Hungary'
    data.placeIssued = cmrSettings.placeIssued || 'Budapest'
    data.carrierName = cmrSettings.carrierName || ''
    data.carrierAddress = cmrSettings.carrierAddress || ''
    data.vehiclePlate = cmrSettings.vehiclePlate || ''
  }

  return data
}

function generateDeliveryNoteSequenceNumber(deliveryNotes: DeliveryNote[], type: 'delivery' | 'cmr'): string {
  const currentYear = new Date().getFullYear()
  const typedNotes = (deliveryNotes || []).filter(dn => dn.type === type)
  
  const yearlyNotes = typedNotes.filter(dn => {
    const noteYear = dn.sequenceNumber?.substring(0, 4)
    return noteYear === String(currentYear)
  })

  const maxSequence = yearlyNotes.reduce((max, dn) => {
    const match = dn.sequenceNumber?.match(/^\d{4}-(\d+)/)
    if (match) {
      const num = parseInt(match[1], 10)
      return Math.max(max, num)
    }
    return max
  }, 0)

  const nextNumber = maxSequence + 1
  const paddedNumber = String(nextNumber).padStart(3, '0')
  return `${currentYear}-${paddedNumber}`
}
