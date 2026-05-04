import { generateId } from '@/lib/generateId'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Order } from '@/lib/types'
import { getField, normalizeRow } from '@/lib/importHelpers'
import { parseFloatSafe, parseIntSafe } from '@/lib/helpers'
import * as XLSX from 'xlsx'

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
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      const orders: Partial<Order>[] = data.map((rawRow: any, index: number) => {
        const row = normalizeRow(rawRow)
        const amountPcStr = getField(row, 'Mennyiség db', 'Mennyiség', 'Amount', 'Darabszám', 'Db')
        const palletsCountStr = getField(row, 'Össz raklapok száma', 'Raklapok száma', 'Raklap', 'Pallets')
        const requiredMaterialKgStr = getField(row, 'Szükséges anyag kg', 'Anyag kg', 'Szükséges anyag', 'Required material')
        const grossWeightKgStr = getField(row, 'Bruttó súly kg', 'Bruttó súly', 'Gross weight')
        const statusVal = getField(row, 'Status', 'Státusz', 'Állapot')
        const order: Partial<Order> = {
          id: generateId(),
          customer: getField(row, 'Customer', 'Ügyfél', 'Vevő', 'Vevő név'),
          productName: getField(row, 'Megnevezése', 'Termék megnevezés', 'Megnevezés', 'Termék név'),
          ownOrderNumber: getField(row, 'Saját rendelési szám', 'Saját rendelés', 'Saját rend. szám'),
          orderNumber: getField(row, 'Rendelési szám', 'Rendelés szám', 'Rend. szám', 'Order number'),
          orderDate: getField(row, 'Order date (year/month/day)', 'Order date', 'Rendelés dátuma', 'Rendelési dátum'),
          pickupDate: getField(row, 'Actual pickup date (year/month/day)', 'Actual pickup date', 'Tényleges átvétel', 'Átvétel dátuma', 'Pickup date'),
          ready: getField(row, 'Szállításra kész', 'Szállítás kész', 'Ready for shipping', 'Ready'),
          designation: getField(row, 'Megjelölés', 'Designation'),
          material: getField(row, 'Anyag', 'Alapanyag', 'Material'),
          amountPc: parseIntSafe(amountPcStr, 0, { allowNegative: false }),
          surfaceTreatment: getField(row, 'Felületkezelés', 'Felület kezelés', 'Surface treatment'),
          palletsCount: parseIntSafe(palletsCountStr, 0, { allowNegative: false }),
          requiredMaterialKg: requiredMaterialKgStr
            ? String(parseFloatSafe(requiredMaterialKgStr, 0, { allowNegative: false }))
            : '',
          grossWeightKg: grossWeightKgStr
            ? String(parseFloatSafe(grossWeightKgStr, 0, { allowNegative: false }))
            : '',
          deliveryNote: getField(row, 'Szállítólevél', 'Delivery note'),
          status: (statusVal || 'Felvéve') as Order['status'],
          notes: getField(row, 'Notes', 'Megjegyzés', 'Megjegyzések', 'Jegyzet'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return order
      })

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
