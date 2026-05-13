/**
 * Gyártástervező nézet — gépek és rendelések drag & drop tervezése.
 *
 * Elrendezés:
 *  - Felső sáv: gép kiválasztó (melyik gépek látszanak)
 *  - Gépkártyák: egymás alatt, teljes szélességű
 *  - Alul: "Nem hozzárendelt rendelések" panel
 *  - Oldalsáv: gépalap-log
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GearSix,
  MagnifyingGlass,
  ClockCountdown,
  X,
  List,
  ArrowLeft,
  Package,
  Plus,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Order, Machine, MachinePlanningAssignment, MachinePlanningLogEntry } from '@/lib/types'

// ─── API helpers ─────────────────────────────────────────────────────────────

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

interface Props {
  machines: Machine[]
  orders: Order[]
}

type DragSource =
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

function getYear(order: Order): string {
  const d = order.orderDate || order.createdAt || ''
  return d.slice(0, 4) || '—'
}

function formatHours(hoursStr: string): string {
  const n = parseFloat(hoursStr)
  if (isNaN(n) || n === 0) return '—'
  return `${n} ó`
}

function parseTotalHours(assignments: MachinePlanningAssignment[], orderMap: Map<string, Order>): number {
  return assignments.reduce((sum, a) => {
    const hrs = a.plannedHoursOverride
      ? parseFloat(a.plannedHoursOverride)
      : parseFloat(orderMap.get(a.orderId)?.plannedProductionHours || '0')
    return sum + (isNaN(hrs) ? 0 : hrs)
  }, 0)
}

const COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-teal-500', 'bg-rose-500', 'bg-indigo-500', 'bg-amber-500',
]
function colorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

// ─── Machine selector ─────────────────────────────────────────────────────────

interface MachineSelectorProps {
  allMachines: Machine[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

function MachineSelector({ allMachines, selectedIds, onToggle }: MachineSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const unselected = allMachines.filter((m) => !selectedIds.includes(m.id))

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <Plus size={14} />
        Gép hozzáadása
      </Button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border bg-popover shadow-lg p-1">
          {unselected.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-2 text-center">
              Minden gép megjelenik a nézetben
            </p>
          ) : (
            unselected.map((m) => (
              <button
                key={m.id}
                onClick={() => { onToggle(m.id); setOpen(false) }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${colorForId(m.id)}`}>
                  {m.photoUrl
                    ? <img src={m.photoUrl} alt={m.name} className="w-6 h-6 rounded-full object-cover" />
                    : <span className="text-white text-xs font-bold">{m.name.charAt(0).toUpperCase()}</span>
                  }
                </div>
                <span className="truncate">{m.name}</span>
                {m.type && <span className="text-xs text-muted-foreground shrink-0">{m.type}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Order row (compact) ──────────────────────────────────────────────────────

interface OrderRowProps {
  order: Order
  assignment?: MachinePlanningAssignment
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onRemove?: () => void
}

function OrderRow({ order, assignment, dragging, onDragStart, onDragEnd, onRemove }: OrderRowProps) {
  const hours = assignment?.plannedHoursOverride || order.plannedProductionHours
  const hoursStr = formatHours(hours)
  const year = getYear(order)
  const productLabel = [order.productName, order.designation].filter(Boolean).join(' / ')

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        group flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border bg-card
        px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none transition-opacity
        ${dragging ? 'opacity-40' : 'hover:border-primary/50 hover:shadow-sm'}
      `}
    >
      <span className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0">⠿</span>
      {year !== '—' && <span className="text-muted-foreground shrink-0">{year}</span>}
      {order.customer && (
        <span className="font-medium shrink-0 max-w-[120px] truncate" title={order.customer}>
          {order.customer}
        </span>
      )}
      {productLabel && (
        <span className="text-muted-foreground truncate min-w-0 flex-1" title={productLabel}>
          {productLabel}
        </span>
      )}
      {order.ownOrderNumber && (
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">
          #{order.ownOrderNumber}
        </span>
      )}
      {order.amountPc > 0 && (
        <span className="shrink-0">{order.amountPc.toLocaleString('hu')} db</span>
      )}
      {order.requiredDate && (
        <span className="shrink-0 text-muted-foreground">{order.requiredDate.slice(0, 10)}</span>
      )}
      {hoursStr !== '—' && (
        <span className="shrink-0 font-mono text-primary/70">{hoursStr}</span>
      )}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          title="Eltávolítás a gépről"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Machine card ─────────────────────────────────────────────────────────────

interface MachineCardProps {
  machine: Machine
  assignments: MachinePlanningAssignment[]
  orderMap: Map<string, Order>
  isDragging: boolean
  onDragStartAssigned: (a: MachinePlanningAssignment) => void
  onDragEnd: () => void
  onDrop: (machineId: string, afterAssignmentId?: string) => void
  onRemoveAssignment: (assignmentId: string) => void
  onOpenLog: (machine: Machine) => void
  onRemoveFromView: (machineId: string) => void
  dragOrderId: string | null
}

function MachineCard({
  machine, assignments, orderMap,
  isDragging, onDragStartAssigned, onDragEnd, onDrop, onRemoveAssignment,
  onOpenLog, onRemoveFromView, dragOrderId,
}: MachineCardProps) {
  const [dropTarget, setDropTarget] = useState<'top' | string | null>(null)
  const [isOver, setIsOver] = useState(false)
  const totalHours = parseTotalHours(assignments, orderMap)
  const sorted = [...assignments].sort((a, b) => a.position - b.position)

  // Mindig engedjük a drop-ot — ne blokkolja a dragSource state késése
  function handleDragOver(e: React.DragEvent, targetId?: string) {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(targetId ?? 'top')
    setIsOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // csak ha tényleg elhagyjuk a kártyát (nem csak egy belső elemre lépünk)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null)
      setIsOver(false)
    }
  }

  function handleDrop(e: React.DragEvent, afterId?: string) {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setIsOver(false)
    onDrop(machine.id, afterId)
  }

  return (
    <Card
      className={`w-full transition-colors ${isOver && isDragging ? 'ring-2 ring-primary/50' : ''}`}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, undefined)}
    >
      {/* Nagy fotó banner */}
      {machine.photoUrl && (
        <div className="w-full h-48 overflow-hidden rounded-t-lg">
          <img
            src={machine.photoUrl}
            alt={machine.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-3">
          {/* Iniciálé kör — csak ha nincs fotó */}
          {!machine.photoUrl && (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorForId(machine.id)}`}>
              <span className="text-white text-base font-bold">
                {machine.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{machine.name}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {machine.type && (
                <span className="text-xs text-muted-foreground">{machine.type}</span>
              )}
              {machine.capacity && (
                <Badge variant="outline" className="text-xs">{machine.capacity}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onOpenLog(machine)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Gépalap log"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => onRemoveFromView(machine.id)}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Eltávolítás a nézetből"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Összesítő */}
        <div className="flex items-center gap-2 mt-2">
          <ClockCountdown size={13} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {totalHours > 0 ? `${totalHours.toFixed(1)} óra összesen` : 'Nincs hozzárendelés'}
          </span>
          {assignments.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
              {assignments.length} rendelés
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* Drop zone + hozzárendelt rendelések */}
      <CardContent className="px-3 pb-3">
        {/* Top drop zone */}
        <div
          className={`h-1.5 rounded transition-all mb-1 ${dropTarget === 'top' ? 'bg-primary/40 h-2' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'top')}
          onDrop={(e) => handleDrop(e, undefined)}
        />

        {sorted.length === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center rounded-md border-2 border-dashed
              py-8 text-center text-sm text-muted-foreground transition-colors
              ${isDragging ? 'border-primary/60 bg-primary/5' : 'border-muted'}
            `}
          >
            <Package size={24} className="mb-2 opacity-40" />
            Húzz ide rendelést az alábbi listából
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sorted.map((assignment) => {
              const order = orderMap.get(assignment.orderId)
              if (!order) return null
              const isThisDragging =
                dragOrderId === assignment.orderId
              return (
                <div key={assignment.id}>
                  <OrderRow
                    order={order}
                    assignment={assignment}
                    dragging={isThisDragging}
                    onDragStart={() => onDragStartAssigned(assignment)}
                    onDragEnd={onDragEnd}
                    onRemove={() => onRemoveAssignment(assignment.id)}
                  />
                  <div
                    className={`h-1.5 rounded transition-all ${dropTarget === assignment.id ? 'bg-primary/40 h-2' : ''}`}
                    onDragOver={(e) => handleDragOver(e, assignment.id)}
                    onDrop={(e) => handleDrop(e, assignment.id)}
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

// ─── Log panel ────────────────────────────────────────────────────────────────

interface LogPanelProps {
  machine: Machine
  onClose: () => void
}

function LogPanel({ machine, onClose }: LogPanelProps) {
  const [log, setLog] = useState<MachinePlanningLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch<MachinePlanningLogEntry[]>(`/machine-planning-log/${encodeURIComponent(machine.id)}`)
      .then(setLog)
      .catch(() => toast.error('Gépalap log betöltése sikertelen'))
      .finally(() => setLoading(false))
  }, [machine.id])

  const actionLabel = (action: string) => {
    if (action === 'assigned') return 'Hozzárendelve'
    if (action === 'removed') return 'Eltávolítva'
    if (action === 'moved') return 'Áthelyezve'
    return action
  }

  const actionColor = (action: string) => {
    if (action === 'assigned') return 'bg-green-500/10 text-green-700 dark:text-green-400'
    if (action === 'removed') return 'bg-red-500/10 text-red-700 dark:text-red-400'
    if (action === 'moved') return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
    return 'bg-muted text-muted-foreground'
  }

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">Gépalap log</p>
          <p className="text-xs text-muted-foreground truncate">{machine.name}</p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-2">
          {loading && <p className="text-xs text-muted-foreground text-center py-4">Betöltés…</p>}
          {!loading && log.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nincs log bejegyzés</p>
          )}
          {log.map((entry) => (
            <div key={entry.id} className="rounded-md border p-2 text-xs space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${actionColor(entry.action)}`}>
                  {actionLabel(entry.action)}
                </span>
                <span className="text-muted-foreground">{entry.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </div>
              {entry.productName && <p className="font-medium">{entry.productName}</p>}
              {entry.designation && <p className="text-muted-foreground">{entry.designation}</p>}
              {entry.customer && <p className="text-muted-foreground">{entry.customer}</p>}
              {entry.ownOrderNumber && <p className="text-muted-foreground">Rendelés: {entry.ownOrderNumber}</p>}
              {entry.userName && <p className="text-muted-foreground text-[10px]">Felhasználó: {entry.userName}</p>}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductionPlanningView({ machines, orders }: Props) {
  const [assignments, setAssignments] = useState<MachinePlanningAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [dragSource, setDragSource] = useState<DragSource | null>(null)
  // Ref a drag source-hoz — drag events előtt frissül, state-nél megbízhatóbb
  const dragSourceRef = useRef<DragSource | null>(null)
  const [logMachine, setLogMachine] = useState<Machine | null>(null)
  const [unassignedSearch, setUnassignedSearch] = useState('')
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>(loadSelectedIds)

  const orderMap = new Map(orders.map((o) => [o.id, o]))
  const assignedOrderIds = new Set(assignments.map((a) => a.orderId))

  // Csak a kiválasztott és létező gépek
  const visibleMachines = machines.filter((m) => selectedMachineIds.includes(m.id))

  // Betöltés
  const loadAssignments = useCallback(async () => {
    try {
      const data = await apiFetch<MachinePlanningAssignment[]>('/machine-planning')
      setAssignments(data)
    } catch {
      toast.error('Hozzárendelések betöltése sikertelen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  // Gép ki/be kapcsolása a nézetben
  function toggleMachine(id: string) {
    setSelectedMachineIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveSelectedIds(next)
      return next
    })
  }

  function removeMachineFromView(id: string) {
    setSelectedMachineIds((prev) => {
      const next = prev.filter((x) => x !== id)
      saveSelectedIds(next)
      return next
    })
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStartUnassigned(orderId: string) {
    const src: DragSource = { kind: 'unassigned', orderId }
    dragSourceRef.current = src
    setDragSource(src)
  }

  function handleDragStartAssigned(assignment: MachinePlanningAssignment) {
    const src: DragSource = {
      kind: 'assigned',
      assignmentId: assignment.id,
      machineId: assignment.machineId,
      orderId: assignment.orderId,
    }
    dragSourceRef.current = src
    setDragSource(src)
  }

  function handleDragEnd() {
    dragSourceRef.current = null
    setDragSource(null)
  }

  async function handleDropOnMachine(machineId: string, afterAssignmentId?: string) {
    const src = dragSourceRef.current
    if (!src) return

    const orderId = src.orderId

    if (src.kind === 'assigned' && src.machineId === machineId) {
      await handleReorder(machineId, src.assignmentId, afterAssignmentId)
      dragSourceRef.current = null
      setDragSource(null)
      return
    }

    const machineAssignments = assignments
      .filter((a) => a.machineId === machineId)
      .sort((a, b) => a.position - b.position)

    let position = 0
    if (afterAssignmentId && afterAssignmentId !== 'top') {
      const idx = machineAssignments.findIndex((a) => a.id === afterAssignmentId)
      position = idx >= 0 ? idx + 1 : machineAssignments.length
    }

    const order = orderMap.get(orderId)

    try {
      const newAssignment = await apiFetch<MachinePlanningAssignment>('/machine-planning', {
        method: 'POST',
        body: JSON.stringify({
          machineId,
          orderId,
          position,
          plannedHoursOverride: '',
          assignedAt: new Date().toISOString(),
          productName: order?.productName || '',
          designation: order?.designation || '',
          ownOrderNumber: order?.ownOrderNumber || '',
          customer: order?.customer || '',
        }),
      })
      setAssignments((prev) => {
        const without = prev.filter((a) => a.orderId !== orderId)
        const sameMachine = without
          .filter((a) => a.machineId === machineId)
          .sort((a, b) => a.position - b.position)
        const inserted: MachinePlanningAssignment[] = []
        let pos = 0
        for (const a of sameMachine) {
          if (pos === position) { inserted.push({ ...newAssignment, position: pos++ }) }
          inserted.push({ ...a, position: pos++ })
        }
        if (pos === position || sameMachine.length === 0) {
          inserted.push({ ...newAssignment, position: pos })
        }
        return [...without.filter((a) => a.machineId !== machineId), ...inserted]
      })
      toast.success(`Rendelés hozzárendelve: ${machines.find((m) => m.id === machineId)?.name}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ismeretlen hiba'
      toast.error(`Hozzárendelés sikertelen: ${msg}`)
    }
    dragSourceRef.current = null
    setDragSource(null)
  }

  async function handleReorder(machineId: string, movedId: string, afterId?: string) {
    const machineAssignments = assignments
      .filter((a) => a.machineId === machineId)
      .sort((a, b) => a.position - b.position)

    const without = machineAssignments.filter((a) => a.id !== movedId)
    const moved = machineAssignments.find((a) => a.id === movedId)
    if (!moved) return

    let insertAt = without.length
    if (afterId && afterId !== 'top') {
      const idx = without.findIndex((a) => a.id === afterId)
      if (idx >= 0) insertAt = idx + 1
    } else if (afterId === 'top') {
      insertAt = 0
    }

    const reordered = [...without.slice(0, insertAt), moved, ...without.slice(insertAt)]
    const orderedIds = reordered.map((a) => a.id)

    setAssignments((prev) => {
      const others = prev.filter((a) => a.machineId !== machineId)
      return [...others, ...reordered.map((a, i) => ({ ...a, position: i }))]
    })

    try {
      await apiFetch('/machine-planning/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      })
    } catch {
      toast.error('Sorrend mentése sikertelen')
      loadAssignments()
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
    try {
      await apiFetch(`/machine-planning/${assignmentId}`, { method: 'DELETE' })
      toast.success('Rendelés eltávolítva')
    } catch {
      toast.error('Eltávolítás sikertelen')
      loadAssignments()
    }
  }

  function handleDropOnUnassigned(e: React.DragEvent) {
    e.preventDefault()
    const src = dragSourceRef.current
    if (src?.kind !== 'assigned') { dragSourceRef.current = null; setDragSource(null); return }
    handleRemoveAssignment(src.assignmentId)
    dragSourceRef.current = null
    setDragSource(null)
  }

  // ── Szűrt nem-hozzárendelt rendelések ─────────────────────────────────────

  const unassignedOrders = orders.filter((o) => {
    if (assignedOrderIds.has(o.id)) return false
    if (o.status === 'Kiszállítva') return false
    if (!unassignedSearch) return true
    const q = unassignedSearch.toLowerCase()
    return (
      o.customer.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q) ||
      o.designation.toLowerCase().includes(q) ||
      o.ownOrderNumber.toLowerCase().includes(q)
    )
  })

  const isDragging = dragSourceRef.current !== null || dragSource !== null
  const dragOrderId = dragSource?.orderId ?? null

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">Betöltés…</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 items-start">
      {/* ── Fő terület ── */}
      <div className="flex flex-col flex-1 min-w-0 gap-4">

        {/* ── Gép-szektor fejléc ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GearSix size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Gépek a nézetben</h2>
            <span className="text-xs text-muted-foreground">({visibleMachines.length} / {machines.length})</span>
          </div>
          <MachineSelector
            allMachines={machines}
            selectedIds={selectedMachineIds}
            onToggle={toggleMachine}
          />
        </div>

        {/* ── Gépkártyák — egymás alatt, teljes szélesség ── */}
        {visibleMachines.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-muted-foreground">
            <GearSix size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Nincs gép kiválasztva</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Kattints a „Gép hozzáadása" gombra, és válaszd ki, melyik gépekre szeretnél tervezni.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleMachines.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                assignments={assignments.filter((a) => a.machineId === machine.id)}
                orderMap={orderMap}
                isDragging={isDragging}
                onDragStartAssigned={handleDragStartAssigned}
                onDragEnd={handleDragEnd}
                onDrop={handleDropOnMachine}
                onRemoveAssignment={handleRemoveAssignment}
                onOpenLog={setLogMachine}
                onRemoveFromView={removeMachineFromView}
                dragOrderId={dragOrderId}
              />
            ))}
          </div>
        )}

        {/* ── Nem hozzárendelt rendelések ── */}
        <div
          className={`rounded-lg border transition-colors ${
            dragSource?.kind === 'assigned' ? 'border-destructive/40 bg-destructive/5' : 'border-border'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnUnassigned}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Package size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold flex-1">
              Nem hozzárendelt rendelések
              <span className="ml-1 text-muted-foreground font-normal">({unassignedOrders.length})</span>
            </h2>
            <div className="relative">
              <MagnifyingGlass size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={unassignedSearch}
                onChange={(e) => setUnassignedSearch(e.target.value)}
                placeholder="Szűrés…"
                className="h-6 pl-6 text-xs w-44"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            <div className="px-2 py-1.5 space-y-0.5">
              {unassignedOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {unassignedSearch ? 'Nincs találat' : 'Minden rendelés hozzá van rendelve'}
                </p>
              ) : (
                unassignedOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    dragging={dragSource?.kind === 'unassigned' && dragSource.orderId === order.id}
                    onDragStart={() => handleDragStartUnassigned(order.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))
              )}
            </div>
          </div>

          {dragSource?.kind === 'assigned' && (
            <div className="px-3 py-1.5 text-xs text-destructive/70 border-t text-center">
              Ide húzva eltávolítod a gépről
            </div>
          )}
        </div>
      </div>

      {/* ── Log oldalsáv ── */}
      {logMachine && (
        <div className="w-72 shrink-0 rounded-lg border overflow-hidden sticky top-4 max-h-[80vh]">
          <LogPanel machine={logMachine} onClose={() => setLogMachine(null)} />
        </div>
      )}
    </div>
  )
}
