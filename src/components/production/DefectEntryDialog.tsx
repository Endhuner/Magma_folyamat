/**
 * Selejt rögzítés / szerkesztés dialógus.
 * A Gyártási műszakok ablakban a "Selejt" gombról nyílik meg.
 *
 * Bevitel:
 *   - Mennyiség (db)
 *   - Indok / megjegyzés
 *   - Dátum (alap: ma)
 */
import { generateId } from '@/lib/generateId'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Warning, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { ProductionDefect } from '@/lib/types'
import { parseFloatSafe } from '@/lib/helpers'

interface DefectEntryDialogProps {
  open: boolean
  onClose: () => void
  /** A rendelés azonosítója, amelyhez a selejt tartozik. */
  orderId: string | null
  /** Termék-/rendelés-megjelenítési felirat (csak látvány). */
  orderLabel?: string
  /** Szerkesztendő selejt. Ha null → új rögzítés. */
  editing?: ProductionDefect | null
  onSave: (defect: ProductionDefect) => void
  userId?: string
  /**
   * Maximálisan rögzíthető selejt (gyártott db − többi selejt). Ha megadott,
   * ennél több nem menthető — a selejt nem haladhatja meg a gyártott mennyiséget.
   */
  maxQuantity?: number
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DefectEntryDialog({
  open,
  onClose,
  orderId,
  orderLabel,
  editing,
  onSave,
  userId,
  maxQuantity,
}: DefectEntryDialogProps) {
  const [date, setDate] = useState<string>(toISODate(new Date()))
  const [quantity, setQuantity] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDate(editing.date || toISODate(new Date()))
      setQuantity(String(editing.quantity ?? ''))
      setReason(editing.reason ?? '')
    } else {
      setDate(toISODate(new Date()))
      setQuantity('')
      setReason('')
    }
  }, [open, editing])

  const qtyNum = parseFloatSafe(quantity, 0, { allowNegative: false })
  const overMax = maxQuantity !== undefined && qtyNum > maxQuantity

  const handleSubmit = () => {
    if (!orderId) return
    if (qtyNum <= 0) {
      toast.error('A selejt mennyiségnek 0-nál nagyobbnak kell lennie')
      return
    }
    if (overMax) {
      toast.error(`A selejt nem haladhatja meg a gyártott mennyiséget (max. ${maxQuantity} db)`)
      return
    }
    if (!reason.trim()) {
      toast.error('Add meg a selejt okát / megjegyzést')
      return
    }
    const now = new Date().toISOString()
    const id =
      editing?.id ?? generateId()
    const out: ProductionDefect = {
      id,
      orderId,
      shiftId: editing?.shiftId,
      quantity: Math.round(qtyNum),
      reason: reason.trim(),
      date,
      userId: editing?.userId ?? userId,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    }
    onSave(out)
    toast.success(
      editing
        ? `Selejt módosítva: ${out.quantity} db`
        : `Selejt rögzítve: ${out.quantity} db`
    )
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warning className="w-5 h-5 text-destructive" weight="duotone" />
            {editing ? 'Selejt szerkesztése' : 'Selejt rögzítése'}
          </DialogTitle>
          {orderLabel && (
            <DialogDescription className="truncate">{orderLabel}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="defect-date">Dátum</Label>
            <Input
              id="defect-date"
              type="date"
              value={date}
              max={toISODate(new Date())}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="defect-qty">Mennyiség (db)</Label>
            <Input
              id="defect-qty"
              type="number"
              min={1}
              max={maxQuantity}
              inputMode="numeric"
              value={quantity}
              placeholder="pl. 5"
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
            {overMax && (
              <p className="text-xs text-destructive">
                Legfeljebb {maxQuantity} db rögzíthető (gyártott mennyiség − többi selejt).
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="defect-reason">Indok / megjegyzés</Label>
            <Textarea
              id="defect-reason"
              rows={3}
              value={reason}
              placeholder="Pl. szerszámcsapás nyom, kiégett, méreten kívül, anyaghiba..."
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={qtyNum <= 0 || overMax || !reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <CheckCircle className="w-4 h-4 mr-1.5" weight="fill" />
            {editing ? 'Mentés' : 'Rögzítés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
