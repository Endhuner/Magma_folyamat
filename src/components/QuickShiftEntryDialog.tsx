import { generateId } from '@/lib/generateId'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { NumberStepper } from '@/components/ui/number-stepper'
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
import { SUGGESTED_SHIFT_SHOTS, previousShiftFor } from '@/lib/productionHelpers'
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
  /** A rendelés műszakai — a Kezdő lövésszám előtöltéséhez (mint a Gyártásban). */
  orderShifts?: ProductionShift[]
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
  orderShifts = [],
}: QuickShiftEntryDialogProps) {
  const [startShots, setStartShots] = useState<string>('')
  const [endShots, setEndShots] = useState<string>('')
  const [endEdited, setEndEdited] = useState(false)
  const [notes, setNotes] = useState<string>('')
  const [machineId, setMachineId] = useState<string>('')
  // A dátum módosítható; ha a választott dátumra már van műszak, azt szerkesztjük.
  const [dateLocal, setDateLocal] = useState<string>(date)
  const [editingId, setEditingId] = useState<string | null>(null)
  const startShotsRef = useRef<HTMLInputElement>(null)
  const endShotsRef = useRef<HTMLInputElement>(null)

  // Nyitáskor a dátumot a propból vesszük (mai nap); utána szabadon módosítható.
  useEffect(() => {
    if (open) setDateLocal(date)
  }, [open, date, order?.id])

  const nestCountNum = useMemo(() => {
    const n = parseFloatSafe(product?.nestCount, 1, { allowNegative: false })
    return n > 0 ? n : 1
  }, [product])

  // Nyitáskor / dátum-váltáskor:
  //  - ha a választott dátumra + műszakra MÁR van rögzítés → betöltjük (szerkesztés),
  //  - különben a Kezdő lövésszámot az előző műszak vég-számlálójából töltjük ki
  //    (mint a Gyártásban), a Vég üres marad (jön a javaslat).
  useEffect(() => {
    if (!open) return
    const existing = orderShifts.find((s) => s.date === dateLocal && s.shift === shift)
    if (existing) {
      setEditingId(existing.id)
      if (existing.endShotsAbsolute != null) {
        setStartShots(String(existing.endShotsAbsolute - existing.shotsCount))
        setEndShots(String(existing.endShotsAbsolute))
      } else {
        setStartShots('0')
        setEndShots(String(existing.shotsCount))
      }
      setEndEdited(true)   // meglévő érték — ne írja felül a javaslat
      setNotes(existing.notes ?? '')
      setMachineId(existing.machineId ?? '')
      return
    }
    setEditingId(null)
    const prevShift = previousShiftFor(orderShifts, dateLocal, shift)
    setStartShots(prevShift?.endShotsAbsolute != null ? String(prevShift.endShotsAbsolute) : '')
    setEndShots('')
    setEndEdited(false)
    setNotes('')
    setMachineId(lastMachineId ?? '')
  }, [open, order?.id, dateLocal, shift, lastMachineId, orderShifts])

  // Vég lövésszám JAVASLAT: Kezdő + egy műszaknyi lövés (1440). Amíg a gépkezelő
  // kézzel bele nem ír, a Kezdő változásait is követi.
  useEffect(() => {
    if (!open || endEdited) return
    const n = Number.parseInt(startShots, 10)
    setEndShots(startShots.trim() !== '' && Number.isFinite(n) ? String(n + SUGGESTED_SHIFT_SHOTS) : '')
  }, [open, startShots, endEdited])

  // A kurzor a Vég lövésszám mezőbe (ott a következő beírandó szám); ha még
  // nincs Kezdő, oda visszük — a tablet-billentyűzetet az autoFocus hozza fel.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const hasStart = (startShotsRef.current?.value ?? '').trim() !== ''
      if (hasStart) {
        endShotsRef.current?.select()
      } else {
        startShotsRef.current?.focus()
        startShotsRef.current?.select()
      }
    }, 60)
    return () => clearTimeout(t)
  }, [open])

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
    const existing = editingId ? orderShifts.find((s) => s.id === editingId) : undefined
    const newShift: ProductionShift = {
      id: editingId ?? generateId(),
      orderId: order.id,
      date: dateLocal,
      shift,
      shotsCount: Math.round(shotsNum),
      endShotsAbsolute: Math.round(endNum),
      producedQuantity: producedPreview,
      notes: notes.trim(),
      userId,
      machineId: machineId || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    onSave(newShift)
    toast.success(editingId ? `Műszak módosítva: ${producedPreview} db` : `Műszak rögzítve: ${producedPreview} db`)
    onClose()
  }

  // Enter a lövésszám-mezőkben azonnal rögzít — érintőképernyőn/gyorsan
  // dolgozó gépkezelőnek kevesebb koppintás.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Műszak gyártás</DialogTitle>
          <DialogDescription className="text-base">
            {order.productName} · {order.customer}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="grid gap-1">
              <Label htmlFor="qs-date" className="text-sm text-muted-foreground">Dátum</Label>
              <Input
                id="qs-date"
                type="date"
                value={dateLocal}
                onChange={(e) => e.target.value && setDateLocal(e.target.value)}
                className="font-mono text-base h-10 w-44"
              />
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1 self-end mb-1">
              {shiftLabel(shift)}
            </Badge>
            {editingId && (
              <Badge variant="outline" className="text-sm self-end mb-1 border-accent/50 text-accent">
                Meglévő műszak — szerkesztés
              </Badge>
            )}
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
              <NumberStepper
                id="qs-start"
                inputRef={startShotsRef}
                value={startShots}
                onChange={setStartShots}
                placeholder="pl. 12 500"
                onKeyDown={handleKeyDown}
                inputClassName="font-mono font-bold h-20 text-[2.8rem] md:text-[2.8rem] coarse:text-[2.8rem]"
                buttonClassName="h-20 px-4"
              />
            </div>
            <div className="flex items-center justify-center pb-1">
              <ArrowRight className="w-6 h-6 text-muted-foreground" weight="bold" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qs-end" className="text-base font-medium">
                Vég lövésszám
              </Label>
              <NumberStepper
                id="qs-end"
                inputRef={endShotsRef}
                value={endShots}
                onChange={(v) => { setEndShots(v); setEndEdited(true) }}
                placeholder="Kezdő + 1440"
                onKeyDown={handleKeyDown}
                autoFocus
                inputClassName="font-mono font-bold h-20 text-[2.8rem] md:text-[2.8rem] coarse:text-[2.8rem]"
                buttonClassName="h-20 px-4"
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
            {editingId ? 'Módosítás mentése' : 'Rögzítés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
