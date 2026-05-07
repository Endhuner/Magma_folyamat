/**
 * MachineDetailDialog — gép részletek: Olajok / Kiegészítések / Javítások
 *
 * Mindhárom csoportban táblázat + hozzáadás/szerkesztés/törlés dialógus.
 * Az adatok a Machine objektumon belül tárolódnak (oils, accessories, repairs tömbök).
 */
import { useState } from 'react'
import { generateId } from '@/lib/generateId'
import type { Machine, MachineItem, MachineRepair } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  PencilSimple,
  Trash,
  Drop,
  Wrench,
  Toolbox,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

const UNITS = ['db', 'l', 'dl', 'ml', 'kg', 'g', 'm', 'cm', 'mm', 'csomag', 'egyéb']

interface MachineDetailDialogProps {
  open: boolean
  onClose: () => void
  machine: Machine | null
  onSave: (machine: Machine) => void
}

// ── Üres form értékek ────────────────────────────────────────────────────────

function emptyItem(): Omit<MachineItem, 'id' | 'createdAt'> {
  return { name: '', drawingNumber: '', quantity: 1, unit: 'db', source: '', notes: '' }
}

function emptyRepair(): Omit<MachineRepair, 'id' | 'createdAt'> {
  const today = new Date()
  const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return { name: '', drawingNumber: '', quantity: 1, unit: 'db', source: '', date: d, status: 'tervezett', notes: '' }
}

// ── Segéd: tömb frissítés id alapján ────────────────────────────────────────

function upsertById<T extends { id: string }>(arr: T[], item: T): T[] {
  const exists = arr.some((x) => x.id === item.id)
  if (exists) return arr.map((x) => (x.id === item.id ? item : x))
  return [...arr, item]
}

// ── Olajok / Kiegészítések altáblázat ────────────────────────────────────────

interface ItemSectionProps {
  items: MachineItem[]
  onAdd: (item: MachineItem) => void
  onEdit: (item: MachineItem) => void
  onDelete: (id: string) => void
  emptyText: string
}

