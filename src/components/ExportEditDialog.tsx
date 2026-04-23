import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileArrowDown, X, FloppyDisk, ArrowCounterClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ExportEditDialogProps {
  open: boolean
  onClose: () => void
  exportData: Record<string, string | number | null | undefined>[]
  title: string
  subtitle: string
  onExport: (data: Record<string, string | number | null | undefined>[]) => void
}

export function ExportEditDialog({
  open,
  onClose,
  exportData,
  title,
  subtitle,
  onExport
}: ExportEditDialogProps) {
  const [editedData, setEditedData] = useState<Record<string, string | number | null | undefined>[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (open) {
      setEditedData(JSON.parse(JSON.stringify(exportData)))
      setHasChanges(false)
    }
  }, [open, exportData])

  const handleCellEdit = (rowIndex: number, key: string, value: string) => {
    const newData = [...editedData]
    newData[rowIndex] = { ...newData[rowIndex], [key]: value }
    setEditedData(newData)
    setHasChanges(true)
  }

  const handleReset = () => {
    setEditedData(JSON.parse(JSON.stringify(exportData)))
    setHasChanges(false)
    toast.success('Változtatások visszavonva')
  }

  const handleExport = () => {
    onExport(editedData)
  }

  if (!exportData || exportData.length === 0) return null

  const keys = Object.keys(exportData[0] || {})

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
          {hasChanges && (
            <Badge variant="default" className="w-fit">
              Nem mentett változtatások
            </Badge>
          )}
        </DialogHeader>
        
        <ScrollArea className="flex-1 border rounded-md">
          <div className="min-w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[60px] bg-muted">#</TableHead>
                  {keys.map((key) => (
                    <TableHead key={key} className="min-w-[150px] bg-muted font-semibold">
                      {key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell className="font-mono text-xs text-muted-foreground bg-muted/50">
                      {rowIndex + 1}
                    </TableCell>
                    {keys.map((key) => (
                      <TableCell key={key} className="p-1">
                        <Input
                          value={String(row[key] ?? '')}
                          onChange={(e) => handleCellEdit(rowIndex, key, e.target.value)}
                          className="h-9 text-sm"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        <div className="text-sm text-muted-foreground">
          {editedData.length} sor × {keys.length} oszlop
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Bezárás
          </Button>
          {hasChanges && (
            <Button variant="secondary" onClick={handleReset}>
              <ArrowCounterClockwise className="w-4 h-4 mr-2" />
              Változások visszavonása
            </Button>
          )}
          <Button onClick={handleExport} disabled={!hasChanges && editedData === exportData}>
            <FileArrowDown className="w-4 h-4 mr-2" />
            {hasChanges ? 'Export módosított adatokkal' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
