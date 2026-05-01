import { useEffect, useMemo, useState } from 'react'
import type {
  Order,
  OrderStatus,
  Product,
  ProductionShift,
  ProductionDefect,
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
  Warning,
} from '@phosphor-icons/react'
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
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * A rendeléshez tartozó műszakok listázására + egy új műszak rögzítésére / szerkesztésére.
 * A darabszám a `shotsCount × nestCount` képlet szerint számolódik a mentéskor.
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
  userId,
}: ProductionDetailDialogProps) {
  const [date, setDate] = useState<string>(toISODate(new Date()))
  const [shift, setShift] = useState<'de' | 'du'>('de')
  const [shotsCount, setShotsCount] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  // Selejt-dialógus állapota
  const [defectDialogOpen, setDefectDialogOpen] = useState(false)
  const [editingDefect, setEditingDefect] = useState<ProductionDefect | null>(null)

  const nestCountNum = useMemo(() => {
    const n = parseFloatSafe(product?.nestCount, 1, { allowNegative: false })
    return n > 0 ? n : 1
  }, [product])

  // Reset form whenever the dialog opens, prefills are recalculated.
  useEffect(() => {
    if (!open) return
    setDate(prefillDate || toISODate(new Date()))
    setShift(prefillShift || 'de')
    setShotsCount('')
    setNotes('')
    setEditingId(null)
  }, [open, prefillDate, prefillShift, order?.id])

  const orderShifts = useMemo(() => {
    if (!order) return [] as ProductionShift[]
    return [...shifts]
      .filter((s) => s.orderId === order.id)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return a.shift === 'de' ? -1 : 1
      })
  }, [order, shifts])

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

  const shotsNum = parseFloatSafe(shotsCount, 0, { allowNegative: false })
  const producedPreview = Math.max(0, Math.round(shotsNum * nestCountNum))

  // Figyelmeztetés: van-e már ezen a napon + műszakban rögzítés (és nem ugyanaz a rekord, mint amit szerkesztünk)
  const duplicate = useMemo(() => {
    return orderShifts.find(
      (s) => s.date === date && s.shift === shift && s.id !== editingId
    )
  }, [orderShifts, date, shift, editingId])

  const handleSubmit = () => {
    if (!order) return
    if (shotsNum <= 0) {
      toast.error('A lövésszámnak 0-nál nagyobbnak kell lennie')
      return
    }
    if (duplicate) {
      toast.error(
        `Erre a napra és műszakra már van rögzítés (${duplicate.shotsCount} lövés). Szerkeszd meg vagy töröld azt.`
      )
      return
    }

    const id = editingId ?? `shift-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const now = new Date().toISOString()

    const newShift: ProductionShift = {
      id,
      orderId: order.id,
      date,
      shift,
      shotsCount: shotsNum,
      producedQuantity: producedPreview,
      notes: notes.trim(),
      userId,
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
    setShotsCount('')
    setNotes('')
    setEditingId(null)
  }

  const handleEdit = (s: ProductionShift) => {
    setDate(s.date)
    setShift(s.shift)
    setShotsCount(String(s.shotsCount))
    setNotes(s.notes)
    setEditingId(s.id)
  }

  const handleCancelEdit = () => {
    setDate(toISODate(new Date()))
    setShift('de')
    setShotsCount('')
    setNotes('')
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
   * Ez határozza meg, hogy a Gyártás nézetben melyik csoportban jelenjen meg a kártya.
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

  if (!order) return null

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5" weight="duotone" />
            Gyártási műszakok — {order.productName}
          </DialogTitle>
          <DialogDescription>
            {order.customer} · Rend. szám: {order.orderNumber || '-'} · Mennyiség:{' '}
            {fmtInt(order.amountPc)} db
          </DialogDescription>
        </DialogHeader>

        {/* Összesítő */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3">
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Összes lövés</div>
            <div className="text-2xl font-bold font-mono">{fmtInt(totalShots)}</div>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Gyártott darab</div>
            <div className="text-2xl font-bold font-mono">{fmtInt(totalProduced)}</div>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <div className="text-xs text-muted-foreground">Fészekszám</div>
            <div className="text-2xl font-bold font-mono">{fmtInt(nestCountNum)}</div>
          </div>
          <div
            className={`rounded-md p-3 ${
              totalDefects > 0
                ? 'bg-destructive/10 ring-1 ring-destructive/20'
                : 'bg-muted/50'
            }`}
          >
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Warning className="w-3 h-3" weight="fill" /> Selejt (db)
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
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
              Nem található hozzárendelt termék („{order.productName}" — {order.customer}).
              A fészekszám alapértelmezetten 1, a darabszám a lövésszámmal egyenlő.
              A termékek fülön rögzítsd a rajzszámot és a fészekszámot a pontos készletfrissítéshez.
            </AlertDescription>
          </Alert>
        )}

        {/* Új / szerkesztett műszak űrlap */}
        <div className="bg-card border rounded-md p-4 space-y-4">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-accent" weight="duotone" />
            <h3 className="font-semibold">
              {editingId ? 'Műszak szerkesztése' : 'Új műszak rögzítése'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="shift-date">Dátum</Label>
              <Input
                id="shift-date"
                type="date"
                value={date}
                max={toISODate(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shift-type">Műszak</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as 'de' | 'du')}>
                <SelectTrigger id="shift-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Délelőtt (de)</SelectItem>
                  <SelectItem value="du">Délután (du)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shots-count">Lövésszám</Label>
              <Input
                id="shots-count"
                type="number"
                min={0}
                value={shotsCount}
                placeholder="pl. 120"
                onChange={(e) => setShotsCount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="shift-notes">Megjegyzés</Label>
            <Textarea
              id="shift-notes"
              rows={2}
              value={notes}
              placeholder="Pl. leállás, anyagmozgatás, műszakváltás..."
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {duplicate && (
            <Alert variant="destructive">
              <Warning className="w-4 h-4" weight="fill" />
              <AlertDescription>
                Erre a napra és műszakra már van egy rögzítés ({duplicate.shotsCount}{' '}
                lövés, {duplicate.producedQuantity} db). Válaszd azt szerkesztésre a
                lenti listában.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">
              Kalkulált darabszám:{' '}
              <span className="font-mono font-semibold text-foreground">
                {fmtInt(shotsNum || 0)} × {fmtInt(nestCountNum)} = {fmtInt(producedPreview)} db
              </span>
            </div>
            <div className="flex gap-2">
              {editingId && (
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Mégse
                </Button>
              )}
              <Button size="sm" onClick={handleSubmit} disabled={shotsNum <= 0}>
                <CheckCircle className="w-4 h-4 mr-1" weight="fill" />
                {editingId ? 'Módosítás mentése' : 'Rögzítés'}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Meglévő műszakok listája */}
        <div>
          <h3 className="font-semibold text-sm mb-3">
            Rögzített műszakok ({orderShifts.length})
          </h3>
          <ScrollArea className="max-h-[300px] pr-2">
            {orderShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md">
                Ehhez a rendeléshez még nincs rögzített műszak
              </div>
            ) : (
              <div className="space-y-2">
                {orderShifts.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 border rounded-md p-3 text-sm ${
                      editingId === s.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                      <div className="font-mono">
                        {format(new Date(s.date), 'yyyy-MM-dd')}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          s.shift === 'de'
                            ? 'justify-center'
                            : 'justify-center bg-accent/10'
                        }
                      >
                        {shiftLabel(s.shift)}
                      </Badge>
                      <div>
                        <span className="text-muted-foreground">Lövés: </span>
                        <span className="font-mono font-medium">{fmtInt(s.shotsCount)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Darab: </span>
                        <span className="font-mono font-medium">
                          {fmtInt(s.producedQuantity)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate col-span-2 md:col-span-1">
                        {s.notes || '-'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
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
                        <Trash className="w-4 h-4" />
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
            <div className="bg-card border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Warning className="w-5 h-5 text-destructive" weight="duotone" />
                  <h3 className="font-semibold">Selejt</h3>
                  {totalDefects > 0 && (
                    <Badge variant="destructive" className="font-mono">
                      {fmtInt(totalDefects)} db összesen
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingDefect(null)
                    setDefectDialogOpen(true)
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Warning className="w-4 h-4 mr-1.5" weight="fill" />
                  Selejt rögzítése
                </Button>
              </div>

              {orderDefects.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-md">
                  Még nincs rögzített selejt ehhez a rendeléshez
                </div>
              ) : (
                <ScrollArea className="max-h-[200px] pr-2">
                  <div className="space-y-2">
                    {orderDefects.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-start gap-3 border rounded-md p-3 text-sm bg-destructive/5"
                      >
                        <div className="flex-1 min-w-0 grid grid-cols-3 md:grid-cols-4 gap-2 items-start">
                          <div className="font-mono text-xs text-muted-foreground">
                            {format(new Date(d.date), 'yyyy-MM-dd')}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mennyiség: </span>
                            <span className="font-mono font-bold text-destructive">
                              {fmtInt(d.quantity)} db
                            </span>
                          </div>
                          <div className="col-span-3 md:col-span-2 text-xs text-muted-foreground">
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
                              <Trash className="w-4 h-4" />
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

        {/* Gyártásvezérlő gombok — legalul, a státusz alapján kerül a kártya a megfelelő csoportba. */}
        {onStatusChange && (
          <>
            <Separator />
            <div className="border rounded-md p-3 bg-card">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Factory className="w-4 h-4" weight="duotone" />
                  Gyártás állapota
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Jelenleg: {order.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  size="lg"
                  onClick={() => handleStatusButton('Folyamatban', 'Folyamatban')}
                  className={`h-11 font-semibold text-white shadow-sm ${
                    isInProgress
                      ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-400 ring-offset-2'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                  title="Gyártás indítása — a rendelés a Folyamatban csoportba kerül"
                >
                  <PlayCircle className="w-5 h-5 mr-2" weight="fill" />
                  Gyártás indítása
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleStatusButton('Szünetel', 'Szünetel')}
                  className={`h-11 font-semibold text-white shadow-sm ${
                    isPaused
                      ? 'bg-amber-500 hover:bg-amber-600 ring-2 ring-amber-300 ring-offset-2'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                  title="Gyártás szüneteltetése — a rendelés a Szünetel csoportba kerül"
                >
                  <PauseCircle className="w-5 h-5 mr-2" weight="fill" />
                  Szünetelés
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleStatusButton('Előkészítve', 'Előkészítve')}
                  className={`h-11 font-semibold text-white shadow-sm ${
                    isStopped
                      ? 'bg-slate-700 hover:bg-slate-800 ring-2 ring-slate-400 ring-offset-2'
                      : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                  title="Gyártás leállítása / befejezése — a rendelés az Előkészítve csoportba kerül"
                >
                  <StopCircle className="w-5 h-5 mr-2" weight="fill" />
                  Leállítás
                </Button>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Selejt rögzítés/szerkesztés dialógus — a fő dialóg fölött jelenik meg. */}
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
    </>
  )
}
