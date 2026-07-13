/**
 * Kiegészítő tételek a szállítólevélen.
 *
 * Két módon vehető fel sor:
 *  - KÉSZLETBŐL: szerszám / alapanyag / kész termék a készlet-listából
 *    (név + egység előtöltve, mennyiség kézzel)
 *  - SZABAD SOR: rendszerben nem lévő tétel kézzel beírva
 *
 * A tételek a szállítólevél-rekordon tárolódnak (extraItems), és a nyomtatott
 * dokumentumon a rendelés-sorok után jelennek meg.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Package, Plus, Trash, Wrench, Cube, FloppyDisk } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { parseFloatSafe } from '@/lib/helpers'
import { unitOf } from '@/lib/materialService'
import type { DeliveryNote, ExtraDeliveryItem, InventoryItem } from '@/lib/types'

interface ExtraItemsDialogProps {
  note: DeliveryNote | null
  inventory: InventoryItem[]
  onClose: () => void
  onSave: (note: DeliveryNote, extraItems: ExtraDeliveryItem[]) => void
}

export function ExtraItemsDialog({ note, inventory, onClose, onSave }: ExtraItemsDialogProps) {
  const [items, setItems] = useState<ExtraDeliveryItem[]>([])
  const [prevNoteId, setPrevNoteId] = useState<string | null>(null)

  // Nyitáskor a jegyzék aktuális tételeinek betöltése (sync-on-open minta)
  if (note && note.id !== prevNoteId) {
    setItems((note.extraItems ?? []).map((i) => ({ ...i })))
    setPrevNoteId(note.id)
  }
  if (!note && prevNoteId !== null) setPrevNoteId(null)

  const [pickerId, setPickerId] = useState('')

  if (!note) return null

  const upd = (i: number, patch: Partial<ExtraDeliveryItem>) =>
    setItems((list) => list.map((row, j) => (j === i ? { ...row, ...patch } : row)))

  const addFree = () => setItems((list) => [...list, { name: '', quantity: 1, unit: 'db' }])

  const addFromInventory = (id: string) => {
    const inv = inventory.find((i) => i.id === id)
    if (!inv) return
    setItems((list) => [
      ...list,
      {
        name: inv.productName || inv.drawingNumber || 'Készlet-tétel',
        quantity: 1,
        unit: unitOf(inv),
        notes: inv.drawingNumber && inv.productName ? inv.drawingNumber : undefined,
      },
    ])
    setPickerId('')
  }

  const valid = items.every((i) => i.name.trim() !== '' && i.quantity > 0)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" weight="duotone" />
            Kiegészítő tételek — {note.sequenceNumber}
          </DialogTitle>
          <DialogDescription>
            Szerszám, alapanyag vagy bármilyen szabad tétel, ami a nyomtatott
            szállítólevélen a rendelés-sorok után jelenik meg.
          </DialogDescription>
        </DialogHeader>

        {/* Hozzáadás */}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="grid gap-1.5 flex-1 min-w-[220px]">
            <Label>Készletből (szerszám / alapanyag / termék)</Label>
            <Select value={pickerId} onValueChange={addFromInventory}>
              <SelectTrigger>
                <SelectValue placeholder="Válassz készlet-tételt…" />
              </SelectTrigger>
              <SelectContent>
                {inventory.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.itemType === 'szerszam' ? '🔧 ' : inv.itemType === 'alapanyag' ? '🧱 ' : '📦 '}
                    {inv.productName || inv.drawingNumber} ({inv.quantity.toLocaleString('hu-HU')} {unitOf(inv)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="gap-1" onClick={addFree}>
            <Plus className="w-4 h-4" /> Szabad sor
          </Button>
        </div>

        {/* Tétel-lista */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Még nincs kiegészítő tétel.
            </p>
          ) : (
            items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_80px_1fr_36px] gap-2 items-center">
                <Input
                  placeholder="Megnevezés"
                  value={item.name}
                  onChange={(e) => upd(i, { name: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => upd(i, { quantity: parseFloatSafe(e.target.value, 0, { allowNegative: false }) })}
                />
                <Select value={item.unit} onValueChange={(v) => upd(i, { unit: v as 'db' | 'kg' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="db">db</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Megjegyzés (opcionális)"
                  value={item.notes ?? ''}
                  onChange={(e) => upd(i, { notes: e.target.value || undefined })}
                />
                <Button
                  variant="ghost" size="sm"
                  className="text-destructive hover:text-destructive px-2"
                  onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> szerszám</span>
          <span className="flex items-center gap-1"><Cube className="w-3.5 h-3.5" /> alapanyag</span>
          — mentés után az újranyomtatás / PDF már ezekkel a sorokkal készül.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button
            disabled={!valid}
            className="gap-1"
            onClick={() => {
              onSave(note, items)
              toast.success(items.length === 0 ? 'Kiegészítő tételek törölve' : `${items.length} kiegészítő tétel mentve`)
              onClose()
            }}
          >
            <FloppyDisk className="w-4 h-4" /> Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
