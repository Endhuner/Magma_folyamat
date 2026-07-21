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
  // Érintőképernyőn (tablet) saját numpad ugrik fel a mező mellé, a rendszer-
  // billentyűzet helyett — így nem takarja el a Rögzítés gombot.
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    [],
  )
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null)
  // Első leütés a mező megnyitása után felülírja a régi értéket (kalkulátor-logika).
  const [freshEntry, setFreshEntry] = useState(true)
  const numpadRef = useRef<HTMLDivElement>(null)

  const openField = (f: 'start' | 'end') => {
    setActiveField(f)
    setFreshEntry(true)
  }

  const pressNum = (k: string) => {
    if (!activeField) return
    const isEnd = activeField === 'end'
    const cur = isEnd ? endShots : startShots
    let next: string
    if (k === 'C') next = ''
    else if (k === '⌫') next = cur.slice(0, -1)
    else {
      const base = freshEntry || cur === '0' ? '' : cur
      next = (base + k).replace(/^0+(?=\d)/, '')
    }
    setFreshEntry(false)
    if (isEnd) {
      setEndShots(next)
      setEndEdited(true)
    } else {
      setStartShots(next)
    }
  }

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
  //  - ha van korábbi műszak → a Kezdő lövésszám annak vég-számlálója (mint a Gyártásban),
  //  - ha még nincs egy műszak sem (új, „felvéve" rendelés) → a Kezdő 0.
  //    A Vég üres marad (jön a javaslat), a kurzor a Vég mezőbe kerül (lásd lentebb).
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
    setStartShots(prevShift?.endShotsAbsolute != null ? String(prevShift.endShotsAbsolute) : '0')
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

  // Nyitáskor:
  //  - Érintőn (tablet): a Vég mezőre nyitjuk a saját numpadot — nincs rendszer-
  //    billentyűzet, ezért semmi nem takarja el a Rögzítést.
  //  - Egéren: a kurzort a Vég mezőbe visszük (ott a következő beírandó szám); ha
  //    még nincs Kezdő, oda.
  useEffect(() => {
    if (!open) {
      setActiveField(null)
      return
    }
    if (isTouch) {
      setActiveField('end')
      setFreshEntry(true)
      return
    }
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
  }, [open, isTouch])

  // A megnyíló numpadot görgessük láthatóvá (érintőn).
  useEffect(() => {
    if (activeField && numpadRef.current) {
      numpadRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeField])

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
      <DialogContent className="max-w-2xl flex flex-col max-h-[92vh] gap-0 p-0">
        <DialogHeader className="p-6 pb-3 flex-none">
          <DialogTitle className="text-lg">Műszak gyártás</DialogTitle>
          <DialogDescription className="text-base">
            {order.productName} · {order.customer}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-3 overflow-y-auto flex-1 min-h-0">
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
                inputMode={isTouch ? 'none' : 'numeric'}
                onInputFocus={isTouch ? () => openField('start') : undefined}
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
                autoFocus={!isTouch}
                inputMode={isTouch ? 'none' : 'numeric'}
                onInputFocus={isTouch ? () => openField('end') : undefined}
                inputClassName="font-mono font-bold h-20 text-[2.8rem] md:text-[2.8rem] coarse:text-[2.8rem]"
                buttonClassName="h-20 px-4"
              />
            </div>
          </div>

          {/* Érintő-numpad: a mezőre koppintva ez jön fel a rendszer-billentyűzet
              helyett, így semmi nem takarja el a Rögzítést. */}
          {isTouch && activeField && (
            <div ref={numpadRef} className="rounded-xl border bg-card shadow-md p-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium text-muted-foreground">
                  {activeField === 'end' ? 'Vég lövésszám' : 'Kezdő lövésszám'}
                </span>
                <span className="font-mono font-bold text-xl">
                  {(activeField === 'end' ? endShots : startShots) || '0'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant="outline"
                    className="h-16 text-3xl font-semibold"
                    onClick={() => pressNum(k)}
                  >
                    {k}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-16 text-xl font-semibold text-orange-600"
                  onClick={() => pressNum('C')}
                >
                  C
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-16 text-3xl font-semibold"
                  onClick={() => pressNum('0')}
                >
                  0
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-16 text-2xl font-semibold text-orange-600"
                  onClick={() => pressNum('⌫')}
                  aria-label="Visszatörlés"
                >
                  ⌫
                </Button>
              </div>
              <Button type="button" className="w-full h-12 text-base" onClick={() => setActiveField(null)}>
                <CheckCircle className="w-5 h-5 mr-2" weight="fill" />
                Kész
              </Button>
            </div>
          )}

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

        <DialogFooter className="p-6 pt-3 flex-none border-t">
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
