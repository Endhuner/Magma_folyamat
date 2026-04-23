import { useState, useMemo, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { generateDeliveryNoteSequenceNumber } from '@/lib/helpers'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { downloadBlob, generateCmrTemplateWorkbook } from '@/lib/xlsxTemplateExport'
import { FileArrowDown, X, PencilSimple, Check, Warning, Receipt } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ExportTemplate {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  fields: Array<{ id: string; label: string }>
}

interface TemplateField {
  id: string
  label: string
}

const DEFAULT_DELIVERY_FIELDS: TemplateField[] = [
  { id: 'orderNumber', label: 'Rendelésszám' },
  { id: 'productName', label: 'Termék' },
  { id: 'customer', label: 'Vevő' },
  { id: 'amountPc', label: 'Mennyiség (db)' },
  { id: 'deliveryNoteNumber', label: 'Szállítólevél szám' },
]

const DEFAULT_CMR_FIELDS: TemplateField[] = [
  { id: 'orderNumber', label: 'Rendelésszám' },
  { id: 'productName', label: 'Termék' },
  { id: 'customer', label: 'Vevő' },
  { id: 'amountPc', label: 'Mennyiség (db)' },
  { id: 'deliveryNoteNumber', label: 'Szállítólevél szám' },
]

function getTemplateFields(template: ExportTemplate | null, defaultFields: TemplateField[]): TemplateField[] {
  if (template && template.fields && template.fields.length > 0) {
    return template.fields
  }
  return defaultFields
}

const DEFAULT_CMR_SETTINGS: CmrLayoutSettings = {
  senderName: 'Magma Kft',
  senderAddress: 'H-1211 Budapest, Déli utca 13.',
  senderTaxNumber: 'HU10368152-2-43',
  placeOfTakingOver: 'Budapest, Hungary',
  placeIssued: 'Budapest',
}

interface ExportPreviewDialogProps {
  open: boolean
  onClose: () => void
  orders: Order[]
  customers: Customer[]
  products: Product[]
  exportType: 'delivery' | 'cmr'
  deliveryNotes: DeliveryNote[]
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void
}

type ExportRow = Record<string, string | number | null | undefined>

export function ExportPreviewDialog({
  open,
  onClose,
  orders,
  customers,
  products,
  exportType,
  deliveryNotes,
  onExportSaved,
}: ExportPreviewDialogProps) {
  const [cmrSettings] = useKV<CmrLayoutSettings>('cmr-layout-settings', DEFAULT_CMR_SETTINGS)
  const [deliveryTemplate] = useKV<ExportTemplate | null>('export-template-delivery', null)
  const [cmrTemplate] = useKV<ExportTemplate | null>('export-template-cmr', null)
  const [isExporting, setIsExporting] = useState(false)
  const [editableData, setEditableData] = useState<ExportRow[]>([])
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('')
  const [generatedSequenceNumber, setGeneratedSequenceNumber] = useState('')

  const buildExportData = (deliveryNoteOverride?: string) => {
    if (!orders.length) return []

    const effectiveSettings = { ...DEFAULT_CMR_SETTINGS, ...cmrSettings }
    const activeTemplate = exportType === 'delivery' ? (deliveryTemplate || null) : (cmrTemplate || null)
    const templateFields = getTemplateFields(
      activeTemplate, 
      exportType === 'delivery' ? DEFAULT_DELIVERY_FIELDS : DEFAULT_CMR_FIELDS
    )
    
    const firstCustomer = orders[0]?.customer
    const customerInfo = customers.find(c => c.name === firstCustomer)

    return orders.map(order => {
      const product = products.find(p => 
        p.customer === order.customer && 
        (p.productName === order.productName || p.drawingNumber === order.productName)
      )

      const existingDeliveryNote = order.status.toLowerCase().includes('kiszállítva') 
        ? (order.deliveryNote || '') 
        : ''

      const finalDeliveryNote = deliveryNoteOverride !== undefined 
        ? deliveryNoteOverride 
        : existingDeliveryNote

      const fieldValueMap: Record<string, string | number> = {
        ownOrderNumber: order.ownOrderNumber || '',
        orderNumber: order.orderNumber || '',
        customer: order.customer || '',
        customerLanguage: customerInfo?.language || '',
        customerFullAddress: customerInfo?.fullAddress || '',
        customerStreet: customerInfo?.street || '',
        customerCity: customerInfo?.city || '',
        customerPostalCode: customerInfo?.postalCode || '',
        customerCountry: customerInfo?.country || '',
        customerTaxNumber: customerInfo?.taxNumber || '',
        drawingNumber: product?.drawingNumber || '',
        productName: order.productName || '',
        designation: order.designation || '',
        articleNumber: product?.articleNumber || '',
        material: order.material || '',
        surfaceTreatment: order.surfaceTreatment || '',
        amountPc: order.amountPc || 0,
        weightPerPiece: product?.weightPerPiece || '',
        nestCount: product?.nestCount || '',
        cycleTime: product?.cycleTime || '',
        postProcessingTime: product?.postProcessingTime || '',
        postProcessing: product?.postProcessing || '',
        boxSize: product?.boxSize || '',
        piecesPerBox: product?.piecesPerBox || '',
        boxesCount: order.boxesCount || 0,
        boxesPerPallet: product?.boxesPerPallet || '',
        palletsCount: order.palletsCount || 0,
        requiredMaterialKg: order.requiredMaterialKg || '',
        grossWeightKg: order.grossWeightKg || '',
        plannedProductionHours: order.plannedProductionHours || '',
        warehouse: product?.warehouse || '',
        spruWeight: product?.spruWeight || '',
        orderDate: order.orderDate || '',
        requiredDate: order.requiredDate || '',
        pickupDate: order.pickupDate || '',
        orderNotes: order.notes || '',
        productNotes: product?.notes || '',
        status: order.status || '',
        deliveryNoteNumber: finalDeliveryNote,
        senderName: effectiveSettings.senderName,
        senderAddress: effectiveSettings.senderAddress,
        senderCity: '',
        senderCountry: '',
        consigneeName: order.customer || '',
        consigneeLanguage: customerInfo?.language || '',
        consigneeFullAddress: customerInfo?.fullAddress || `${customerInfo?.street || ''}, ${customerInfo?.city || ''}, ${customerInfo?.postalCode || ''}, ${customerInfo?.country || ''}`,
        consigneeStreet: customerInfo?.street || '',
        consigneeCity: customerInfo?.city || '',
        consigneePostalCode: customerInfo?.postalCode || '',
        consigneeCountry: customerInfo?.country || '',
        consigneeTaxNumber: customerInfo?.taxNumber || '',
        packagingDescription: `${order.boxesCount || 0} doboz, ${order.palletsCount || 0} raklap`,
      }

      const row: ExportRow = {}
      templateFields.forEach(field => {
        const label = field.label
        const value = fieldValueMap[field.id]
        row[label] = value !== undefined ? value : ''
      })

      return row
    })
  }

  const initialData = useMemo(() => buildExportData(), [orders, customers, products, exportType])

  useEffect(() => {
    if (open) {
      const seqNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, exportType)
      setGeneratedSequenceNumber(seqNumber)
      setDeliveryNoteNumber(seqNumber)
      setEditableData(initialData)
      setEditingCell(null)
      setHasChanges(false)
    }
  }, [open, initialData, deliveryNotes, exportType])

  useEffect(() => {
    if (deliveryNoteNumber.trim()) {
      const updatedData = buildExportData(deliveryNoteNumber.trim())
      setEditableData(updatedData)
      setHasChanges(true)
    }
  }, [deliveryNoteNumber])

  const columnHeaders = useMemo(() => {
    if (!editableData || editableData.length === 0 || !editableData[0]) return []
    return Object.keys(editableData[0])
  }, [editableData])

  const handleCellChange = (rowIndex: number, field: string, value: string | number) => {
    setEditableData((current) =>
      current.map((row, idx) =>
        idx === rowIndex ? { ...row, [field]: value } : row
      )
    )
    setHasChanges(true)
  }

  const handleCellClick = (rowIndex: number, field: string) => {
    setEditingCell({ rowIndex, field })
  }

  const handleCellBlur = () => {
    setEditingCell(null)
  }

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const firstCustomer = orders[0]?.customer || 'export'
      const firstWord = firstCustomer.split(/\s+/)[0] || 'export'
      const safeCustomerName = firstWord.replace(/[^a-zA-Z0-9_-]/g, '_')
      const fileName = `${generatedSequenceNumber}_${safeCustomerName}.xlsx`

      let blob: Blob
      if (exportType === 'cmr') {
        try {
          const effectiveSettings = { ...DEFAULT_CMR_SETTINGS, ...cmrSettings }
          blob = await generateCmrTemplateWorkbook({ rows: editableData, settings: effectiveSettings })
        } catch (templateError) {
          console.warn('CMR template export fallback:', templateError)

          const XLSX = await import('xlsx')
          const worksheet = XLSX.utils.json_to_sheet(editableData)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'CMR')
          const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
          blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

          toast.warning('A CMR sablon nem elérhető, alap táblázatos export készült')
        }
      } else {
        const XLSX = await import('xlsx')
        const worksheet = XLSX.utils.json_to_sheet(editableData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Szállító')
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
        blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      }

      downloadBlob(blob, fileName)

      if (onExportSaved) {
        const exportDate = new Date().toISOString().split('T')[0]
        onExportSaved({
          type: exportType,
          customer: firstCustomer,
          orderIds: orders.map(o => o.id),
          fileName,
          exportDate,
          exportData: editableData,
        }, deliveryNoteNumber.trim())
      }
      
      toast.success(
        <div className="flex flex-col gap-1">
          <p className="font-medium">Export sikeres!</p>
          <p className="text-xs text-muted-foreground">Fájl: {fileName}</p>
          <p className="text-xs text-muted-foreground">Ellenőrizd a böngésződ letöltési mappáját</p>
        </div>,
        { duration: 5000 }
      )
      onClose()
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Hiba történt az export során')
    } finally {
      setIsExporting(false)
    }
  }



  const renderCell = (rowIndex: number, header: string, value: string | number | null | undefined) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === header
    const displayValue = value ?? ''

    if (isEditing) {
      if (typeof value === 'number' || header.includes('(db)') || header.includes('száma')) {
        return (
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleCellChange(rowIndex, header, Number(e.target.value) || 0)}
            onBlur={handleCellBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                handleCellBlur()
              }
            }}
            autoFocus
            className="h-8 text-sm"
          />
        )
      }

      if (header.includes('Megjegyzés') || header.includes('leírás')) {
        return (
          <Textarea
            value={String(displayValue)}
            onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleCellBlur()
              }
            }}
            autoFocus
            className="min-h-[60px] text-sm"
            rows={2}
          />
        )
      }

      return (
        <Input
          value={String(displayValue)}
          onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
          onBlur={handleCellBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              handleCellBlur()
            }
          }}
          autoFocus
          className="h-8 text-sm"
        />
      )
    }

    const initialRow = initialData[rowIndex] as ExportRow | undefined
    const isModified = JSON.stringify(value) !== JSON.stringify(initialRow?.[header])
    
    return (
      <div
        onClick={() => handleCellClick(rowIndex, header)}
        className={`cursor-pointer hover:bg-accent/50 p-1 rounded min-h-[32px] flex items-center group transition-colors ${
          isModified ? 'bg-accent/20 border-l-2 border-l-accent' : ''
        }`}
        title="Kattints a szerkesztéshez"
      >
        <span className="flex-1">{String(displayValue)}</span>
        {isModified ? (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-2">
            módosítva
          </Badge>
        ) : (
          <PencilSimple className="w-3 h-3 opacity-0 group-hover:opacity-50 ml-2" />
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileArrowDown className="w-5 h-5" />
              Export előnézet: {exportType === 'delivery' ? 'Szállítólevél' : 'CMR'}
            </DialogTitle>
            {hasChanges && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Warning className="w-3 h-3" weight="fill" />
                Nem mentett módosítások
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {orders.length} rendelés exportálása - {orders[0]?.customer}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <PencilSimple className="w-4 h-4" />
            <span>Kattints bármelyik cellára a szerkesztéshez • Enter/Escape a befejezéshez</span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full border rounded-md">
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnHeaders.map((header) => (
                    <TableHead key={header} className="whitespace-nowrap font-semibold bg-muted/50">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    {columnHeaders.map((header) => (
                      <TableCell key={header} className="p-0">
                        {renderCell(idx, header, row[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        <div className="space-y-3">
          <div className="border rounded-md p-3 bg-muted/20">
            <Label htmlFor="delivery-note-number" className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4" />
              Szállítólevél száma (opcionális)
            </Label>
            <Input
              id="delivery-note-number"
              value={deliveryNoteNumber}
              onChange={(e) => setDeliveryNoteNumber(e.target.value)}
              placeholder="Pl.: SZL-2025-001 vagy több szám vesszővel elválasztva"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A szám automatikusan bekerül az export táblázatba és a rendelésekhez lesz csatolva mentéskor
            </p>
            {deliveryNoteNumber.trim() && (
              <div className="mt-2 flex items-center gap-2 text-xs text-success">
                <Check className="w-3 h-3" weight="bold" />
                <span>Szállítólevél szám hozzáadva az összes rendeléshez</span>
              </div>
            )}
          </div>

          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium mb-1">Export információk:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Sorszám: <span className="font-mono font-semibold text-foreground">{generatedSequenceNumber}</span></li>
                  <li>Összes oszlop: {columnHeaders.length}</li>
                  <li>Sorok száma: {editableData.length}</li>
                  <li>Típus: {exportType === 'delivery' ? 'Szállítólevél' : 'CMR dokumentum'}</li>
                  <li>Fájlformátum: Excel (.xlsx)</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileArrowDown className="w-4 h-4" />
                  <span>A fájl a böngésző letöltési mappájába kerül</span>
                </div>
                {hasChanges && (
                  <div className="flex items-center gap-2 text-warning">
                    <Check className="w-4 h-4" />
                    <span>Módosítások mentésre kerülnek</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Mégse
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            <FileArrowDown className="w-4 h-4 mr-2" />
            {isExporting ? 'Exportálás...' : hasChanges ? 'Excel letöltés módosításokkal' : 'Excel letöltés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
