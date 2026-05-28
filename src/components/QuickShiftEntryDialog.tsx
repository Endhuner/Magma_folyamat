import { generateId } from '@/lib/generateId'
import { useEffect, useMemo, useState } from 'react'
import type { Machine, Order, Product, ProductionShift } from '@/lib/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseFloatSafe } from '@/lib/helpers'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRight, CheckCircle, Info } from '@phosphor-icons/react'
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
  machines?: Machine[]
  /** Utolsó gép ID auto-kitöltéshez */
  lastMachineId?: string
}

/**
 * Gyors műszakrögzítő dialógus — kezdő és vég lövésszámot kell megadni,
 * a dátum és műszak a bannerből érkezik.
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
  machines = [],
  lastMachineId,
}: QuickShiftEntryDialogProps) {
  const [startShots, setStartShots] = useState<string>('')
  const [endShots, setEndShots] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [machineId, setMachineId] = useState<string>('')

  const nestCountNum = useMemo(() => {
    const n = parseFloatSafe(product?.nestCount, 1, { allowNegative: false })
    return n > 0 ? n : 1
  }, [product])

  useEffect(() => {
    if (!open) return
    setStartShots('')
    setEndShots('')
    setNotes('')
    setMachineId(lastMachineId ?? '')
  }, [open, order?.id, date, shift, lastMachineId])

  const startNum = parseFloatSafe(startShots, 0, { allowNegative: false })
  const endNum = parseFloatSafe(endShots, 0, { allowNegative: false })
  const shotsNum = Math.max(0, endNum - startNum)
  const producedPreview = Math.max(0, Math.round(shotsNum * nestCountNum))

  const fmtInt = (n: number) => Math.round(n).toLocaleString('hu-HU')

  const handleSubmit = () => {
    if (!order) return
    if (endShots === '') {
      toast.error('Add meg a vég lövésszámot')
      return
    }
    if (shotsNum <= 0) {
      toast.error('A vég lövésszámnak nagyobbnak kell lennie a kezdő lövésszámnál')
      return
    }
    const now = new Date().toISOString()
    const newShift: ProductionShift = {
      id: generateId(),
      orderId: order.id,
      date,
      shift,
      shotsCount: Math.round(shotsNum),
      producedQuantity: producedPreview,
      notes: notes.trim(),
      userId,
      machineId: machineId || undefined,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Hiányzó műszak pótlása</DialogTitle>
          <DialogDescription className="text-base">
            {order.productName} · {order.customer}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-base px-3 py-1">
              {date}
            </Badge>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {shiftLabel(shift)}
            </Badge>
          </div>

          {machines.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="qs-machine" className="text-base font-medium">Gép</Label>
              <Select value={machineId || 'none'} onValueChange={(v) => setMachineId(v === 'none' ? '' : v)}>
                <SelectTrigger id="qs-machine" className="text-base h-10">
                  <SelectValue placeholder="Válassz gépet…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-base text-muted-foreground">— Nincs megadva —</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-base">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Kezdő / Vég lövésszám */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="grid gap-2">
              <Label htmlFor="qs-start" className="text-base font-medium">
                Kezdő lövésszám
              </Label>
              <Input
                id="qs-start"
                type="number"
                min={0}
                className="text-xl font-mono h-13 text-center"
                value={startShots}
                placeholder="pl. 12 500"
                onChange={(e) => setStartShots(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-center pb-1">
              <ArrowRight className="w-6 h-6 text-muted-foreground" weight="bold" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qs-end" className="text-base font-medium">
                Vég lövésszám
              </Label>
              <Input
                id="qs-end"
                type="number"
                min={0}
                className="text-xl font-mono h-13 text-center"
                value={endShots}
                placeholder="pl. 12 620"
                onChange={(e) => setEndShots(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="qs-notes" className="text-base">Megjegyzés (opcionális)</Label>
            <Textarea
              id="qs-notes"
              rows={2}
              className="text-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!product && (
            <Alert>
              <Info className="w-4 h-4" weight="fill" />
              <AlertDescription className="text-sm">
                Termék fészekszám nincs rögzítve, a darabszám a lövésszámmal egyenlő.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between text-base">
              <span className="text-muted-foreground">Műszak lövései:</span>
              <span className="font-mono font-semibold">
                {endShots && startShots ? `${fmtInt(endNum)} − ${fmtInt(startNum)} = ` : ''}
                {fmtInt(shotsNum)} lövés
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-base">Gyártott darab:</span>
              <span className="font-mono font-bold text-2xl">
                {fmtInt(shotsNum)} × {nestCountNum} ={' '}
                <span className="text-accent">{fmtInt(producedPreview)} db</span>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" className="text-base" onClick={onClose}>
            Mégse
          </Button>
          <Button size="lg" className="text-base" onClick={handleSubmit} disabled={shotsNum <= 0}>
            <CheckCircle className="w-5 h-5 mr-2" weight="fill" />
            Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
