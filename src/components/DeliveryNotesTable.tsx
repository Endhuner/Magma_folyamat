import { memo, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { DeliveryNote, Order, Customer, Product, ColumnFilter } from '@/lib/types'
import { Trash, FileText, FileCsv, Eye, FileArrowDown, MagnifyingGlass, X, PencilSimple, Funnel, CalendarBlank, TrendUp, Envelope, Package, Plus, FilePdf } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { toast } from 'sonner'
import { utils, write } from 'xlsx'
import { downloadBlob } from '@/lib/xlsxTemplateExport'
import { ExportEditDialog } from '@/components/ExportEditDialog'
import { ColumnFilterManager } from '@/components/ColumnFilterManager'

interface DeliveryNotesTableProps {
  deliveryNotes: DeliveryNote[]
  orders: Order[]
  customers: Customer[]
  products: Product[]
  onDelete: (id: string) => void
  onUpdate?: (id: string, updatedData: Record<string, string | number | null | undefined>[]) => void
  /** Kiegészítő tételek szerkesztése (szerszám/anyag/szabad sor a nyomtatványra). */
  onEditExtraItems?: (note: DeliveryNote) => void
  /** Új szállítólevél/CMR készítése rendelés-kiválasztással. */
  onCreateNew?: () => void
  /** PDF letöltés (szerver-oldali generálás + mentés a PDF-mappába). */
  onDownloadPdf?: (note: DeliveryNote) => void
  visibleColumns?: string[]
}

function DeliveryNotesTableImpl({ deliveryNotes, orders, customers, products, onDelete, onUpdate, onEditExtraItems, onCreateNew, onDownloadPdf, visibleColumns }: DeliveryNotesTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'cmr'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [activeColumnFilter, setActiveColumnFilter] = useState<ColumnFilter | null>(null)

  // orderId → Order térkép egyszer, hogy a getOrderNumbers ne O(n) find-oljon
  // soronként (100 szállítólevél × 5000 rendelés = milliós keresés helyett O(1)).
  const orderById = useMemo(
    () => new Map(orders.map((o) => [o.id, o])),
    [orders]
  )

  const sortedNotes = useMemo(() => {
    return [...deliveryNotes].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [deliveryNotes])

  const filteredNotes = useMemo(() => {
    let filtered = sortedNotes
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(note => note.type === typeFilter)
    }
    
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.createdAt)
        
        if (dateFilter === 'today') {
          return noteDate >= today
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          return noteDate >= weekAgo
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today)
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          return noteDate >= monthAgo
        }
        return true
      })
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(note => 
        note.customer.toLowerCase().includes(query) ||
        note.fileName.toLowerCase().includes(query) ||
        note.type.toLowerCase().includes(query) ||
        note.sequenceNumber.toLowerCase().includes(query) ||
        getOrderNumbers(note.orderIds).toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [sortedNotes, searchQuery, typeFilter, dateFilter, orders])

  const getOrderNumbers = (orderIds: string[]) => {
    const orderNumbers = orderIds
      .map(id => orderById.get(id)?.ownOrderNumber)
      .filter(Boolean)
    
    if (orderNumbers.length === 0) return '-'
    if (orderNumbers.length <= 3) return orderNumbers.join(', ')
    return `${orderNumbers.slice(0, 3).join(', ')} (+${orderNumbers.length - 3})`
  }

  const isColumnVisible = (columnId: string) => {
    if (!activeColumnFilter) return true
    return activeColumnFilter.columns.includes(columnId)
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return format(date, 'yyyy. MM. dd. HH:mm', { locale: hu })
    } catch {
      return dateStr
    }
  }

  const handleViewDetails = (note: DeliveryNote) => {
    setSelectedNote(note)
    setViewDialogOpen(true)
  }

  const handleOpenPreview = (note: DeliveryNote) => {
    if (!note.exportData || note.exportData.length === 0) {
      toast.error('Nincs mentett adat ehhez az exporthoz')
      return
    }
    setSelectedNote(note)
    setPreviewDialogOpen(true)
  }

  const handleReExportFromPreview = async (exportData: Record<string, string | number | null | undefined>[]) => {
    if (!selectedNote) return

    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const fileName = `${selectedNote.type === 'delivery' ? 'Szallito' : 'CMR'}_${selectedNote.customer.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.xlsx`

      const sheetName = selectedNote.type === 'cmr' ? 'CMR' : 'Szállító'
      const worksheet = utils.json_to_sheet(exportData)
      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, sheetName)
      const wbout = write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      downloadBlob(blob, fileName)

      if (onUpdate && selectedNote.id) {
        onUpdate(selectedNote.id, exportData)
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <p className="font-medium">Export sikeres!</p>
          <p className="text-xs text-muted-foreground">Fájl: {fileName}</p>
        </div>,
        { duration: 5000 }
      )

      setPreviewDialogOpen(false)
    } catch (error) {
      console.error('Re-export error:', error)
      toast.error('Hiba történt az export során')
    }
  }

  const handleReExport = async (note: DeliveryNote) => {
    try {
      const noteOrders = orders.filter(o => note.orderIds.includes(o.id))
      if (noteOrders.length === 0) {
        toast.error('Nem találhatóak a rendelések ehhez a szállítólevélhez')
        return
      }

      const firstCustomer = noteOrders[0]?.customer
      const customerInfo = customers.find(c => c.name === firstCustomer)

      const exportData = noteOrders.map(order => {
        const product = products.find(p => 
          p.customer === order.customer && 
          (p.productName === order.productName || p.drawingNumber === order.productName)
        )

        if (note.type === 'delivery') {
          return {
            'Saját rendelési szám': order.ownOrderNumber || '',
            'Vevő rendelési száma': order.orderNumber || '',
            'Vevő neve': order.customer || '',
            'Vevő nyelve': customerInfo?.language || '',
            'Vevő címe': customerInfo?.fullAddress || '',
            'Utca, házszám': customerInfo?.street || '',
            'Város': customerInfo?.city || '',
            'Irányítószám': customerInfo?.postalCode || '',
            'Ország': customerInfo?.country || '',
            'Adószám': customerInfo?.taxNumber || '',
            'Termék rajzszáma': product?.drawingNumber || '',
            'Termék neve': order.productName || '',
            'Termék megnevezés': order.designation || '',
            'Cikkszám': product?.articleNumber || '',
            'Anyag': order.material || '',
            'Felületkezelés': order.surfaceTreatment || '',
            'Mennyiség (db)': order.amountPc || 0,
            'Súly/db': product?.weightPerPiece || '',
            'Fészekszám': product?.nestCount || '',
            'Ciklus idő': product?.cycleTime || '',
            'Utómunka idő': product?.postProcessingTime || '',
            'Utómunkák': product?.postProcessing || '',
            'Doboz méret': product?.boxSize || '',
            'Doboz/db (db/doboz)': product?.piecesPerBox || '',
            'Dobozok száma': order.boxesCount || 0,
            'Doboz/Raklap (doboz/raklap)': product?.boxesPerPallet || '',
            'Raklapok száma': order.palletsCount || 0,
            'Szükséges anyagmennyiség': order.requiredMaterialKg || '',
            'Össz bruttó súly': order.grossWeightKg || '',
            'Tervezett gyártási idő': order.plannedProductionHours || '',
            'Raktár': product?.warehouse || '',
            'Engusz súly': product?.spruWeight || '',
            'Rendelés dátuma': order.orderDate || '',
            'Szállítási határidő': order.requiredDate || '',
            'Tényleges felvétel': order.pickupDate || '',
            'Megjegyzés (rendelés)': order.notes || '',
            'Megjegyzés (termék)': product?.notes || '',
            'Státusz': order.status || ''
          }
        } else {
          return {
            'Feladó név': 'ProduktívPro',
            'Feladó cím': '',
            'Feladó város': '',
            'Feladó ország': '',
            'Címzett név': order.customer || '',
            'Címzett nyelv': customerInfo?.language || '',
            'Címzett teljes cím': customerInfo?.fullAddress || '',
            'Címzett utca': customerInfo?.street || '',
            'Címzett város': customerInfo?.city || '',
            'Címzett irányítószám': customerInfo?.postalCode || '',
            'Címzett ország': customerInfo?.country || '',
            'Címzett adószám': customerInfo?.taxNumber || '',
            'Saját rendelési szám': order.ownOrderNumber || '',
            'Vevő rendelési száma': order.orderNumber || '',
            'Termék rajzszáma': product?.drawingNumber || '',
            'Termék neve': order.productName || '',
            'Termék megnevezés': order.designation || '',
            'Cikkszám': product?.articleNumber || '',
            'Mennyiség (db)': order.amountPc || 0,
            'Dobozok száma': order.boxesCount || 0,
            'Raklapok száma': order.palletsCount || 0,
            'Össz bruttó súly': order.grossWeightKg || '',
            'Szükséges anyagmennyiség': order.requiredMaterialKg || '',
            'Csomagolás leírás': `${order.boxesCount || 0} doboz, ${order.palletsCount || 0} raklap`,
            'Anyag': order.material || '',
            'Felületkezelés': order.surfaceTreatment || '',
            'Rendelés dátuma': order.orderDate || '',
            'Szállítási határidő': order.requiredDate || '',
            'Tényleges felvétel': order.pickupDate || '',
            'Megjegyzés (rendelés)': order.notes || '',
            'Megjegyzés (termék)': product?.notes || '',
            'Státusz': order.status || ''
          }
        }
      })

      const safeCustomerName = firstCustomer.replace(/[^a-zA-Z0-9_-]/g, '_')
      const timestamp = new Date().toISOString().split('T')[0]
      const fileName = `${note.type === 'delivery' ? 'Szallito' : 'CMR'}_${safeCustomerName}_${timestamp}.xlsx`

      const sheetName = note.type === 'cmr' ? 'CMR' : 'Szállító'
      const worksheet = utils.json_to_sheet(exportData)
      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, sheetName)
      const wbout = write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      downloadBlob(blob, fileName)

      toast.success(
        <div className="flex flex-col gap-1">
          <p className="font-medium">Újra exportálva!</p>
          <p className="text-xs text-muted-foreground">Fájl: {fileName}</p>
        </div>,
        { duration: 5000 }
      )
    } catch (error) {
      console.error('Re-export error:', error)
      toast.error('Hiba történt az export során')
    }
  }

  if (sortedNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
        <FileText className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
        <h3 className="text-xl font-semibold mb-2">Nincs szállítólevél</h3>
        <p className="text-muted-foreground max-w-md">
          Exportáld a rendeléseket szállítólevél vagy CMR formátumban a Rendelések fülön
        </p>
      </div>
    )
  }

  return (
    <>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-6 h-6 text-primary" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Összes dokumentum</p>
              <p className="text-2xl font-bold font-mono">{sortedNotes.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="w-6 h-6 text-accent" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Szállítólevelek</p>
              <p className="text-2xl font-bold font-mono">
                {sortedNotes.filter(n => n.type === 'delivery').length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <FileCsv className="w-6 h-6 text-secondary" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CMR dokumentumok</p>
              <p className="text-2xl font-bold font-mono">
                {sortedNotes.filter(n => n.type === 'cmr').length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendUp className="w-6 h-6 text-success" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ma létrehozva</p>
              <p className="text-2xl font-bold font-mono">
                {sortedNotes.filter(n => {
                  const noteDate = new Date(n.createdAt)
                  const today = new Date()
                  return noteDate.toDateString() === today.toDateString()
                }).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {onCreateNew && (
            <Button onClick={onCreateNew} className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />
              Új szállítólevél / CMR
            </Button>
          )}
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Keresés sorszám, vevő, fájlnév vagy rendelési szám szerint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <Select value={typeFilter} onValueChange={(value: 'all' | 'delivery' | 'cmr') => setTypeFilter(value)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Funnel className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden típus</SelectItem>
              <SelectItem value="delivery">Szállítólevél</SelectItem>
              <SelectItem value="cmr">CMR</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={dateFilter} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setDateFilter(value)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <CalendarBlank className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden időszak</SelectItem>
              <SelectItem value="today">Ma</SelectItem>
              <SelectItem value="week">Utolsó 7 nap</SelectItem>
              <SelectItem value="month">Utolsó 30 nap</SelectItem>
            </SelectContent>
          </Select>

          <ColumnFilterManager 
            activeFilter={activeColumnFilter}
            onFilterSelect={setActiveColumnFilter}
          />
        </div>
        
        {(searchQuery || typeFilter !== 'all' || dateFilter !== 'all') && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredNotes.length} találat {sortedNotes.length} dokumentum közül
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setTypeFilter('all')
                setDateFilter('all')
              }}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Szűrők törlése
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-lg">
        <ScrollArea className="w-full whitespace-nowrap">
        <Table>
          <TableHeader>
            <TableRow>
              {isColumnVisible('sequenceNumber') && <TableHead className="w-[140px]">Sorszám</TableHead>}
              {isColumnVisible('type') && <TableHead className="w-[140px]">Típus</TableHead>}
              {isColumnVisible('customer') && <TableHead>Vevő</TableHead>}
              {isColumnVisible('orderNumbers') && <TableHead>Rendelések</TableHead>}
              {isColumnVisible('orderCount') && <TableHead className="w-[100px] text-center">Darab</TableHead>}
              {isColumnVisible('fileName') && <TableHead>Fájl név</TableHead>}
              {isColumnVisible('createdAt') && <TableHead className="w-[180px]">Export dátum</TableHead>}
              {isColumnVisible('actions') && <TableHead className="w-[200px] text-right">Műveletek</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nincs találat a keresési feltételeknek megfelelően
                </TableCell>
              </TableRow>
            ) : (
              filteredNotes.map((note, index) => (
                <TableRow key={note.id} className="even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]">
                  {isColumnVisible('sequenceNumber') && (
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {note.sequenceNumber}
                      </Badge>
                    </TableCell>
                  )}
                  {isColumnVisible('type') && (
                    <TableCell>
                      <Badge 
                        variant={note.type === 'delivery' ? 'default' : 'secondary'}
                        className="gap-1"
                      >
                        {note.type === 'delivery' ? (
                          <>
                            <FileText className="w-3 h-3" />
                            Szállítólevél
                          </>
                        ) : (
                          <>
                            <FileCsv className="w-3 h-3" />
                            CMR
                          </>
                        )}
                      </Badge>
                    </TableCell>
                  )}
                  {isColumnVisible('customer') && (
                    <TableCell className="font-medium">{note.customer}</TableCell>
                  )}
                  {isColumnVisible('orderNumbers') && (
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {getOrderNumbers(note.orderIds)}
                    </TableCell>
                  )}
                  {isColumnVisible('orderCount') && (
                    <TableCell className="text-center font-mono">
                      {note.orderIds.length}
                    </TableCell>
                  )}
                  {isColumnVisible('fileName') && (
                    <TableCell className="font-mono text-sm">
                      {note.fileName}
                    </TableCell>
                  )}
                  {isColumnVisible('createdAt') && (
                    <TableCell className="text-muted-foreground">
                      {formatDate(note.createdAt)}
                    </TableCell>
                  )}
                  {isColumnVisible('actions') && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(note)}
                          className="h-8 w-8 coarse:h-10 coarse:w-10"
                          title="Részletek megtekintése"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {note.exportData && note.exportData.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPreview(note)}
                            className="h-8 w-8 coarse:h-10 coarse:w-10"
                            title="Előnézet és szerkesztés"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </Button>
                        )}
                        {onEditExtraItems && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditExtraItems(note)}
                            className="h-8 w-8 coarse:h-10 coarse:w-10 relative"
                            title="Kiegészítő tételek (szerszám / anyag / szabad sor)"
                          >
                            <Package className="w-4 h-4" />
                            {(note.extraItems?.length ?? 0) > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-4">
                                {note.extraItems!.length}
                              </span>
                            )}
                          </Button>
                        )}
                        {onDownloadPdf && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDownloadPdf(note)}
                            className="h-8 w-8 coarse:h-10 coarse:w-10 text-red-600"
                            title="PDF letöltés (a szerver PDF-mappájába is menti)"
                          >
                            <FilePdf className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReExport(note)}
                          className="h-8 w-8 coarse:h-10 coarse:w-10"
                          title="Excel újra letöltés"
                        >
                          <FileArrowDown className="w-4 h-4" />
                        </Button>
                        {(() => {
                          const customer = customers.find(c => c.name === note.customer)
                          const email = customer?.email
                          const docLabel = note.type === 'cmr' ? 'CMR' : 'Szállítólevél'
                          const subject = encodeURIComponent(`${docLabel} – ${note.sequenceNumber}`)
                          const body = encodeURIComponent(
                            `Tisztelt ${note.customer}!\n\nMellékeljük a(z) ${note.sequenceNumber} számú ${docLabel.toLowerCase()}t.\n\nÜdvözlettel,\nMagma Kft`
                          )
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 coarse:h-10 coarse:w-10"
                              title={email ? `Email küldése: ${email}` : 'Az ügyfélnek nincs email-címe'}
                              disabled={!email}
                              asChild={!!email}
                            >
                              {email ? (
                                <a href={`mailto:${email}?subject=${subject}&body=${body}`}>
                                  <Envelope className="w-4 h-4" />
                                </a>
                              ) : (
                                <span><Envelope className="w-4 h-4" /></span>
                              )}
                            </Button>
                          )
                        })()}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(note.id)}
                          className="h-8 w-8 coarse:h-10 coarse:w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Törlés"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNote?.type === 'delivery' ? (
                <>
                  <FileText className="w-5 h-5" />
                  Szállítólevél részletei
                </>
              ) : (
                <>
                  <FileCsv className="w-5 h-5" />
                  CMR részletei
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sorszám</label>
                  <p className="text-base font-mono font-semibold">{selectedNote.sequenceNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Típus</label>
                  <p className="text-base font-semibold">
                    {selectedNote.type === 'delivery' ? 'Szállítólevél' : 'CMR'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vevő</label>
                  <p className="text-base font-semibold">{selectedNote.customer}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Export dátum</label>
                  <p className="text-base">{formatDate(selectedNote.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fájl név</label>
                  <p className="text-base font-mono text-sm">{selectedNote.fileName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Rendelések száma</label>
                  <p className="text-base font-mono">{selectedNote.orderIds.length} db</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Sablon forrás</label>
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {selectedNote.type === 'cmr' 
                      ? 'src/lib/cmrDirectExport.ts (ExcelJS programozott generálás)'
                      : 'src/lib/deliveryExcelJSExport.ts (ExcelJS programozott generálás)'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Rendelési számok</label>
                <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                  {selectedNote.orderIds.map(orderId => {
                    const order = orders.find(o => o.id === orderId)
                    return (
                      <div key={orderId} className="flex items-center gap-2 py-1">
                        <Badge variant="outline" className="font-mono">
                          {order?.ownOrderNumber || orderId}
                        </Badge>
                        {order && (
                          <span className="text-sm text-muted-foreground">
                            {order.productName} - {order.amountPc} db
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Bezárás
            </Button>
            <Button onClick={() => {
              if (selectedNote) {
                handleReExport(selectedNote)
                setViewDialogOpen(false)
              }
            }}>
              <FileArrowDown className="w-4 h-4 mr-2" />
              Újra letöltés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedNote && selectedNote.exportData && (
        <ExportEditDialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          exportData={selectedNote.exportData}
          title={`Szerkesztés: ${selectedNote.type === 'delivery' ? 'Szállítólevél' : 'CMR'}`}
          subtitle={`Eredeti export: ${formatDate(selectedNote.createdAt)} - ${selectedNote.customer}`}
          onExport={handleReExportFromPreview}
        />
      )}
    </>
  )
}

export const DeliveryNotesTable = memo(DeliveryNotesTableImpl)
