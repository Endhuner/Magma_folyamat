import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface DocumentFilterDialogProps {
  open: boolean
  onClose: () => void
  onSave: (filter: { name: string; columns: string[] }) => void
}

const AVAILABLE_COLUMNS = [
  { id: 'sequenceNumber', label: 'Sorszám' },
  { id: 'type', label: 'Típus' },
  { id: 'orderNumbers', label: 'Rendelés számok' },
  { id: 'customerName', label: 'Vevő' },
  { id: 'totalWeight', label: 'Össz súly' },
  { id: 'totalPallets', label: 'Össz raklap' },
  { id: 'createdAt', label: 'Létrehozva' },
]

export function DocumentFilterDialog({ open, onClose, onSave }: DocumentFilterDialogProps) {
  const [filterName, setFilterName] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  const handleSave = () => {
    if (!filterName.trim()) {
      return
    }
    
    onSave({
      name: filterName.trim(),
      columns: selectedColumns,
    })
    
    setFilterName('')
    setSelectedColumns([])
    onClose()
  }

  const toggleColumn = (columnId: string) => {
    setSelectedColumns((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Új Szűrő Létrehozása</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filter-name">Szűrő neve</Label>
            <Input
              id="filter-name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="pl. Csak CMR dokumentumok"
            />
          </div>

          <div className="space-y-2">
            <Label>Megjelenítendő oszlopok</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {AVAILABLE_COLUMNS.map((column) => (
                <div key={column.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`column-${column.id}`}
                    checked={selectedColumns.includes(column.id)}
                    onCheckedChange={() => toggleColumn(column.id)}
                  />
                  <Label
                    htmlFor={`column-${column.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={!filterName.trim() || selectedColumns.length === 0}>
            Létrehozás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
