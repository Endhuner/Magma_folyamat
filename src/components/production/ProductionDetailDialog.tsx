import { generateId } from '@/lib/generateId'
import { useEffect, useMemo, useState } from 'react'
import type {
  Order,
  OrderStatus,
  Product,
  ProductionShift,
  ProductionDefect,
  Machine,
  MachinePlanningAssignment,
} from '@/lib/types'
import { DefectEntryDialog } from '@/components/production/DefectEntryDialog'
import { parseFloatSafe } from '@/lib/helpers'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  Factory,
  Info,
  Trash,
  CheckCircle,
  CheckFat,
  Warning,
  ArrowRight,
  GearSix,
} from '@phosphor-icons/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { shiftLabel } from '@/lib/shiftValidation'

interface ProductionDetailDialogProps {
  open: boolean
  onClose: () => void
  order: Order | null
  product?: Product
  shifts: ProductionShift[]
  onSaveShift: (shift: ProductionShift) => void
  onDeleteShift: (shiftId: string) => void
  /** Rendelés státusz-változtatásához — a gyártás indítás/szünetelés/leállítás gombokhoz. */
  onStatusChange?: (orderId: string, status: OrderStatus) => void
  /** Előre kitöltött dátum (YYYY-MM-DD) — QuickShiftEntryDialog-ból érkezve. */
  prefillDate?: string
  /** Előre kitöltött műszak — QuickShiftEntryDialog-ból érkezve. */
  prefillShift?: 'de' | 'du'
  /** Selejt rögzítések (összes — itt szűrjük orderId-ra). */
  defects?: ProductionDefect[]
  /** Új vagy módosított selejt mentése. */
  onSaveDefect?: (defect: ProductionDefect) => void
  /** Selejt törlése. */
  onDeleteDefect?: (defectId: string) => void
  userId?: string
  /** Gépek listája — a gyártásindítás gép-kiválasztó dialógushoz. */
  machines?: Machine[]
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * A rendeléshez tartozó műszakok listázására + egy új műszak rögzítésére / szerkesztésére.
 * A lövésszámot kezdő és vég számlálóból számítjuk (vég − kezdő = műszak lövéseinek száma),
 * majd a darabszám: lövések × fészekszám.
 */
export function ProductionDetailDialog({
  open,
  onClose,
  order,
  product,
  shifts,
  onSaveShift,
  onDeleteShift,
  onStatusChange,
  prefillDate,
  prefillShift,
  defects,
  onSaveDefect,
  onDeleteDefect,
  machines = [],
  userId,
}: ProductionDetailDialogProps) {
  const [date, setDate] = useState<string>(toISODate(new Date()))
  const [shift, setShift] = useState<'de' | 'du'>('de')
  const [startShots, setStartShots] = useState<string>('')
  const [endShots, setEndShots] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [machineId, setMachineId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  // Selejt-dialógus állapota
  const [defectDialogOpen, setDefectDialogOpen] = useState(false)
  const [editingDefect, setEditingDefect] = useState<ProductionDefect | null>(null)
  // Elkészült megerősítő popup
  const [completionConfirmOpen, setCompletionConfirmOpen] = useState(false)
  const [pendingNewTotalProduced, setPendingNewTotalProduced] = useState(0)
  // Gyártás indítása — gép kiválasztó dialog
  const [startMachineOpen, setStartMachineOpen] = useState(false)
  const [startAssignment, setStartAssignment] = useState<MachinePlanningAssignment | null | undefined>(undefined) // undefined=loading, null=nincs hozzárendelés
  const [startMachineLoading, setStartMachineLoading] = useState(false)

  const nestCountNum = useMemo(() => {
    const n = parseFloatSafe(product?.nestCount, 1, { allowNegative: false })
    return n > 0 ? n : 1
  }, [product])

  const orderShifts = useMemo(() => {
    if (!order) return [] as ProductionShift[]
    return [...shifts]
      .filter((s) => s.orderId === order.id)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return a.shift === 'de' ? -1 : 1
      })
  }, [order, shifts])

