import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Funnel, Plus, Trash, CaretDown } from '@phosphor-icons/react'
import { ColumnFilter } from '@/lib/types'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

const AVAILABLE_COLUMNS = [
  { id: 'sequenceNumber', label: 'Sorszám' },
  { id: 'type', label: 'Típus' },
  { id: 'customer', label: 'Vevő' },
  { id: 'orderNumbers', label: 'Rendelések' },
  { id: 'orderCount', label: 'Darab' },
  { id: 'fileName', label: 'Fájl név' },
  { id: 'createdAt', label: 'Export dátum' },
  { id: 'actions', label: 'Műveletek' },
]

interface ColumnFilterManagerProps {
  activeFilter: ColumnFilter | null
  onFilterSelect: (filter: ColumnFilter | null) => void
}

export function ColumnFilterManager({ activeFilter, onFilterSelect }: ColumnFilterManagerProps) {
  const [filters, setFilters] = useKV<ColumnFilter[]>('document-column-filters', [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(AVAILABLE_COLUMNS.map(c => c.id))

  const handleCreateFilter = () => {
    if (!filterName.trim()) {
      toast.error('Kérem adjon nevet a szűrőnek')
      return
    }

    if (selectedColumns.length === 0) {
      toast.error('Kérem válasszon ki legalább egy oszlopot')
      return
    }

    const newFilter: ColumnFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      columns: selectedColumns,
      createdAt: new Date().toISOString(),
    }

    setFilters((current) => [...(current || []), newFilter])
    toast.success(`Szűrő létrehozva: ${newFilter.name}`)
    
    setFilterName('')
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id))
    setDialogOpen(false)
  }

  const handleDeleteFilter = (filterId: string) => {
    const filterToDelete = filters?.find(f => f.id === filterId)
    if (!filterToDelete) return

    setFilters((current) => (current || []).filter(f => f.id !== filterId))
    
    if (activeFilter?.id === filterId) {
      onFilterSelect(null)
    }
    
    toast.success(`Szűrő törölve: ${filterToDelete.name}`)
  }

  const handleOpenDialog = () => {
    setFilterName('')
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id))
    setDialogOpen(true)
  }

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      setSelectedColumns(selectedColumns.filter(c => c !== columnId))
    } else {
      setSelectedColumns([...selectedColumns, columnId])
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Funnel className="w-4 h-4" />
            {activeFilter ? activeFilter.name : 'Oszlop szűrő'}
            <CaretDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={handleOpenDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Új szűrő
          </DropdownMenuItem>
          
          {(filters && filters.length > 0) && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Mentett szűrők
              </div>
              
              {activeFilter && (
                <DropdownMenuItem onSelect={() => onFilterSelect(null)}>
                  Minden oszlop
                </DropdownMenuItem>
              )}
              
              {filters.map((filter) => (
                <DropdownMenuItem
                  key={filter.id}
                  onSelect={() => onFilterSelect(filter)}
                  className="flex items-center justify-between group"
                >
                  <span className={activeFilter?.id === filter.id ? 'font-semibold' : ''}>
                    {filter.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFilter(filter.id)
                    }}
                  >
                    <Trash className="w-3 h-3 text-destructive" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Új oszlop szűrő létrehozása</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Szűrő neve</Label>
              <Input
                id="filter-name"
                placeholder="pl. Exportált dokumentumok"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Megjelenítendő oszlopok</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-[300px] overflow-y-auto">
                {AVAILABLE_COLUMNS.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`column-${column.id}`}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                    />
                    <label
                      htmlFor={`column-${column.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {column.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedColumns.length} oszlop kiválasztva
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreateFilter}>
              Szűrő létrehozása
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
