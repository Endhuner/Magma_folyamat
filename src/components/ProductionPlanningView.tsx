/**
 * Gyártástervező nézet — gépek és rendelések drag & drop tervezése.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GearSix, MagnifyingGlass, ClockCountdown,
  X, List, ArrowLeft, Package, Plus,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Order, Machine, MachinePlanningAssignment, MachinePlanningLogEntry } from '@/lib/types'

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) || ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (res.status === 204) return undefined as unknown as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props { machines: Machine[]; orders: Order[] }

// drag adatok átadása dataTransfer-en keresztül (böngésző-kompatibilitás)
const DT_KEY = 'application/x-pp-order'

type DragPayload =
  | { kind: 'unassigned'; orderId: string }
  | { kind: 'assigned'; assignmentId: string; machineId: string; orderId: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = 'gy-tervezes-selected-machines'
function loadSelectedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveSelectedIds(ids: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ids)) } catch {}
}

function getYear(o: Order) { return (o.orderDate || o.createdAt || '').slice(0, 4) || '—' }
function fmtHours(h: string) { const n = parseFloat(h); return isNaN(n) || n === 0 ? '—' : `${n} ó` }
function totalHours(asgn: MachinePlanningAssignment[], om: Map<string, Order>) {
  return asgn.reduce((s, a) => {
    const h = a.plannedHoursOverride
      ? parseFloat(a.plannedHoursOverride)
      : parseFloat(om.get(a.orderId)?.plannedProductionHours || '0')
    return s + (isNaN(h) ? 0 : h)
  }, 0)
}

const COLORS = ['bg-blue-500','bg-purple-500','bg-green-600','bg-orange-500','bg-teal-500','bg-rose-500','bg-indigo-500','bg-amber-500']
function colorFor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

// ─── MachineSelector ─────────────────────────────────────────────────────────

function MachineSelector({ allMachines, selectedIds, onToggle }: {
  allMachines: Machine[]; selectedIds: string[]; onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const unselected = allMachines.filter(m => !selectedIds.includes(m.id))
  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen(v => !v)} className="gap-1.5">
        <Plus size={14} /> Gép hozzáadása
      </Button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border bg-popover shadow-lg p-1">
          {unselected.length === 0
            ? <p className="text-xs text-muted-foreground px-2 py-2 text-center">Minden gép a nézetben van</p>
            : unselected.map(m => (
              <button key={m.id} onClick={() => { onToggle(m.id); setOpen(false) }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${colorFor(m.id)}`}>
                  {m.photoUrl
                    ? <img src={m.photoUrl} alt={m.name} className="w-6 h-6 rounded-full object-cover" />
                    : <span className="text-white text-xs font-bold">{m.name.charAt(0).toUpperCase()}</span>}
                </div>
                <span className="truncate flex-1">{m.name}</span>
                {m.type && <span className="text-xs text-muted-foreground shrink-0">{m.type}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

function OrderRow({ order, assignment, dragging, onDragStart, onDragEnd, onRemove }: {
  order: Order; assignment?: MachinePlanningAssignment; dragging: boolean
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; onRemove?: () => void
}) {
  const hoursStr = fmtHours(assignment?.plannedHoursOverride || order.plannedProductionHours)
  const year = getYear(order)
  const label = [order.productName, order.designation].filter(Boolean).join(' / ')
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border bg-card
        px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none transition-opacity
        ${dragging ? 'opacity-40' : 'hover:border-primary/50 hover:shadow-sm'}`}
    >
      <span className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0">⠿</span>
      {year !== '—' && <span className="text-muted-foreground shrink-0">{year}</span>}
      {order.customer && <span className="font-medium shrink-0 max-w-[110px] truncate" title={order.customer}>{order.customer}</span>}
      {label && <span className="text-muted-foreground truncate min-w-0 flex-1" title={label}>{label}</span>}
      {order.ownOrderNumber && <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">#{order.ownOrderNumber}</span>}
      {order.amountPc > 0 && <span className="shrink-0">{order.amountPc.toLocaleString('hu')} db</span>}
      {order.requiredDate && <span className="shrink-0 text-muted-foreground">{order.requiredDate.slice(0, 10)}</span>}
      {hoursStr !== '—' && <span className="shrink-0 font-mono text-primary/70">{hoursStr}</span>}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove() }}
          className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          title="Eltávolítás">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ─── MachineCard ─────────────────────────────────────────────────────────────

function MachineCard({ machine, assignments, orderMap, activeDragOrderId,
  onDragStartAssigned, onDragEnd, onDrop, onRemoveAssignment, onOpenLog, onRemoveFromView,
}: {
  machine: Machine; assignments: MachinePlanningAssignment[]
  orderMap: Map<string, Order>; activeDragOrderId: string | null
  onDragStartAssigned: (e: React.DragEvent, a: MachinePlanningAssignment) => void
  onDragEnd: () => void
  onDrop: (machineId: string, afterAssignmentId?: string) => void
  onRemoveAssignment: (id: string) => void
  onOpenLog: (m: Machine) => void
  onRemoveFromView: (id: string) => void
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [isOver, setIsOver] = useState(false)
  const sorted = [...assignments].sort((a, b) => a.position - b.position)
  const hrs = totalHours(assignments, orderMap)
  const isDragging = activeDragOrderId !== null

  function allowDrop(e: React.DragEvent) {
    // Kritikus: e.preventDefault() nélkül a drop nem tüzel
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <Card className={`flex flex-col min-w-[280px] flex-1 transition-all
      ${isOver && isDragging ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      onDragOver={e => { allowDrop(e); setIsOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setIsOver(false); setDropTarget(null) } }}
      onDrop={e => { e.preventDefault(); setIsOver(false); setDropTarget(null); onDrop(machine.id) }}
    >
      {/* Fotó — teljes kép, nem vágva */}
      {machine.photoUrl && (
        <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-center justify-center" style={{ minHeight: 160 }}>
          <img src={machine.photoUrl} alt={machine.name}
            className="w-full h-auto max-h-64 object-contain" />
        </div>
      )}

      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-2">
          {!machine.photoUrl && (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorFor(machine.id)}`}>
              <span className="text-white text-sm font-bold">{machine.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{machine.name}</CardTitle>
            {machine.type && <p className="text-xs text-muted-foreground">{machine.type}</p>}
            {machine.capacity && <p className="text-xs text-muted-foreground">{machine.capacity}</p>}
          </div>
          <button onClick={() => onOpenLog(machine)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Log">
            <List size={14} />
          </button>
          <button onClick={() => onRemoveFromView(machine.id)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            title="Eltávolítás a nézetből">
            <X size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <ClockCountdown size={11} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {hrs > 0 ? `${hrs.toFixed(1)} ó` : 'Üres'}
          </span>
          {assignments.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs px-1 py-0">{assignments.length} db</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-2 flex-1 overflow-y-auto max-h-[320px]">
        {/* Top drop zone */}
        <div
          className={`h-1.5 rounded mb-1 transition-all ${dropTarget === '__top__' ? 'bg-primary/50 h-2.5' : ''}`}
          onDragOver={e => { allowDrop(e); setDropTarget('__top__') }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); setDropTarget(null); onDrop(machine.id, undefined) }}
        />

        {sorted.length === 0 ? (
          <div className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed
            py-6 text-xs text-muted-foreground transition-colors
            ${isDragging ? 'border-primary/50 bg-primary/5' : 'border-muted'}`}>
            <Package size={18} className="mb-1 opacity-40" />
            Húzz ide rendelést
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sorted.map(asgn => {
              const order = orderMap.get(asgn.orderId)
              if (!order) return null
              return (
                <div key={asgn.id}>
                  <OrderRow
                    order={order} assignment={asgn}
                    dragging={activeDragOrderId === asgn.orderId}
                    onDragStart={e => onDragStartAssigned(e, asgn)}
                    onDragEnd={onDragEnd}
                    onRemove={() => onRemoveAssignment(asgn.id)}
                  />
                  <div
                    className={`h-1.5 rounded transition-all ${dropTarget === asgn.id ? 'bg-primary/50 h-2.5' : ''}`}
                    onDragOver={e => { allowDrop(e); setDropTarget(asgn.id) }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); setDropTarget(null); onDrop(machine.id, asgn.id) }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── LogPanel ────────────────────────────────────────────────────────────────

function LogPanel({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const [log, setLog] = useState<MachinePlanningLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    apiFetch<MachinePlanningLogEntry[]>(`/machine-planning-log/${encodeURIComponent(machine.id)}`)
      .then(setLog).catch(() => toast.error('Log betöltése sikertelen')).finally(() => setLoading(false))
  }, [machine.id])
  const lbl = (a: string) => a === 'assigned' ? 'Hozzárendelve' : a === 'removed' ? 'Eltávolítva' : 'Áthelyezve'
  const cls = (a: string) => a === 'assigned' ? 'bg-green-500/10 text-green-700 dark:text-green-400'
    : a === 'removed' ? 'bg-red-500/10 text-red-700 dark:text-red-400'
    : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Gépalap log</p>
          <p className="text-xs text-muted-foreground truncate">{machine.name}</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-2">
          {loading && <p className="text-xs text-muted-foreground text-center py-4">Betöltés…</p>}
          {!loading && log.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nincs bejegyzés</p>}
          {log.map(e => (
            <div key={e.id} className="rounded-md border p-2 text-xs space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls(e.action)}`}>{lbl(e.action)}</span>
                <span className="text-muted-foreground">{e.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </div>
              {e.productName && <p className="font-medium">{e.productName}</p>}
              {e.designation && <p className="text-muted-foreground">{e.designation}</p>}
              {e.customer && <p className="text-muted-foreground">{e.customer}</p>}
              {e.ownOrderNumber && <p className="text-muted-foreground">#{e.ownOrderNumber}</p>}
              {e.userName && <p className="text-muted-foreground text-[10px]">{e.userName}</p>}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProductionPlanningView({ machines, orders }: Props) {
  const [assignments, setAssignments] = useState<MachinePlanningAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDragOrderId, setActiveDragOrderId] = useState<string | null>(null)
  // payload ref: azonnal érhető el, nem vár React render-re
  const dragPayload = useRef<DragPayload | null>(null)
  const [logMachine, setLogMachine] = useState<Machine | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(loadSelectedIds)

  const orderMap = new Map(orders.map(o => [o.id, o]))
  const assignedOrderIds = new Set(assignments.map(a => a.orderId))
  const visibleMachines = machines.filter(m => selectedIds.includes(m.id))

  const loadAssignments = useCallback(async () => {
    try {
      const data = await apiFetch<MachinePlanningAssignment[]>('/machine-planning')
      setAssignments(data)
    } catch { toast.error('Betöltés sikertelen') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  function toggleMachine(id: string) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveSelectedIds(next); return next
    })
  }
  function removeMachine(id: string) {
    setSelectedIds(prev => { const next = prev.filter(x => x !== id); saveSelectedIds(next); return next })
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function startDragUnassigned(e: React.DragEvent, orderId: string) {
    const p: DragPayload = { kind: 'unassigned', orderId }
    dragPayload.current = p
    // dataTransfer KÖTELEZŐ egyes böngészőkben a drop engedélyezéséhez
    e.dataTransfer.setData(DT_KEY, JSON.stringify(p))
    e.dataTransfer.setData('text/plain', orderId) // fallback
    e.dataTransfer.effectAllowed = 'move'
    setActiveDragOrderId(orderId)
  }

  function startDragAssigned(e: React.DragEvent, a: MachinePlanningAssignment) {
    const p: DragPayload = { kind: 'assigned', assignmentId: a.id, machineId: a.machineId, orderId: a.orderId }
    dragPayload.current = p
    e.dataTransfer.setData(DT_KEY, JSON.stringify(p))
    e.dataTransfer.setData('text/plain', a.orderId)
    e.dataTransfer.effectAllowed = 'move'
    setActiveDragOrderId(a.orderId)
  }

  function endDrag() {
    dragPayload.current = null
    setActiveDragOrderId(null)
  }

  // ── Drop ──────────────────────────────────────────────────────────────────

  async function dropOnMachine(machineId: string, afterAssignmentId?: string) {
    // ref-ből olvasunk — mindig friss, nem függünk React state-től
    const p = dragPayload.current
    if (!p) return
    dragPayload.current = null
    setActiveDragOrderId(null)

    const orderId = p.orderId

    // Ugyanazon gépen belüli átrendezés
    if (p.kind === 'assigned' && p.machineId === machineId) {
      await reorder(machineId, p.assignmentId, afterAssignmentId)
      return
    }

    const machineAsgn = assignments.filter(a => a.machineId === machineId).sort((a, b) => a.position - b.position)
    let position = machineAsgn.length
    if (afterAssignmentId && afterAssignmentId !== '__top__') {
      const idx = machineAsgn.findIndex(a => a.id === afterAssignmentId)
      if (idx >= 0) position = idx + 1
    } else if (!afterAssignmentId || afterAssignmentId === '__top__') {
      position = afterAssignmentId === '__top__' ? 0 : machineAsgn.length
    }

    const order = orderMap.get(orderId)
    try {
      const created = await apiFetch<MachinePlanningAssignment>('/machine-planning', {
        method: 'POST',
        body: JSON.stringify({
          machineId, orderId, position,
          plannedHoursOverride: '',
          assignedAt: new Date().toISOString(),
          productName: order?.productName || '',
          designation: order?.designation || '',
          ownOrderNumber: order?.ownOrderNumber || '',
          customer: order?.customer || '',
        }),
      })
      setAssignments(prev => {
        const without = prev.filter(a => a.orderId !== orderId)
        const same = without.filter(a => a.machineId === machineId).sort((a, b) => a.position - b.position)
        const inserted: MachinePlanningAssignment[] = []
        let pos = 0
        for (const a of same) {
          if (pos === position) inserted.push({ ...created, position: pos++ })
          inserted.push({ ...a, position: pos++ })
        }
        if (inserted.every(x => x.id !== created.id)) inserted.push({ ...created, position: pos })
        return [...without.filter(a => a.machineId !== machineId), ...inserted]
      })
      toast.success(`Hozzárendelve: ${machines.find(m => m.id === machineId)?.name}`)
    } catch (err) {
      toast.error(`Hiba: ${err instanceof Error ? err.message : err}`)
    }
  }

  async function reorder(machineId: string, movedId: string, afterId?: string) {
    const list = assignments.filter(a => a.machineId === machineId).sort((a, b) => a.position - b.position)
    const without = list.filter(a => a.id !== movedId)
    const moved = list.find(a => a.id === movedId)
    if (!moved) return
    let at = without.length
    if (afterId === '__top__') at = 0
    else if (afterId) { const i = without.findIndex(a => a.id === afterId); if (i >= 0) at = i + 1 }
    const reordered = [...without.slice(0, at), moved, ...without.slice(at)]
    setAssignments(prev => [...prev.filter(a => a.machineId !== machineId), ...reordered.map((a, i) => ({ ...a, position: i }))])
    try {
      await apiFetch('/machine-planning/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds: reordered.map(a => a.id) }) })
    } catch { toast.error('Sorrend mentése sikertelen'); loadAssignments() }
  }

  async function removeAssignment(id: string) {
    setAssignments(prev => prev.filter(a => a.id !== id))
    try { await apiFetch(`/machine-planning/${id}`, { method: 'DELETE' }); toast.success('Eltávolítva') }
    catch { toast.error('Eltávolítás sikertelen'); loadAssignments() }
  }

  function dropOnUnassigned(e: React.DragEvent) {
    e.preventDefault()
    const p = dragPayload.current
    if (p?.kind === 'assigned') removeAssignment(p.assignmentId)
    dragPayload.current = null
    setActiveDragOrderId(null)
  }

  const unassigned = orders.filter(o => {
    if (assignedOrderIds.has(o.id) || o.status === 'Kiszállítva') return false
    if (!search) return true
    const q = search.toLowerCase()
    return [o.customer, o.productName, o.designation, o.ownOrderNumber].some(f => f?.toLowerCase().includes(q))
  })

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Betöltés…</div>

  return (
    <div className="flex gap-4 items-start">
      <div className="flex flex-col flex-1 min-w-0 gap-4">

        {/* Fejléc + gépszektor */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GearSix size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Gépek a nézetben</span>
            <span className="text-xs text-muted-foreground">({visibleMachines.length}/{machines.length})</span>
          </div>
          <MachineSelector allMachines={machines} selectedIds={selectedIds} onToggle={toggleMachine} />
        </div>

        {/* Gépkártyák — vízszintes sor, teljes szélesség */}
        {visibleMachines.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-muted-foreground">
            <GearSix size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Nincs gép kiválasztva</p>
            <p className="text-xs mt-1">Kattints a „Gép hozzáadása" gombra</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 items-start">
            {visibleMachines.map(m => (
              <MachineCard
                key={m.id}
                machine={m}
                assignments={assignments.filter(a => a.machineId === m.id)}
                orderMap={orderMap}
                activeDragOrderId={activeDragOrderId}
                onDragStartAssigned={startDragAssigned}
                onDragEnd={endDrag}
                onDrop={dropOnMachine}
                onRemoveAssignment={removeAssignment}
                onOpenLog={setLogMachine}
                onRemoveFromView={removeMachine}
              />
            ))}
          </div>
        )}

        {/* Nem hozzárendelt rendelések */}
        <div
          className={`rounded-lg border transition-colors ${activeDragOrderId && assignments.some(a => a.orderId === activeDragOrderId) ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}
          onDragOver={e => e.preventDefault()}
          onDrop={dropOnUnassigned}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Package size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold flex-1">
              Nem hozzárendelt rendelések
              <span className="ml-1 text-muted-foreground font-normal">({unassigned.length})</span>
            </h2>
            <div className="relative">
              <MagnifyingGlass size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Szűrés…" className="h-6 pl-6 text-xs w-44" />
            </div>
          </div>
          <div className="overflow-y-auto max-h-72">
            <div className="px-2 py-1.5 space-y-0.5">
              {unassigned.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-3">{search ? 'Nincs találat' : 'Minden rendelés hozzá van rendelve'}</p>
                : unassigned.map(o => (
                  <OrderRow key={o.id} order={o}
                    dragging={activeDragOrderId === o.id}
                    onDragStart={e => startDragUnassigned(e, o.id)}
                    onDragEnd={endDrag} />
                ))
              }
            </div>
          </div>
          {activeDragOrderId && assignments.some(a => a.orderId === activeDragOrderId) && (
            <div className="px-3 py-1.5 text-xs text-destructive/70 border-t text-center">
              Ide húzva eltávolítod a gépről
            </div>
          )}
        </div>
      </div>

      {/* Log panel */}
      {logMachine && (
        <div className="w-72 shrink-0 rounded-lg border overflow-hidden sticky top-4 max-h-[80vh]">
          <LogPanel machine={logMachine} onClose={() => setLogMachine(null)} />
        </div>
      )}
    </div>
  )
}
