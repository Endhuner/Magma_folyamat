import { generateId } from '@/lib/generateId'
import { useEffect, useMemo, useState } from 'react'
import type { InventoryItem, InventoryTransaction, Product } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { BoxArrowDown, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { parseFloatSafe } from '@/lib/helpers'

export interface WarehouseAddResult {
  item: InventoryItem
  transaction: InventoryTransaction
  /** true, ha új tételt kellett létrehozni; false, ha meglévő tétel frissült. */
  createdNew: boolean
}

interface WarehouseAddDialogProps {
  open: boolean
  onClose: () => void
  products: Product[]
  inventory: InventoryItem[]
  onSubmit: (result: WarehouseAddResult) => void
  userId?: string
  /** Előre kiválasztott termék ID (pl. készlet-listából nyitva). */
  prefillProductId?: string
}

/**
 * Raktári bevételezés — új árumennyiség érkezett raktárra. Ha az adott termékre
 * már létezik `InventoryItem`, a meglévő készletet növeli; ha nem, újat hoz létre.
 * Minden esetben `InventoryTransaction` (type: `in`) bejegyzést is kalkulál.
 */
export function WarehouseAddDialog({
  open,
  onClose,
  products,
  inventory,
  onSubmit,
  userId,
  prefillProductId,
}: WarehouseAddDialogProps) {
  const [productId, setProductId] = useState<string>('')
  const [quantityStr, setQuantityStr] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [supplier, setSupplier] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    if (!open) return
    setProductId(prefillProductId || '')
    setQuantityStr('')
    setLocation('')
    setSupplier('')
    setNotes('')
  }, [open, prefillProductId])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  )

  const existingItem = useMemo(
    () => inventory.find((i) => i.productId === productId),
    [inventory, productId]
  )

  // Ha a termék kiválasztódott és van raktárhely adat, kitöltjük előre.
  useEffect(() => {
    if (selectedProduct && !location) {
      setLocation(existingItem?.location || selectedProduct.warehouse || '')
    }

  }, [selectedProduct?.id])

  const quantity = parseFloatSafe(quantityStr, 0, { allowNegative: false })

  const handleSubmit = () => {
    if (!selectedProduct) {
      toast.error('Válassz ki egy terméket')
      return
    }
    if (quantity <= 0) {
      toast.error('A bevételezett mennyiségnek 0-nál nagyobbnak kell lennie')
      return
    }

    const now = new Date().toISOString()
    const trimmedNotes = notes.trim()
    const supplierNote = supplier.trim() ? `Beszállító: ${supplier.trim()}` : ''
    const combinedNotes = [supplierNote, trimmedNotes].filter(Boolean).join(' · ') || 'Raktári bevét'

    let item: InventoryItem
    let createdNew = false

    if (existingItem) {
      item = {
        ...existingItem,
        quantity: existingItem.quantity + quantity,
        location: location.trim() || existingItem.location,
        nestCount: existingItem.nestCount || selectedProduct.nestCount,
        lastUpdated: now,
      }
    } else {
      createdNew = true
      item = {
        id: generateId(),
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        drawingNumber: selectedProduct.drawingNumber,
        customer: selectedProduct.customer,
        quantity,
        totalShots: 0,
        nestCount: selectedProduct.nestCount,
        location: location.trim() || selectedProduct.warehouse || '',
        notes: '',
        lastUpdated: now,
        createdAt: now,
      }
    }

    const transaction: InventoryTransaction = {
      id: generateId(),
      inventoryItemId: item.id,
      type: 'in',
      quantity,
      notes: combinedNotes,
      userId,
      createdAt: now,
    }

    onSubmit({ item, transaction, createdNew })
    toast.success(
      createdNew
        ? `Új készlet tétel létrehozva: +${quantity} db`
        : `Bevételezve: +${quantity} db (új szint: ${item.quantity})`
    )
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BoxArrowDown className="w-5 h-5" weight="duotone" />
            Raktári bevételezés
          </DialogTitle>
          <DialogDescription>
            Új árumennyiség érkezett — növeld a terméked aktuális készletét és hozz
            létre egy „bevét" naplóbejegyzést.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wh-product">Termék *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="wh-product">
                <SelectValue placeholder="Válassz terméket..." />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Nincs termék rögzítve
                  </div>
                ) : (
                  products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.drawingNumber || '—'} · {p.productName} ({p.customer})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {existingItem && (
            <Alert>
              <Info className="w-4 h-4" weight="fill" />
              <AlertDescription className="text-xs flex items-center gap-2 flex-wrap">
                Meglévő készlet:
                <Badge variant="outline" className="font-mono">
                  {existingItem.quantity} db
                </Badge>
                {existingItem.location && (
                  <>
                    · <span>{existingItem.location}</span>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="wh-qty">Bevételezett mennyiség (db) *</Label>
              <Input
                id="wh-qty"
                type="number"
                inputMode="decimal"
                min={1}
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                placeholder="pl. 500"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wh-location">Raktárhely</Label>
              <Input
                id="wh-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="pl. A1-polc-3"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="wh-supplier">Beszállító / hivatkozás (opcionális)</Label>
            <Input
              id="wh-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="pl. szállítólevélszám vagy beszállító neve"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="wh-notes">Megjegyzés</Label>
            <Textarea
              id="wh-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="text-sm bg-muted/50 rounded-md p-3 flex items-center justify-between">
            <span className="text-muted-foreground">Készlet a bevét után:</span>
            <span className="font-mono font-semibold">
              {(existingItem?.quantity ?? 0) + (quantity || 0)} db
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handleSubmit} disabled={!productId || quantity <= 0}>
            Bevételezés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
