import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Order } from '@/lib/types'

interface OrderBulkImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (orders: Partial<Order>[]) => void
}

export function OrderBulkImportDialog({ open, onClose, onImport }: OrderBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Kérem válasszon ki egy fájlt')
      return
    }

    setIsProcessing(true)

    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      const orders: Partial<Order>[] = data.map((row: any, index: number) => ({
        id: `import-${Date.now()}-${index}`,
        customer: row['Customer'] || '',
        productName: row['Megnevezése'] || '',
        ownOrderNumber: row['Saját rendelési szám'] || '',
        orderNumber: row['Rendelési szám'] || '',
        orderDate: row['Order date (year/month/day)'] || '',
        actualPickupDate: row['Actual pickup date (year/month/day)'] || '',
        readyForShipping: row['Szállításra kész'] || '',
        designation: row['Megjelölés'] || '',
        drawingNumber: row['Rajzszám'] || '',
        material: row['Anyag'] || '',
        amountPc: Number(row['Mennyiség db'] || 0),
        surfaceTreatment: row['Felületkezelés'] || '',
        palletsCount: Number(row['Össz raklapok száma'] || 0),
        requiredMaterialKg: Number(row['Szükséges anyag kg'] || 0),
        deliveryNote: row['Szállítólevél'] || '',
        status: row['Status'] || 'Felvéve',
        notes: row['Notes'] || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

      onImport(orders)
      onClose()
      setFile(null)
      toast.success(`${orders.length} rendelés importálva`)
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Hiba az import során')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rendelések tömeges importálása</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full cursor-pointer
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90"
            />
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Az Excel fájlnak a következő oszlopokat kell tartalmaznia:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Customer</li>
              <li>Megnevezése</li>
              <li>Saját rendelési szám</li>
              <li>Rendelési szám</li>
              <li>Order date (year/month/day)</li>
              <li>Actual pickup date (year/month/day)</li>
              <li>Szállításra kész</li>
              <li>Megjelölés</li>
              <li>Rajzszám</li>
              <li>Anyag</li>
              <li>Mennyiség db</li>
              <li>Felületkezelés</li>
              <li>Össz raklapok száma</li>
              <li>Szükséges anyag kg</li>
              <li>Szállítólevél</li>
              <li>Status (opcionális)</li>
              <li>Notes (opcionális)</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Mégse
            </Button>
            <Button onClick={handleImport} disabled={!file || isProcessing}>
              <Upload className="w-4 h-4 mr-2" />
              {isProcessing ? 'Importálás...' : 'Importálás'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
