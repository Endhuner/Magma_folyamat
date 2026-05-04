import { useEffect, useMemo, useState } from 'react'
import type { Order, Product, ProductionShift } from '@/lib/types'
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
import { Badge } from '@/components/ui/badge'
import { parseFloatSafe } from '@/lib/helpers'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { shiftLabel } from '@/lib/shiftValidation'

interface QuickShiftEntryDialogProps {
  open: boolean
  onClose: () => void
  order: Order | null
  product?: Product
  date: string // YYYY-MM-DD
  shift: 'de' | 'du'
  onSave: (shift: ProductionShift) => void
  userId?: string
}

/**
 * Gyors műszakrögzítő dialógus — csak a lövésszámot és egy opcionális megjegyzést kell megadni,
 * a dátum és műszak a bannerből érkezik. A `ProductionDetailDialog` teljes értékű párja.
 */
export function QuickShiftEntryDialog({
  open,
  onClose,
  order,
  product,
  date,
  shift,
  onSave,
  userId,
}: QuickShiftEntryDialogProps) {
  const [shotsCount, setShotsCount] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const nestCountNum = useMemo(() => {
    const n = parseFloatSafe(product?.nestCount, 1, { allowNegative: false })
    return n > 0 ? n : 1
  }, [product])

  useEffect(() => {
    if (!open) return
    setShotsCount('')
    setNotes('')
  }, [open, order?.id, date, shift])

  const shotsNum = parseFloatSafe(shotsCount, 0, { allowNegative: false })
  const producedPreview = Math.max(0, Math.round(shotsNum * nestCountNum))

  const handleSubmit = () => {
    if (!order) return
    if (shotsNum <= 0) {
      toast.error('A lövésszámnak 0-nál nagyobbnak kell lennie')
      return
    }
    const now = new Date().toISOString()
    const newShift: ProductionShift = {
      id: crypto.randomUUID(),
      orderId: order.id,
      date,
      shift,
      shotsCount: shotsNum,
      producedQuantity: producedPreview,
      notes: notes.trim(),
      userId,
      createdAt: now,
      updatedAt: now,
    }
    onSave(newShift)
    toast.success(`Műszak rögzítve: ${producedPreview} db`)
    onClose()
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hiányzó műszak pótlása</DialogTitle>
          <DialogDescription>
            {order.productName} · {order.customer}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono">
              {date}
            </Badge>
            <Badge variant="secondary">{shiftLabel(shift)}</Badge>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-shots">Lövésszám</Label>
            <Input
              id="quick-shots"
              type="number"
              min={0}
              value={shotsCount}
              onChange={(e) => setShotsCount(e.target.value)}
              placeholder="pl. 120"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-notes">Megjegyzés (opcionális)</Label>
            <Textarea
              id="quick-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!product && (
            <Alert>
              <Info className="w-4 h-4" weight="fill" />
              <AlertDescription className="text-xs">
                Termék fészekszám nincs rögzítve, a darabszám a lövésszámmal egyenlő.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm bg-muted/50 rounded-md p-3 flex items-center justify-between">
            <span className="text-muted-foreground">Kalkulált darab:</span>
            <span className="font-mono font-semibold">
              {shotsNum || 0} × {nestCountNum} = {producedPreview} db
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handleSubmit} disabled={shotsNum <= 0}>
            <CheckCircle className="w-4 h-4 mr-1" weight="fill" />
            Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