  // Reset form whenever the dialog opens or prefills change.
  useEffect(() => {
    if (!open) return
    setDate(prefillDate || toISODate(new Date()))
    setShift(prefillShift || 'de')
    setStartShots('')
    setEndShots('')
    setNotes('')
    setEditingId(null)
    // Auto-fill machine: a termékhez legutóbb rögzített műszak gépe
    const lastWithMachine = [...orderShifts]
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
      .find((s) => s.machineId)
    setMachineId(lastWithMachine?.machineId ?? '')
  }, [open, prefillDate, prefillShift, order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Új rögzítésnél: ha dátum vagy műszak változik, a kezdő lövésszámot
  // az előző műszak endShotsAbsolute-jából töltjük ki (átírható).
  useEffect(() => {
    if (!open || editingId) return
    const shiftOrder = (s: ProductionShift) =>
      s.date < date ? true : s.date === date && s.shift === 'de' && shift === 'du'
    const prevShift = orderShifts.find(shiftOrder)
    setStartShots(prevShift?.endShotsAbsolute != null ? String(prevShift.endShotsAbsolute) : '')
  }, [open, date, shift, editingId, orderShifts])

  const totalShots = useMemo(
    () => orderShifts.reduce((sum, s) => sum + (s.shotsCount || 0), 0),
    [orderShifts]
  )

  const totalProduced = useMemo(
    () => orderShifts.reduce((sum, s) => sum + (s.producedQuantity || 0), 0),
    [orderShifts]
  )

  /** A jelenlegi rendeléshez tartozó selejt-rögzítések (legújabb felül). */
  const orderDefects = useMemo(() => {
    if (!order || !defects) return [] as ProductionDefect[]
    return [...defects]
      .filter((d) => d.orderId === order.id)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [order, defects])

  const totalDefects = useMemo(
    () => orderDefects.reduce((sum, d) => sum + (d.quantity || 0), 0),
    [orderDefects]
  )

  const startNum = parseFloatSafe(startShots, 0, { allowNegative: false })
  const endNum = parseFloatSafe(endShots, 0, { allowNegative: false })
  /** Műszak lövésszáma = vég − kezdő (nem lehet negatív) */
  const shotsNum = Math.max(0, endNum - startNum)
  const producedPreview = Math.max(0, Math.round(shotsNum * nestCountNum))

  /** Figyelmeztetés: van-e már ezen a napon + műszakban rögzítés */
  const duplicate = useMemo(() => {
    return orderShifts.find(
      (s) => s.date === date && s.shift === shift && s.id !== editingId
    )
  }, [orderShifts, date, shift, editingId])

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
    if (duplicate) {
      toast.error(
        `Erre a napra és műszakra már van rögzítés (${duplicate.shotsCount} lövés). Szerkeszd meg vagy töröld azt.`
      )
      return
    }

    const id = editingId ?? generateId()
    const now = new Date().toISOString()

    const endShotsNum = endShots !== '' ? parseInt(endShots, 10) : undefined

    const newShift: ProductionShift = {
      id,
      orderId: order.id,
      date,
      shift,
      shotsCount: Math.round(shotsNum),
      producedQuantity: producedPreview,
      notes: notes.trim(),
      userId,
      endShotsAbsolute: !isNaN(endShotsNum ?? NaN) ? endShotsNum : undefined,
      machineId: machineId || undefined,
      createdAt: editingId
        ? orderShifts.find((s) => s.id === editingId)?.createdAt || now
        : now,
      updatedAt: now,
    }

    onSaveShift(newShift)
    toast.success(
      editingId
        ? 'Műszak módosítva'
        : `Műszak rögzítve: ${producedPreview} db (${shotsNum} lövés × ${nestCountNum} fészek)`
    )
    setStartShots('')
    setEndShots('')
    setNotes('')
    setMachineId('')
    setEditingId(null)

    // Auto-completion ellenőrzés: ha az új műszakkal eléri vagy meghaladja a rendelt mennyiséget
    if (!editingId && order.amountPc > 0 && order.status !== 'Elkészült') {
      const newTotal = totalProduced + producedPreview
      if (newTotal >= order.amountPc) {
        setPendingNewTotalProduced(newTotal)
        setCompletionConfirmOpen(true)
      }
    }
  }

  const handleEdit = (s: ProductionShift) => {
    setDate(s.date)
    setShift(s.shift)
    if (s.endShotsAbsolute != null) {
      setStartShots(String(s.endShotsAbsolute - s.shotsCount))
      setEndShots(String(s.endShotsAbsolute))
    } else {
      setStartShots('0')
      setEndShots(String(s.shotsCount))
    }
    setNotes(s.notes)
    setMachineId(s.machineId ?? '')
    setEditingId(s.id)
  }

  const handleCancelEdit = () => {
    setDate(toISODate(new Date()))
    setShift('de')
    setStartShots('')
    setEndShots('')
    setNotes('')
    setMachineId('')
    setEditingId(null)
  }

  const handleDelete = (s: ProductionShift) => {
    if (!confirm(`Biztosan törlöd a ${s.date} ${shiftLabel(s.shift)} műszakot?`)) return
    onDeleteShift(s.id)
    if (editingId === s.id) handleCancelEdit()
    toast.success('Műszak törölve')
  }

  const fmtInt = (n: number | undefined | null): string => {
    const v = Number(n)
    if (!Number.isFinite(v)) return '0'
    return Math.round(v).toLocaleString('hu-HU')
  }

  /**
   * A három gyártásvezérlő gomb mindegyike egy adott státuszba helyezi a rendelést.
   */
  const handleStatusButton = (next: OrderStatus, label: string) => {
    if (!order) return
    if (!onStatusChange) return
    if (order.status === next) {
      toast.info(`A rendelés már "${label}" állapotban van`)
      return
    }
    onStatusChange(order.id, next)
    toast.success(`Rendelés státusz: ${label}`)
  }

  const isInProgress = order?.status === 'Folyamatban'
  const isPaused = order?.status === 'Szünetel'
  const isStopped = order?.status === 'Előkészítve'

  const handleStartProductionClick = async () => {
    if (!order) return
    if (isInProgress) {
      toast.info('A rendelés már "Folyamatban" állapotban van')
      return
    }
    setStartMachineOpen(true)
    setStartMachineLoading(true)
    setStartAssignment(undefined)
    try {
      const all = await fetch('/api/v1/machine-planning', { credentials: 'include' })
        .then(r => r.json()) as MachinePlanningAssignment[]
      const mine = all.find(a => a.orderId === order.id)
      setStartAssignment(mine ?? null)
    } catch {
      setStartAssignment(null)
    } finally {
      setStartMachineLoading(false)
    }
  }

  const confirmStartProduction = async (moveToFront: boolean) => {
    if (!order || !onStatusChange) return
    if (moveToFront && startAssignment) {
      try {
        // Az adott gép összes assignmentjét lekérjük, majd az aktuálisat az elejére rakjuk
        const all = await fetch('/api/v1/machine-planning', { credentials: 'include' })
          .then(r => r.json()) as MachinePlanningAssignment[]
        const machineAsgns = all
          .filter(a => a.machineId === startAssignment.machineId)
          .sort((a, b) => a.position - b.position)
        const reordered = [
          startAssignment,
          ...machineAsgns.filter(a => a.id !== startAssignment.id),
        ]
        await fetch('/api/v1/machine-planning/reorder', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: reordered.map(a => a.id) }),
        })
        toast.success('Sorrend frissítve — az aktuális munka az élre került')
      } catch {
        toast.error('Sorrend frissítése sikertelen')
      }
    }
    setStartMachineOpen(false)
    onStatusChange(order.id, 'Folyamatban')
    toast.success('Rendelés státusz: Folyamatban')
  }

  if (!order) return null

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[96rem] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Factory className="w-7 h-7" weight="duotone" />
            Gyártási műszakok — {order.productName}
          </DialogTitle>
          <DialogDescription className="text-lg">
            {order.customer} · Rend. szám: {order.orderNumber || '-'} · Mennyiség:{' '}
            <strong>{fmtInt(order.amountPc)} db</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Összesítő */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-base text-muted-foreground mb-1">Összes lövés</div>
            <div className="text-4xl font-bold font-mono">{fmtInt(totalShots)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-base text-muted-foreground mb-1">Gyártott darab</div>
            <div className="text-4xl font-bold font-mono">{fmtInt(totalProduced)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-base text-muted-foreground mb-1">Fészekszám</div>
            <div className="text-4xl font-bold font-mono">{fmtInt(nestCountNum)}</div>
          </div>
          <div
            className={`rounded-lg p-4 ${
              totalDefects > 0
                ? 'bg-destructive/10 ring-1 ring-destructive/20'
                : 'bg-muted/50'
            }`}
          >
            <div className="text-base text-muted-foreground mb-1 flex items-center gap-1">
              <Warning className="w-5 h-5" weight="fill" /> Selejt (db)
            </div>
            <div
              className={`text-4xl font-bold font-mono ${
                totalDefects > 0 ? 'text-destructive' : ''
              }`}
            >
              {fmtInt(totalDefects)}
            </div>
          </div>
        </div>

        {!product && (
          <Alert>
            <Info className="w-4 h-4" weight="fill" />
            <AlertDescription>
              Nem található hozzárendelt termék. A fészekszám alapértelmezetten 1, a darabszám a lövésszámmal egyenlő.
            </AlertDescription>
          </Alert>
        )}

        {/* Műszak rögzítő form */}
        <div className="bg-card border-2 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-7 h-7 text-accent" weight="duotone" />
            <h3 className="text-xl font-semibold">
              {editingId ? 'Műszak szerkesztése' : 'Új műszak rögzítése'}
            </h3>
          </div>

          {/* Dátum + Műszak + Gép sor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="shift-date" className="text-lg font-medium">Dátum</Label>
              <Input
                id="shift-date"
                type="date"
                lang="hu"
                className="text-lg h-12"
                value={date}
                max={toISODate(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shift-type" className="text-lg font-medium">Műszak</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as 'de' | 'du')}>
                <SelectTrigger id="shift-type" className="text-lg h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de" className="text-lg">Délelőtt (de)</SelectItem>
                  <SelectItem value="du" className="text-lg">Délután (du)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shift-machine" className="text-lg font-medium">Gép</Label>
              <Select value={machineId || 'none'} onValueChange={(v) => setMachineId(v === 'none' ? '' : v)}>
                <SelectTrigger id="shift-machine" className="text-lg h-12">
                  <SelectValue placeholder="Válassz gépet…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-lg text-muted-foreground">— Nincs megadva —</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-lg">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kezdő / Vég lövésszám sor */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="start-shots" className="text-lg font-medium">
                Kezdő lövésszám (számláló állás)
              </Label>
              <Input
                id="start-shots"
                type="number"
                min={0}
                className="font-mono h-20 text-center font-bold" style={{ fontSize: '2.8rem' }}
                value={startShots}
                placeholder="pl. 12 500"
                onChange={(e) => setStartShots(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-center pb-1">
              <ArrowRight className="w-8 h-8 text-muted-foreground" weight="bold" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-shots" className="text-lg font-medium">
                Vég lövésszám (számláló állás)
              </Label>
              <Input
                id="end-shots"
                type="number"
                min={0}
                className="font-mono h-20 text-center font-bold" style={{ fontSize: '2.8rem' }}
                value={endShots}
                placeholder="pl. 12 620"
                onChange={(e) => setEndShots(e.target.value)}
              />
            </div>
          </div>

          {/* Kalkuláció előnézet */}
          <div className="bg-muted/40 rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between text-lg">
              <span className="text-muted-foreground">Műszak lövéseinek száma:</span>
              <span className="font-mono font-bold text-xl">
                {endShots !== '' && startShots !== ''
                  ? `${fmtInt(endNum)} − ${fmtInt(startNum)} = `
                  : ''}
                <span className={shotsNum > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                  {fmtInt(shotsNum)} lövés
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="text-muted-foreground">Gyártott darabszám:</span>
              <span className="font-mono font-bold text-3xl">
                {fmtInt(shotsNum)} × {fmtInt(nestCountNum)} ={' '}
                <span className="text-accent">{fmtInt(producedPreview)} db</span>
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shift-notes" className="text-lg font-medium">
              Megjegyzés (opcionális)
            </Label>
            <Textarea
              id="shift-notes"
              rows={2}
              className="text-lg"
              value={notes}
              placeholder="Pl. leállás, anyagmozgatás, műszakváltás..."
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {duplicate && (
            <Alert variant="destructive">
              <Warning className="w-4 h-4" weight="fill" />
              <AlertDescription className="text-base">
                Erre a napra és műszakra már van rögzítés ({fmtInt(duplicate.shotsCount)} lövés,{' '}
                {fmtInt(duplicate.producedQuantity)} db). Szerkeszd meg vagy töröld a lenti listában.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            {editingId && (
              <Button variant="ghost" size="lg" onClick={handleCancelEdit} className="text-lg">
                Mégse
              </Button>
            )}
            <Button
              size="lg"
              className="text-lg px-8"
              onClick={handleSubmit}
              disabled={shotsNum <= 0}
            >
              <CheckCircle className="w-6 h-6 mr-2" weight="fill" />
              {editingId ? 'Módosítás mentése' : 'Rögzítés'}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Meglévő műszakok listája */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Rögzített műszakok ({orderShifts.length})
          </h3>
          <ScrollArea className="max-h-[320px] pr-2">
            {orderShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-lg border border-dashed rounded-md">
                Ehhez a rendeléshez még nincs rögzített műszak
              </div>
            ) : (
              <div className="space-y-2">
                {orderShifts.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 border rounded-lg p-3 ${
                      editingId === s.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
                      <div className="font-mono text-lg">
                        {format(new Date(s.date), 'yyyy-MM-dd')}
                      </div>
                      <Badge
                        variant="outline"
                        className={`justify-center text-base py-1 ${
                          s.shift === 'de' ? '' : 'bg-accent/10'
                        }`}
                      >
                        {shiftLabel(s.shift)}
                      </Badge>
                      <div className="text-base text-muted-foreground truncate">
                        {machines.find(m => m.id === s.machineId)?.name ?? (s.machineId ? '?' : '—')}
                      </div>
                      <div className="text-lg">
                        <span className="text-muted-foreground">Lövés: </span>
                        <span className="font-mono font-semibold">{fmtInt(s.shotsCount)}</span>
                      </div>
                      <div className="text-lg">
                        <span className="text-muted-foreground">Darab: </span>
                        <span className="font-mono font-semibold text-accent">
                          {fmtInt(s.producedQuantity)}
                        </span>
                      </div>
                      <div className="text-base text-muted-foreground truncate col-span-2 md:col-span-1">
                        {s.notes || '-'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-lg"
                        onClick={() => handleEdit(s)}
                        disabled={editingId === s.id}
                      >
                        Szerk.
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(s)}
                      >
                        <Trash className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Selejt szekció */}
        {onSaveDefect && (
          <>
            <Separator />
            <div className="bg-card border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Warning className="w-7 h-7 text-destructive" weight="duotone" />
                  <h3 className="text-xl font-semibold">Selejt</h3>
                  {totalDefects > 0 && (
                    <Badge variant="destructive" className="font-mono text-base">
                      {fmtInt(totalDefects)} db összesen
                    </Badge>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={() => {
                    setEditingDefect(null)
                    setDefectDialogOpen(true)
                  }}
                  className="text-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Warning className="w-5 h-5 mr-2" weight="fill" />
                  Selejt rögzítése
                </Button>
              </div>

              {orderDefects.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-base border border-dashed rounded-md">
                  Még nincs rögzített selejt ehhez a rendeléshez
                </div>
              ) : (
                <ScrollArea className="max-h-[200px] pr-2">
                  <div className="space-y-2">
                    {orderDefects.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-start gap-3 border rounded-lg p-3 text-sm bg-destructive/5"
                      >
                        <div className="flex-1 min-w-0 grid grid-cols-3 md:grid-cols-4 gap-2 items-start">
                          <div className="font-mono text-base text-muted-foreground">
                            {format(new Date(d.date), 'yyyy-MM-dd')}
                          </div>
                          <div className="text-base">
                            <span className="text-muted-foreground">Mennyiség: </span>
                            <span className="font-mono font-bold text-destructive">
                              {fmtInt(d.quantity)} db
                            </span>
                          </div>
                          <div className="col-span-3 md:col-span-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Indok: </span>
                            {d.reason || '-'}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingDefect(d)
                              setDefectDialogOpen(true)
                            }}
                          >
                            Szerk.
                          </Button>
                          {onDeleteDefect && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Biztosan törlöd a ${d.date}-i ${d.quantity} db selejtet?`
                                  )
                                )
                                  return
                                onDeleteDefect(d.id)
                                toast.success('Selejt törölve')
                              }}
                            >
                              <Trash className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}

        {/* Gyártásvezérlő gombok */}
        {onStatusChange && (
          <>
            <Separator />
            <div className="border-2 rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-base font-semibold flex items-center gap-2">
                  <Factory className="w-5 h-5" weight="duotone" />
                  Gyártás állapota
                </div>
                <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                  Jelenleg: {order.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {isInProgress ? (
                  <Button
                    size="lg"
                    onClick={() => handleStatusButton('Elkészült', 'Elkészült')}
                    className="h-14 font-semibold text-base text-white shadow-sm bg-blue-600 hover:bg-blue-700"
                    title="Gyártás befejezése — a rendelés az Elkészült csoportba kerül"
                  >
                    <CheckCircle className="w-6 h-6 mr-2" weight="fill" />
                    Gyártás Elkészült
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleStartProductionClick}
                    className="h-14 font-semibold text-base text-white shadow-sm bg-green-600 hover:bg-green-700"
                    title="Gyártás indítása — a rendelés a Folyamatban csoportba kerül"
                  >
                    <PlayCircle className="w-6 h-6 mr-2" weight="fill" />
                    Gyártás indítása
                  </Button>
                )}
                <Button
                  size="lg"
                  onClick={() => handleStatusButton('Szünetel', 'Szünetel')}
                  className={`h-14 font-semibold text-base text-white shadow-sm ${
                    isPaused
                      ? 'bg-amber-500 hover:bg-amber-600 ring-2 ring-amber-300 ring-offset-2'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                  title="Gyártás szüneteltetése"
                >
                  <PauseCircle className="w-6 h-6 mr-2" weight="fill" />
                  Szünetelés
                </Button>
                <Button
                  size="lg"
                  onClick={() => {
                    const isComplete = order.amountPc > 0 && totalProduced >= order.amountPc
                    if (isComplete) {
                      handleStatusButton('Elkészült', 'Elkészült')
                    } else {
                      handleStatusButton('Előkészítve', 'Előkészítve')
                    }
                  }}
                  className={`h-14 font-semibold text-base text-white shadow-sm ${
                    isStopped
                      ? 'bg-slate-700 hover:bg-slate-800 ring-2 ring-slate-400 ring-offset-2'
                      : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                  title="Gyártás leállítása / befejezése"
                >
                  <StopCircle className="w-6 h-6 mr-2" weight="fill" />
                  Leállítás
                </Button>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" className="text-base" onClick={onClose}>
            Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Selejt rögzítés/szerkesztés dialógus */}
    {onSaveDefect && (
      <DefectEntryDialog
        open={defectDialogOpen}
        onClose={() => {
          setDefectDialogOpen(false)
          setEditingDefect(null)
        }}
        orderId={order?.id ?? null}
        orderLabel={order ? `${order.productName} — ${order.customer}` : undefined}
        editing={editingDefect}
        onSave={(d) => onSaveDefect(d)}
        userId={userId}
      />
    )}

    {/* Elkészült megerősítő popup */}
    <AlertDialog open={completionConfirmOpen} onOpenChange={setCompletionConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-green-700">
            <CheckFat className="w-6 h-6" weight="duotone" />
            Rendelés elkészült!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base space-y-2">
            <p>
              A legyártott mennyiség (<strong>{pendingNewTotalProduced.toLocaleString('hu-HU')} db</strong>)
              elérte a rendelt mennyiséget (<strong>{order?.amountPc?.toLocaleString('hu-HU')} db</strong>).
            </p>
            <p>Átváltjuk az <strong>Elkészült</strong> státuszra?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Nem most</AlertDialogCancel>
          <AlertDialogAction
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => {
              if (order && onStatusChange) {
                onStatusChange(order.id, 'Elkészült')
                toast.success(`${order.productName} → Elkészült`)
              }
              setCompletionConfirmOpen(false)
            }}
          >
            <CheckFat className="w-4 h-4 mr-2" />
            Igen, Elkészült
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Gyártás indítása — gép kiválasztó dialog */}
    <AlertDialog open={startMachineOpen} onOpenChange={setStartMachineOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <GearSix className="w-5 h-5 text-green-600" weight="duotone" />
            Gyártás indítása
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {startMachineLoading || startAssignment === undefined ? (
                <p className="text-muted-foreground">Hozzárendelés ellenőrzése…</p>
              ) : startAssignment === null ? (
                <div className="space-y-2">
                  <p>Ez a rendelés nincs tervezett munkának hozzárendelve egyetlen géphez sem.</p>
                  {machines.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Rendeld hozzá a Gyártástervező nézetben, majd indítsd el a gyártást.
                    </p>
                  )}
                </div>
              ) : (() => {
                const machine = machines.find(m => m.id === startAssignment.machineId)
                const machineName = machine?.name ?? startAssignment.machineId
                const position = startAssignment.position + 1
                const isFirst = position === 1
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                      <GearSix className="w-4 h-4 text-primary shrink-0" weight="duotone" />
                      <div>
                        <p className="font-medium">{machineName}</p>
                        <p className="text-xs text-muted-foreground">{position}. a sorban ezen a gépen</p>
                      </div>
                    </div>
                    {!isFirst && (
                      <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2">
                        <Warning className="w-4 h-4 text-warning shrink-0 mt-0.5" weight="fill" />
                        <p className="text-warning-foreground text-xs">
                          Ez a rendelés nem az első a sorban a gépen. Az előtte lévő {position - 1} munkát kihagynád.
                          Elfogadással az élre kerül a gépen.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Mégse</AlertDialogCancel>
          {startAssignment && startAssignment.position > 0 ? (
            <>
              <AlertDialogAction
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => confirmStartProduction(false)}
              >
                Indítás (sorrend marad)
              </AlertDialogAction>
              <AlertDialogAction
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => confirmStartProduction(true)}
              >
                <ArrowRight className="w-4 h-4 mr-1" />
                Élre + Indítás
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => confirmStartProduction(false)}
              disabled={startMachineLoading}
            >
              <PlayCircle className="w-4 h-4 mr-1" weight="fill" />
              Indítás
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
