import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Wrench, Plus, CheckCircle, Trash, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { generateId } from '@/lib/generateId'
import type { Machine, MachineMaintenance } from '@/lib/types'

interface MaintenanceViewProps {
  machines: Machine[]
  maintenance: MachineMaintenance[]
  onSave: (m: MachineMaintenance) => void
  onDelete: (id: string) => void
}

const TYPE_LABEL: Record<MachineMaintenance['type'], string> = {
  scheduled: 'Tervezett',
  repair: 'Javítás',
  inspection: 'Ellenőrzés',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date(todayIso()).getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export function MaintenanceView({ machines, maintenance, onSave, onDelete }: MaintenanceViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const machineName = useMemo(() => new Map(machines.map((m) => [m.id, m.name])), [machines])

  // Esedékes / közelgő tételek elöl (van nextDueAt), csökkenő sürgősség szerint.
  const rows = useMemo(() => {
    return [...maintenance].sort((a, b) => {
      const da = a.nextDueAt || '9999'
      const db = b.nextDueAt || '9999'
      if (da !== db) return da < db ? -1 : 1
      return (b.performedAt || '').localeCompare(a.performedAt || '')
    })
  }, [maintenance])

  const dueSoon = useMemo(
    () => maintenance.filter((m) => {
      const d = daysUntil(m.nextDueAt)
      return d !== null && d <= 14
    }).length,
    [maintenance]
  )

  // ── Új bejegyzés űrlap ──
  const [form, setForm] = useState({
    machineId: '', type: 'scheduled' as MachineMaintenance['type'],
    description: '', performedAt: todayIso(), nextDueAt: '', cost: '', performedBy: '',
  })

  const openAdd = () => {
    setForm({ machineId: machines[0]?.id ?? '', type: 'scheduled', description: '', performedAt: todayIso(), nextDueAt: '', cost: '', performedBy: '' })
    setDialogOpen(true)
  }

  const submit = () => {
    if (!form.machineId) { toast.error('Válassz gépet'); return }
    if (!form.description.trim()) { toast.error('Adj meg leírást'); return }
    const now = new Date().toISOString()
    onSave({
      id: generateId(),
      machineId: form.machineId,
      type: form.type,
      description: form.description.trim(),
      performedAt: form.performedAt,
      nextDueAt: form.nextDueAt,
      cost: form.cost.trim(),
      performedBy: form.performedBy.trim(),
      createdAt: now,
      updatedAt: now,
    })
    toast.success('Karbantartás rögzítve')
    setDialogOpen(false)
  }

  const dueBadge = (dateStr: string) => {
    const d = daysUntil(dateStr)
    if (d === null) return <span className="text-muted-foreground">—</span>
    if (d < 0) return <Badge variant="destructive">{Math.abs(d)} napja lejárt</Badge>
    if (d <= 14) return <Badge className="bg-warning text-warning-foreground">{d} nap múlva</Badge>
    return <span className="text-muted-foreground font-mono text-sm">{dateStr}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Karbantartás</h2>
          <p className="text-sm text-muted-foreground">
            Gépek ütemezett karbantartása és esedékessége
            {dueSoon > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning font-medium">
                <Warning className="w-4 h-4" weight="fill" /> {dueSoon} közelgő/lejárt
              </span>
            )}
          </p>
        </div>
        <Button onClick={openAdd} disabled={machines.length === 0} className="gap-2">
          <Plus className="w-4 h-4" /> Új karbantartás
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="duotone" />
          <h3 className="text-lg font-semibold mb-2">Nincs karbantartási bejegyzés</h3>
          <p className="text-muted-foreground">Rögzítsd a gépek ütemezett karbantartásait és esedékességüket.</p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gép</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead>Leírás</TableHead>
                <TableHead>Elvégezve</TableHead>
                <TableHead>Következő esedékesség</TableHead>
                <TableHead>Költség</TableHead>
                <TableHead className="text-right">Művelet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id} className="even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]">
                  <TableCell className="font-medium">{machineName.get(m.machineId) || m.machineId}</TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[m.type]}</Badge></TableCell>
                  <TableCell className="max-w-[260px] truncate">{m.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{m.performedAt || '—'}</TableCell>
                  <TableCell>{dueBadge(m.nextDueAt)}</TableCell>
                  <TableCell className="text-sm">{m.cost || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(m.id)}
                      title="Törlés"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" weight="duotone" /> Új karbantartás
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Gép</Label>
              <Select value={form.machineId} onValueChange={(v) => setForm((f) => ({ ...f, machineId: v }))}>
                <SelectTrigger><SelectValue placeholder="Válassz gépet…" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Típus</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as MachineMaintenance['type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Tervezett</SelectItem>
                  <SelectItem value="repair">Javítás</SelectItem>
                  <SelectItem value="inspection">Ellenőrzés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mnt-desc">Leírás</Label>
              <Input id="mnt-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="pl. olajcsere, szűrő, kalibráció" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="mnt-performed">Elvégezve</Label>
                <Input id="mnt-performed" type="date" value={form.performedAt} onChange={(e) => setForm((f) => ({ ...f, performedAt: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mnt-due">Következő esedékesség</Label>
                <Input id="mnt-due" type="date" value={form.nextDueAt} onChange={(e) => setForm((f) => ({ ...f, nextDueAt: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="mnt-cost">Költség</Label>
                <Input id="mnt-cost" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} placeholder="pl. 25 000 Ft" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mnt-by">Végezte</Label>
                <Input id="mnt-by" value={form.performedBy} onChange={(e) => setForm((f) => ({ ...f, performedBy: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button onClick={submit} className="gap-1"><CheckCircle className="w-4 h-4" weight="fill" /> Mentés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
