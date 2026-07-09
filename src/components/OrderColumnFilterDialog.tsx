import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

interface OrderColumnFilterDialogProps {
  open: boolean
  onClose: () => void
  onSave: (filter: { name: string; columns: string[] }) => void
  /** Ha meg van adva, a dialógus szerkesztő módban nyílik ennek az értékeivel. */
  initialFilter?: { name: string; columns: string[] } | null
}

const AVAILABLE_COLUMNS = [
  { id: 'customer', label: 'Customer' },
  { id: 'productName', label: 'Termék neve' },
  { id: 'designation', label: 'Megnevezése' },
  { id: 'notes', label: 'Megjegyzés' },
  { id: 'pos', label: 'Pos (pozíció)' },
  { id: 'ownOrderNumber', label: 'Saját rendelési szám' },
  { id: 'material', label: 'Anyag' },
  { id: 'orderNumber', label: 'Vevő rendelési száma' },
  { id: 'amountPc', label: 'Amount/pc' },
  { id: 'orderDate', label: 'Order date' },
  { id: 'requiredDate', label: 'Required delivery date' },
  { id: 'pickupDate', label: 'CMR / Szállítólevél dátuma' },
  { id: 'invoiced', label: 'Számlázva (x)' },
  { id: 'ready', label: 'Szállításra kész' },
  { id: 'surfaceTreatment', label: 'Felületkezelés' },
  { id: 'boxesCount', label: 'Dobozok száma' },
  { id: 'palletsCount', label: 'Össz raklapok száma' },
  { id: 'grossWeightKg', label: 'Össz bruttó súly' },
  { id: 'requiredMaterialKg', label: 'Szükséges anyagmennyiség' },
  { id: 'plannedProductionHours', label: 'Tervezett gyártási idő' },
  { id: 'deliveryNote', label: 'Szállítólevél' },
  { id: 'cmr', label: 'CMR' },
  { id: 'status', label: 'Státusz' },
]

export function OrderColumnFilterDialog({ open, onClose, onSave, initialFilter }: OrderColumnFilterDialogProps) {
  const [filterName, setFilterName] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(AVAILABLE_COLUMNS.map(c => c.id))
  const isEditing = !!initialFilter

  // Nyitáskor töltsük be a szerkesztendő szűrő értékeit (vagy az alapállapotot).
  useEffect(() => {
    if (open) {
      setFilterName(initialFilter?.name ?? '')
      setSelectedColumns(initialFilter?.columns ?? AVAILABLE_COLUMNS.map(c => c.id))
    }
  }, [open, initialFilter])

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      setSelectedColumns(selectedColumns.filter(id => id !== columnId))
    } else {
      setSelectedColumns([...selectedColumns, columnId])
    }
  }

  const toggleSelectAll = () => {
    if (selectedColumns.length === AVAILABLE_COLUMNS.length) {
      setSelectedColumns([])
    } else {
      setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id))
    }
  }

  const handleSave = () => {
    if (!filterName.trim()) {
      return
    }
    
    onSave({
      name: filterName.trim(),
      columns: selectedColumns,
    })
    
    setFilterName('')
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id))
    onClose()
  }

  const handleClose = () => {
    setFilterName('')
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Oszlop szűrő szerkesztése' : 'Új Oszlop Szűrő Létrehozása'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="filter-name">Szűrő neve</Label>
            <Input
              id="filter-name"
              placeholder="pl. Alapvető információk"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Látható oszlopok</Label>
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectedColumns.length === AVAILABLE_COLUMNS.length ? 'Összes törlése' : 'Összes kijelölése'}
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-3">
                {AVAILABLE_COLUMNS.map((column) => (
                  <div key={column.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={column.id}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                    />
                    <Label
                      htmlFor={column.id}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {column.label}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-sm text-muted-foreground">
              {selectedColumns.length} / {AVAILABLE_COLUMNS.length} oszlop kiválasztva
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={!filterName.trim() || selectedColumns.length === 0}>
            {isEditing ? 'Módosítások mentése' : 'Szűrő mentése'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
