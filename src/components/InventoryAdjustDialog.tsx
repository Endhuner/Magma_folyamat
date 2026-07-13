import { useState, useEffect } from 'react'
import { InventoryItem, InventoryTransaction } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { parseIntSafe } from '@/lib/helpers'

interface InventoryAdjustDialogProps {
  open: boolean
  onClose: () => void
  onSave: (adjustment: { type: 'in' | 'out' | 'adjustment', quantity: number, notes: string }) => void
  item: InventoryItem | null
}

export function InventoryAdjustDialog({ open, onClose, onSave, item }: InventoryAdjustDialogProps) {
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setType('in')
      setQuantity(0)
      setNotes('')
    }
  }, [open])

  const handleSubmit = () => {
    // Kézi korrekciónál (=) a 0 érvényes cél (leltári nullázás) — csak a
    // bevét/kiadás értelmetlen 0 darabbal.
    if (type !== 'adjustment' && quantity === 0) return
    onSave({ type, quantity, notes })
    onClose()
  }

  const getNewQuantity = () => {
    if (!item) return 0
    if (type === 'in') return item.quantity + quantity
    if (type === 'out') return Math.max(0, item.quantity - quantity)
    return quantity
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Készlet módosítás</DialogTitle>
        </DialogHeader>

        {item && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Termék:</span>
              <span className="font-medium">{item.productName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rajzszám:</span>
              <span className="font-mono text-sm">{item.drawingNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Jelenlegi mennyiség:</span>
              <Badge variant="secondary" className="font-mono">{item.quantity} db</Badge>
            </div>
            {quantity > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Új mennyiség:</span>
                <Badge variant="default" className="font-mono">{getNewQuantity()} db</Badge>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Művelet típusa</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="in" id="type-in" />
                <Label htmlFor="type-in" className="cursor-pointer">Bevételezés (+)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="out" id="type-out" />
                <Label htmlFor="type-out" className="cursor-pointer">Kiadás (-)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="adjustment" id="type-adjustment" />
                <Label htmlFor="type-adjustment" className="cursor-pointer">Kézi korrekció (=)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quantity">
              {type === 'adjustment' ? 'Új mennyiség (db)' : 'Mennyiség (db)'}
            </Label>
            <Input
              id="quantity"
              type="number"
              inputMode="numeric"
              value={quantity || ''}
              onChange={(e) => setQuantity(parseIntSafe(e.target.value, 0, { allowNegative: false }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
              min="0"
              placeholder="0"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Megjegyzés</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="pl. Megrendelés #1234, Selejtezés, Leltár..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handleSubmit} disabled={type !== 'adjustment' && quantity === 0}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
