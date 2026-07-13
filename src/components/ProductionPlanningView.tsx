/**
 * Gyártástervező nézet — gépek és rendelések drag & drop tervezése.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GearSix, MagnifyingGlass, ClockCountdown,
  X, List, ArrowLeft, Package, Plus,
  ArrowUp, ArrowDown, ArrowsDownUp, Eye,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useHasRole } from '@/lib/auth'
import { useAppSetting } from '@/hooks/useAppSetting'
import { subscribeSSE } from '@/lib/providers/sseClient'
import type { Order, Machine, MachinePlanningAssignment, MachinePlanningLogEntry } from '@/lib/types'

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) || ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  })
  if (res.status === 204) return undefined as unknown as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props { machines: Machine[]; orders: Order[] }

const DT_KEY = 'application/x-pp-order'

type DragPayload =
  | { kind: 'unassigned'; orderId: string }
  | { kind: 'assigned'; assignmentId: string; machineId: string; orderId: string }

type SortCol = 'ownOrderNumber' | 'customer' | 'productName' | 'amountPc' | 'requiredDate' | 'status'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDT(e: React.DragEvent): DragPayload | null {
  try { return JSON.parse(e.dataTransfer.getData(DT_KEY)) as DragPayload } catch { return null }
}

function fmtHours(h: string) { const n = parseFloat(h); return isNaN(n) || n === 0 ? null : `${n} ó` }
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

// ─── AssignedOrderRow ─────────────────────────────────────────────────────────
// Kompakt sor a gépkártyán belül

function AssignedOrderRow({ order, assignment, pos, dragging, canEdit, onDragStart, onDragEnd, onRemove }: {
  order: Order; assignment: MachinePlanningAssignment; pos: number; dragging: boolean; canEdit: boolean
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; onRemove: () => void
}) {
  const rawHours = parseFloat(assignment.plannedHoursOverride || order.plannedProductionHours || '0')
  const hrs = isNaN(rawHours) || rawHours === 0 ? null : `${rawHours} ó`
  const shifts = (!isNaN(rawHours) && rawHours > 0) ? Math.ceil(rawHours / 8) : null
  const label = [order.productName, order.designation].filter(Boolean).join(' / ')
  const qty = order.amountPc > 0 ? `${order.amountPc.toLocaleString('hu')} db` : null
  const deadline = order.requiredDate ? order.requiredDate.slice(0, 10) : null

  return (
    <div
      draggable={canEdit}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      className={`group flex items-start gap-2 rounded-md border bg-card px-2 py-2 text-xs
        select-none transition-all
        ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${dragging ? 'opacity-40' : 'hover:border-primary/50 hover:bg-accent/30'}`}
    >
      {/* Sorszám */}
      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5
        text-[10px] font-semibold text-muted-foreground">{pos}</span>
      {/* Grip ikon */}
      <span className="text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 text-base leading-none mt-0.5">⠿</span>

      {/* Fő tartalom */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {order.customer && <p className="font-medium truncate">{order.customer}</p>}
        {label && <p className="text-muted-foreground truncate">{label}</p>}
        {/* Mennyiség + határidő */}
        {(qty || deadline) && (
          <p className="text-muted-foreground/80 flex gap-2 flex-wrap">
            {qty && <span>{qty}</span>}
            {deadline && <span>határidő: {deadline}</span>}
          </p>
        )}
        {/* Műszakszám */}
        {shifts !== null && (
          <p className="text-[10px] text-muted-foreground/60">
            {hrs} → <span className="font-medium">{shifts} műszak</span>
          </p>
        )}
      </div>

      {/* Rendelésszám + törlés gomb */}
      <div className="shrink-0 flex flex-col items-end gap-1 ml-1">
        {order.ownOrderNumber && (
          <span className="font-mono text-[10px] text-muted-foreground/70">#{order.ownOrderNumber}</span>
        )}
        {/* Törlés — csak admin jogosultsággal */}
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="text-muted-foreground/50 hover:text-destructive transition-colors"
            title="Eltávolítás a gépről">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MachineCard ─────────────────────────────────────────────────────────────

function MachineCard({ machine, assignments, orderMap, activeDragOrderId, canEdit,
  onDragStartAssigned, onDragEnd, onDrop, onRemoveAssignment, onOpenLog, onRemoveFromView,
}: {
  machine: Machine; assignments: MachinePlanningAssignment[]
  orderMap: Map<string, Order>; activeDragOrderId: string | null; canEdit: boolean
  onDragStartAssigned: (e: React.DragEvent, a: MachinePlanningAssignment) => void
  onDragEnd: () => void
  onDrop: (machineId: string, afterAssignmentId: string | undefined, raw: string) => void
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
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleCardDrop(e: React.DragEvent, afterId?: string) {
    e.preventDefault()
    e.stopPropagation()
    setIsOver(false)
    setDropTarget(null)
    const raw = e.dataTransfer.getData(DT_KEY) || e.dataTransfer.getData('text/plain') || ''
    onDrop(machine.id, afterId, raw)
  }

  return (
    <Card className={`flex flex-col min-w-[300px] flex-1 transition-all
      ${isOver && isDragging && canEdit ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      onDragOver={canEdit ? e => { allowDrop(e); setIsOver(true) } : undefined}
      onDragLeave={canEdit ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setIsOver(false); setDropTarget(null) } } : undefined}
      onDrop={canEdit ? e => handleCardDrop(e) : undefined}
    >
      {/* Fotó — teljes kép, max 160px magas */}
      {machine.photoUrl && (
        <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-center justify-center"
          style={{ height: 160 }}>
          <img src={machine.photoUrl} alt={machine.name} className="w-full h-full object-contain" />
        </div>
      )}

      {/* Fejléc */}
      <CardHeader className="pb-2 pt-3 px-3 shrink-0">
        <div className="flex items-center gap-2">
          {!machine.photoUrl && (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorFor(machine.id)}`}>
              <span className="text-white text-sm font-bold">{machine.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm">{machine.name}</CardTitle>
            <div className="flex gap-2 flex-wrap mt-0.5">
              {machine.type && <span className="text-xs text-muted-foreground">{machine.type}</span>}
              {machine.capacity && <Badge variant="outline" className="text-xs px-1 py-0">{machine.capacity}</Badge>}
            </div>
          </div>
          <button onClick={() => onOpenLog(machine)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Napló"><List size={14} /></button>
          <button onClick={() => onRemoveFromView(machine.id)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            title="Eltávolítás a nézetből"><X size={14} /></button>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <ClockCountdown size={11} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {hrs > 0 ? `${hrs.toFixed(1)} óra` : 'Nincs hozzárendelés'}
          </span>
          {assignments.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">{assignments.length} rendelés</Badge>
          )}
        </div>
      </CardHeader>

      {/* Hozzárendelt rendelések — min. 120px, max. 400px, saját scroll */}
      <CardContent className="px-2 pb-3 flex-1 min-h-[120px]">
        {/* Top drop zone */}
        <div
          className={`h-1.5 rounded mb-1.5 transition-all ${dropTarget === '__top__' ? 'bg-primary/50 h-3' : ''}`}
          onDragOver={canEdit ? e => { allowDrop(e); setDropTarget('__top__') } : undefined}
          onDragLeave={canEdit ? () => setDropTarget(null) : undefined}
          onDrop={canEdit ? e => handleCardDrop(e, '__top__') : undefined}
        />

        {sorted.length === 0 ? (
          <div className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed
            min-h-[100px] text-xs text-muted-foreground transition-colors
            ${isDragging ? 'border-primary/50 bg-primary/5' : 'border-muted'}`}>
            <Package size={20} className="mb-1.5 opacity-40" />
            <span>Húzz ide rendelést</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[400px]">
            {sorted.map((asgn, idx) => {
              const order = orderMap.get(asgn.orderId)
              if (!order) return null
              return (
                <div key={asgn.id}>
                  <AssignedOrderRow
                    order={order} assignment={asgn} pos={idx + 1}
                    dragging={activeDragOrderId === asgn.orderId}
                    canEdit={canEdit}
                    onDragStart={e => onDragStartAssigned(e, asgn)}
                    onDragEnd={onDragEnd}
                    onRemove={() => onRemoveAssignment(asgn.id)}
                  />
                  <div
                    className={`h-1.5 rounded transition-all ${dropTarget === asgn.id ? 'bg-primary/50 h-3' : ''}`}
                    onDragOver={canEdit ? e => { allowDrop(e); setDropTarget(asgn.id) } : undefined}
                    onDragLeave={canEdit ? () => setDropTarget(null) : undefined}
                    onDrop={canEdit ? e => handleCardDrop(e, asgn.id) : undefined}
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

// ─── SortIcon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowsDownUp size={11} className="opacity-30" />
  return dir === 'asc' ? <ArrowUp size={11} className="text-primary" /> : <ArrowDown size={11} className="text-primary" />
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProductionPlanningView({ machines, orders }: Props) {
  const canEdit = useHasRole('admin')
  const [assignments, setAssignments] = useState<MachinePlanningAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDragOrderId, setActiveDragOrderId] = useState<string | null>(null)
  const dragPayload = useRef<DragPayload | null>(null)
  const [logMachine, setLogMachine] = useState<Machine | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds, settingLoaded] = useAppSetting<string[]>('planningSelectedMachines', [])
  const [sortCol, setSortCol] = useState<SortCol>('ownOrderNumber')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const orderMap = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders])
  // 'Elkészült' és 'Kiszállítva' rendeléseket nem jelenítjük meg a tervező nézetben
  const activeAssignments = useMemo(
    () => assignments.filter(a => {
      const s = orderMap.get(a.orderId)?.status
      return s !== 'Elkészült' && s !== 'Kiszállítva' && s !== 'Kiszállítva/Számlázva'
    }),
    [assignments, orderMap]
  )
  const assignedOrderIds = new Set(activeAssignments.map(a => a.orderId))
  const visibleMachines = machines.filter(m => selectedIds.includes(m.id))

  const loadAssignments = useCallback(async () => {
    try {
      const data = await apiFetch<MachinePlanningAssignment[]>('/machine-planning')
      setAssignments(data)
    } catch { toast.error('Betöltés sikertelen') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  // SSE: ha egy rendelés státusza változik (pl. Elkészült), frissítjük a hozzárendeléseket
  const loadRef = useRef(loadAssignments)
  loadRef.current = loadAssignments
  useEffect(() => subscribeSSE(['order'], () => loadRef.current()), [])

  function toggleMachine(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
    void setSelectedIds(next)
  }
  function removeMachine(id: string) {
    void setSelectedIds(selectedIds.filter(x => x !== id))
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function startDragUnassigned(e: React.DragEvent, orderId: string) {
    const p: DragPayload = { kind: 'unassigned', orderId }
    dragPayload.current = p
    e.dataTransfer.setData(DT_KEY, JSON.stringify(p))
    e.dataTransfer.setData('text/plain', orderId)
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

  // ── Drop — payload a dataTransfer-ből jön, nem ref-ből (megbízhatóbb) ──────

  async function dropOnMachine(machineId: string, afterAssignmentId: string | undefined, raw: string) {
    // Elsőként dataTransfer-ből, fallback a ref-ből
    let p: DragPayload | null = null
    try { if (raw) p = JSON.parse(raw) as DragPayload } catch {}
    if (!p) p = dragPayload.current
    dragPayload.current = null
    setActiveDragOrderId(null)
    if (!p) return

    const orderId = p.orderId

    // Azonos gépen belüli átrendezés
    if (p.kind === 'assigned' && p.machineId === machineId) {
      await reorder(machineId, p.assignmentId, afterAssignmentId)
      return
    }

    const machineAsgn = assignments.filter(a => a.machineId === machineId).sort((a, b) => a.position - b.position)
    let position = machineAsgn.length
    if (afterAssignmentId === '__top__') position = 0
    else if (afterAssignmentId) {
      const idx = machineAsgn.findIndex(a => a.id === afterAssignmentId)
      if (idx >= 0) position = idx + 1
    }

    const order = orderMap.get(orderId)

    // Optimista UI frissítés AZONNAL (ne várjunk az API-ra)
    const tempId = `temp-${Date.now()}`
    const tempAsgn: MachinePlanningAssignment = {
      id: tempId, machineId, orderId, position,
      plannedHoursOverride: '', assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setAssignments(prev => {
      const without = prev.filter(a => a.orderId !== orderId)
      return [...without, tempAsgn]
    })

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
      // AZONNAL lecseréljük a temp ID-t a valódi UUID-ra (nem várunk loadAssignments-re)
      setAssignments(prev => prev.map(a => a.id === tempId ? created : a))
      toast.success(`Hozzárendelve: ${machines.find(m => m.id === machineId)?.name}`)
    } catch (err) {
      // API hiba: visszaállítás
      setAssignments(prev => prev.filter(a => a.id !== tempId))
      toast.error(`Hozzárendelés sikertelen: ${err instanceof Error ? err.message : err}`)
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
    // Optimista eltávolítás azonnal (temp ID esetén is)
    setAssignments(prev => prev.filter(a => a.id !== id))
    // Temp ID-t a szerver nem ismeri — csak UI-ból töröljük, nincs API hívás
    if (id.startsWith('temp-')) return
    try {
      await apiFetch(`/machine-planning/${id}`, { method: 'DELETE' })
      toast.success('Eltávolítva')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[removeAssignment] hiba:', id, msg)
      toast.error(`Törlés sikertelen: ${msg}`, { duration: 8000 })
      void loadAssignments()
    }
  }

  function dropOnUnassigned(e: React.DragEvent) {
    e.preventDefault()
    let p: DragPayload | null = null
    try { p = parseDT(e) } catch {}
    if (!p) p = dragPayload.current
    if (p?.kind === 'assigned') removeAssignment(p.assignmentId)
    dragPayload.current = null
    setActiveDragOrderId(null)
  }

  // ── Rendezés ──────────────────────────────────────────────────────────────

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const unassigned = orders
    .filter(o => {
      if (assignedOrderIds.has(o.id) || o.status === 'Kiszállítva' || o.status === 'Kiszállítva/Számlázva' || o.status === 'Elkészült') return false
      if (!search) return true
      const q = search.toLowerCase()
      return [o.customer, o.productName, o.designation, o.ownOrderNumber].some(f => f?.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      let va: string | number = '', vb: string | number = ''
      if (sortCol === 'amountPc') { va = a.amountPc ?? 0; vb = b.amountPc ?? 0 }
      else { va = (a[sortCol] ?? '') as string; vb = (b[sortCol] ?? '') as string }
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'hu')
      return sortDir === 'asc' ? cmp : -cmp
    })

  if (loading || !settingLoaded) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Betöltés…</div>

  const isRemoveDrag = activeDragOrderId !== null && assignments.some(a => a.orderId === activeDragOrderId)

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
          {!canEdit && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs text-amber-700 dark:text-amber-400">
              <Eye size={12} />
              <span>Megfigyelő mód — módosítás nem engedélyezett</span>
            </div>
          )}
        </div>

        {/* Gépkártyák — vízszintes sor */}
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
                assignments={activeAssignments.filter(a => a.machineId === m.id)}
                orderMap={orderMap}
                activeDragOrderId={activeDragOrderId}
                canEdit={canEdit}
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

        {/* Nem hozzárendelt rendelések — táblázat */}
        <div
          className={`rounded-lg border transition-colors ${isRemoveDrag ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}
          onDragOver={e => e.preventDefault()}
          onDrop={dropOnUnassigned}
        >
          {/* Fejléc */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Package size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold flex-1">
              Nem hozzárendelt rendelések
              <span className="ml-1 text-muted-foreground font-normal">({unassigned.length})</span>
            </h2>
            <div className="relative">
              <MagnifyingGlass size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Szűrés…" className="h-7 pl-6 text-xs w-48" />
            </div>
          </div>

          {/* Táblázat fejléc */}
          <div className="grid text-xs font-medium text-muted-foreground border-b bg-muted/30 px-2"
            style={{ gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1fr 32px' }}>
            {([
              ['ownOrderNumber', 'Rendelés#'],
              ['customer', 'Ügyfél'],
              ['productName', 'Termék / Megnevezés'],
              ['amountPc', 'Mennyiség'],
              ['requiredDate', 'Határidő'],
              ['status', 'Állapot'],
            ] as [SortCol, string][]).map(([col, label]) => (
              <button key={col} onClick={() => toggleSort(col)}
                className="flex items-center gap-1 py-2 px-1 hover:text-foreground transition-colors text-left">
                {label}
                <SortIcon col={col} active={sortCol === col} dir={sortDir} />
              </button>
            ))}
            <div />
          </div>

          {/* Sorok */}
          <div className="overflow-y-auto max-h-72">
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {search ? 'Nincs találat' : 'Minden rendelés hozzá van rendelve'}
              </p>
            ) : (
              unassigned.map(order => (
                <div
                  key={order.id}
                  draggable={canEdit}
                  onDragStart={canEdit ? e => startDragUnassigned(e, order.id) : undefined}
                  onDragEnd={canEdit ? endDrag : undefined}
                  className={`grid items-center text-xs border-b last:border-0 px-2 select-none
                    transition-colors hover:bg-accent/40
                    ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                    ${activeDragOrderId === order.id ? 'opacity-40' : ''}`}
                  style={{ gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1fr 32px' }}
                >
                  <span className="py-2 px-1 font-mono truncate">{order.ownOrderNumber || '—'}</span>
                  <span className="py-2 px-1 font-medium truncate">{order.customer || '—'}</span>
                  <span className="py-2 px-1 text-muted-foreground truncate">
                    {[order.productName, order.designation].filter(Boolean).join(' / ') || '—'}
                  </span>
                  <span className="py-2 px-1 text-right">
                    {order.amountPc > 0 ? `${order.amountPc.toLocaleString('hu')} db` : '—'}
                  </span>
                  <span className="py-2 px-1 text-muted-foreground">
                    {order.requiredDate ? order.requiredDate.slice(0, 10) : '—'}
                  </span>
                  <span className="py-2 px-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{order.status}</Badge>
                  </span>
                  <span className="py-2 text-muted-foreground/30 text-base leading-none text-center">⠿</span>
                </div>
              ))
            )}
          </div>

          {isRemoveDrag && (
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