function ItemSection({ items, onAdd, onEdit, onDelete, emptyText }: ItemSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyItem())

  const openAdd = () => {
    setForm(emptyItem())
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (item: MachineItem) => {
    setForm({
      name: item.name,
      drawingNumber: item.drawingNumber,
      quantity: item.quantity,
      unit: item.unit,
      source: item.source,
      notes: item.notes,
    })
    setEditingId(item.id)
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('A megnevezés kitöltése kötelező')
      return
    }
    const now = new Date().toISOString()
    const item: MachineItem = {
      id: editingId ?? generateId(),
      createdAt: editingId
        ? (items.find((i) => i.id === editingId)?.createdAt ?? now)
        : now,
      ...form,
      quantity: Number(form.quantity) || 0,
    }
    if (editingId) {
      onEdit(item)
      toast.success('Tétel módosítva')
    } else {
      onAdd(item)
      toast.success('Tétel hozzáadva')
    }
    setDialogOpen(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Tétel hozzáadása
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md text-sm">
          {emptyText}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Megnevezés</TableHead>
                <TableHead>Rajzszám</TableHead>
                <TableHead className="text-right">Mennyiség</TableHead>
                <TableHead>Honnan</TableHead>
                <TableHead>Megjegyzés</TableHead>
                <TableHead className="text-right w-[90px]">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-sm">{item.drawingNumber || '—'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell className="text-sm">{item.source || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                    {item.notes || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Hozzáadás/szerkesztés dialógus */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Tétel szerkesztése' : 'Új tétel hozzáadása'}</DialogTitle>
            <DialogDescription>Töltsd ki a tétel adatait.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 grid gap-1.5">
              <Label>Megnevezés <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                placeholder="Pl. Hidraulikaolaj"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Rajzszám</Label>
              <Input
                value={form.drawingNumber}
                placeholder="Pl. OL-32"
                onChange={(e) => setForm((f) => ({ ...f, drawingNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Honnan vettük</Label>
              <Input
                value={form.source}
                placeholder="Pl. Würth Budapest"
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mennyiség</Label>
              <Input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Egység</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label>Megjegyzés</Label>
              <Textarea
                value={form.notes}
                rows={2}
                placeholder="Opcionális megjegyzés..."
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button onClick={handleSave}>{editingId ? 'Mentés' : 'Hozzáadás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Törlés megerősítés */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törli?</AlertDialogTitle>
            <AlertDialogDescription>Ez a tétel véglegesen törlődik.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) { onDelete(deleteId); toast.success('Tétel törölve') }
                setDeleteId(null)
              }}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Javítások altáblázat ─────────────────────────────────────────────────────

interface RepairSectionProps {
  repairs: MachineRepair[]
  onAdd: (r: MachineRepair) => void
  onEdit: (r: MachineRepair) => void
  onDelete: (id: string) => void
}

function RepairSection({ repairs, onAdd, onEdit, onDelete }: RepairSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyRepair())

  const openAdd = () => {
    setForm(emptyRepair())
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (r: MachineRepair) => {
    setForm({
      name: r.name,
      drawingNumber: r.drawingNumber,
      quantity: r.quantity,
      unit: r.unit,
      source: r.source,
      date: r.date,
      status: r.status,
      notes: r.notes,
    })
    setEditingId(r.id)
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('A megnevezés kitöltése kötelező')
      return
    }
    const now = new Date().toISOString()
    const repair: MachineRepair = {
      id: editingId ?? generateId(),
      createdAt: editingId
        ? (repairs.find((r) => r.id === editingId)?.createdAt ?? now)
        : now,
      ...form,
      quantity: Number(form.quantity) || 0,
    }
    if (editingId) {
      onEdit(repair)
      toast.success('Javítás módosítva')
    } else {
      onAdd(repair)
      toast.success('Javítás hozzáadva')
    }
    setDialogOpen(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Javítás hozzáadása
        </Button>
      </div>

      {repairs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md text-sm">
          Még nincs rögzített javítás ehhez a géphez.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Megnevezés</TableHead>
                <TableHead>Rajzszám</TableHead>
                <TableHead className="text-right">Mennyiség</TableHead>
                <TableHead>Honnan</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead>Állapot</TableHead>
                <TableHead>Megjegyzés</TableHead>
                <TableHead className="text-right w-[90px]">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...repairs].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-sm">{r.drawingNumber || '—'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.quantity} {r.unit}
                  </TableCell>
                  <TableCell className="text-sm">{r.source || '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{r.date}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === 'elvégzett' ? 'default' : 'outline'}
                      className={r.status === 'elvégzett'
                        ? 'bg-green-700 text-white'
                        : 'border-amber-500 text-amber-600'}
                    >
                      {r.status === 'elvégzett' ? 'Elvégzett' : 'Tervezett'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                    {r.notes || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Hozzáadás/szerkesztés dialógus */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Javítás szerkesztése' : 'Új javítás rögzítése'}</DialogTitle>
            <DialogDescription>Töltsd ki a javítás adatait.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 grid gap-1.5">
              <Label>Megnevezés <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                placeholder="Pl. Szivattyú csere"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Rajzszám</Label>
              <Input
                value={form.drawingNumber}
                placeholder="Pl. P-456"
                onChange={(e) => setForm((f) => ({ ...f, drawingNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Honnan vettük</Label>
              <Input
                value={form.source}
                placeholder="Pl. Bosch Service"
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mennyiség</Label>
              <Input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Egység</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Dátum</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Állapot</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as MachineRepair['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tervezett">Tervezett</SelectItem>
                  <SelectItem value="elvégzett">Elvégzett</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label>Megjegyzés</Label>
              <Textarea
                value={form.notes}
                rows={2}
                placeholder="Opcionális megjegyzés..."
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button onClick={handleSave}>{editingId ? 'Mentés' : 'Hozzáadás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Törlés megerősítés */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törli?</AlertDialogTitle>
            <AlertDialogDescription>Ez a javítási tétel véglegesen törlődik.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) { onDelete(deleteId); toast.success('Javítás törölve') }
                setDeleteId(null)
              }}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Fő dialógus ──────────────────────────────────────────────────────────────

export function MachineDetailDialog({ open, onClose, machine, onSave }: MachineDetailDialogProps) {
  if (!machine) return null

  const oils = machine.oils ?? []
  const accessories = machine.accessories ?? []
  const repairs = machine.repairs ?? []

  const save = (patch: Partial<Machine>) => {
    onSave({ ...machine, ...patch, updatedAt: new Date().toISOString() })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Toolbox className="w-6 h-6 text-accent" weight="duotone" />
            {machine.name}
            {machine.serialNumber && (
              <span className="text-muted-foreground font-normal text-base ml-1">
                — {machine.serialNumber}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {machine.type && <span>{machine.type}</span>}
            {machine.capacity && <span> · {machine.capacity}</span>}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="oils" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="oils" className="gap-2">
              <Drop className="w-4 h-4" weight="duotone" />
              Olajok
              {oils.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{oils.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accessories" className="gap-2">
              <Toolbox className="w-4 h-4" weight="duotone" />
              Kiegészítések
              {accessories.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{accessories.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="repairs" className="gap-2">
              <Wrench className="w-4 h-4" weight="duotone" />
              Javítások
              {repairs.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{repairs.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oils" className="mt-4">
            <ScrollArea className="max-h-[50vh]">
              <ItemSection
                items={oils}
                emptyText="Még nincs rögzített olaj/kenőanyag ehhez a géphez."
                onAdd={(item) => save({ oils: [...oils, item] })}
                onEdit={(item) => save({ oils: upsertById(oils, item) })}
                onDelete={(id) => save({ oils: oils.filter((i) => i.id !== id) })}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="accessories" className="mt-4">
            <ScrollArea className="max-h-[50vh]">
              <ItemSection
                items={accessories}
                emptyText="Még nincs rögzített kiegészítő ehhez a géphez."
                onAdd={(item) => save({ accessories: [...accessories, item] })}
                onEdit={(item) => save({ accessories: upsertById(accessories, item) })}
                onDelete={(id) => save({ accessories: accessories.filter((i) => i.id !== id) })}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="repairs" className="mt-4">
            <ScrollArea className="max-h-[50vh]">
              <RepairSection
                repairs={repairs}
                onAdd={(r) => save({ repairs: [...repairs, r] })}
                onEdit={(r) => save({ repairs: upsertById(repairs, r) })}
                onDelete={(id) => save({ repairs: repairs.filter((r) => r.id !== id) })}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Bezárás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
