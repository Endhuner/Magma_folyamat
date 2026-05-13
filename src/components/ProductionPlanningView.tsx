/**
 * Gyártástervező nézet — gépek és rendelések drag & drop tervezése.
 *
 * Elrendezés:
 *  - Felső rész: gépek vízszintesen lapozható kártyái; minden kártyán
 *    a hozzárendelt rendelések sorrendezhetők (drag & drop).
 *  - Alsó rész: "Nem hozzárendelt rendelések" panel — onnan lehet
 *    gépre húzni a rendeléseket.
 *  - Gépalap-log panel: egy gép kiválasztásakor megnyílik az oldalsávban.
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

/** Véletlenszerű szín a gép iniciálé-körének hátteréhez */
const COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-teal-500', 'bg-rose-500', 'bg-indigo-500', 'bg-amber-500',
]
function colorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
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
      {/* Grip */}
      <span className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0">⠿</span>

      {/* Év — csak ha van */}
      {year !== '—' && (
        <span className="text-muted-foreground shrink-0">{year}</span>
      )}

      {/* Vevő */}
      {order.customer && (
        <span className="font-medium shrink-0 max-w-[100px] truncate" title={order.customer}>
          {order.customer}
        </span>
      )}

      {/* Termék / megnevezés */}
      {productLabel && (
        <span className="text-muted-foreground truncate min-w-0 flex-1" title={productLabel}>
          {productLabel}
        </span>
      )}

      {/* Saját rendelési szám */}
      {order.ownOrderNumber && (
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">
          #{order.ownOrderNumber}
        </span>
      )}

      {/* Mennyiség — csak ha > 0 */}
      {order.amountPc > 0 && (
        <span className="shrink-0 text-right">
          {order.amountPc.toLocaleString('hu')} db
        </span>
      )}

      {/* Szükséges szállítás */}
      {order.requiredDate && (
        <span className="shrink-0 text-muted-foreground">
          {order.requiredDate.slice(0, 10)}
        </span>
      )}

      {/* Tervezett gyártási idő — csak ha van */}
      {hoursStr !== '—' && (
        <span className="shrink-0 font-mono text-primary/70">{hoursStr}</span>
      )}

      {/* Eltávolítás (csak hozzárendelt sorokban) */}
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
  dragSource: DragSource | null
  onDragStartAssigned: (a: MachinePlanningAssignment) => void
  onDragEnd: () => void
  onDrop: (machineId: string, afterAssignmentId?: string) => void
  onRemoveAssignment: (assignmentId: string) => void
  onOpenLog: (machine: Machine) => void
}

function MachineCard({
  machine, assignments, orderMap,
  dragSource, onDragStartAssigned, onDragEnd, onDrop, onRemoveAssignment, onOpenLog,
}: MachineCardProps) {
  const [dropTarget, setDropTarget] = useState<'top' | string | null>(null)
  const totalHours = parseTotalHours(assignments, orderMap)

  const sorted = [...assignments].sort((a, b) => a.position - b.position)

  function handleDragOver(e: React.DragEvent, targetId?: string) {
    if (!dragSource) return
    e.preventDefault()
    setDropTarget(targetId ?? 'top')
  }

  function handleDrop(e: React.DragEvent, afterId?: string) {
    e.preventDefault()
    setDropTarget(null)
    onDrop(machine.id, afterId)
  }

  const isDraggingFromHere =
    dragSource?.kind === 'assigned' && dragSource.machineId === machine.id

  return (
    <Card className="flex flex-col w-72 shrink-0">
      {/* Header */}
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-2">
          {/* Photo or initial */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorForId(machine.id)}`}>
            {machine.photoUrl ? (
              <img src={machine.photoUrl} alt={machine.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-white text-sm font-bold">{machine.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{machine.name}</CardTitle>
            {machine.type && (
              <p className="text-xs text-muted-foreground truncate">{machine.type}</p>
            )}
          </div>

          <button
            onClick={() => onOpenLog(machine)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Gépalap log"
          >
            <List size={14} />
          </button>
        </div>

        {/* Total hours badge */}
        <div className="flex items-center gap-1 mt-1">
          <ClockCountdown size={12} className="text-muted-foreground" />
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

      {/* Drop zone + assigned orders — belső scroll max 400px */}
      <CardContent className="px-2 pb-2 overflow-y-auto max-h-[400px]">
        {/* Top drop zone */}
        <div
          className={`h-1.5 rounded transition-all mb-1 ${
            dropTarget === 'top' ? 'bg-primary/40 h-2' : 'hover:bg-muted/50'
          }`}
          onDragOver={(e) => handleDragOver(e, 'top')}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => handleDrop(e, undefined)}
        />

        {sorted.length === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center rounded-md border-2 border-dashed
              py-6 text-center text-xs text-muted-foreground transition-colors
              ${dragSource ? 'border-primary/50 bg-primary/5' : 'border-muted'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDropTarget('top') }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => handleDrop(e, undefined)}
          >
            <Package size={20} className="mb-1 opacity-40" />
            Húzz ide rendelést
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sorted.map((assignment) => {
              const order = orderMap.get(assignment.orderId)
              if (!order) return null
              const isThisDragging =
                dragSource?.kind === 'assigned' && dragSource.assignmentId === assignment.id
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
                  {/* Drop zone after each item */}
                  <div
                    className={`h-1.5 rounded transition-all ${
                      dropTarget === assignment.id ? 'bg-primary/40 h-2' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, assignment.id)}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => handleDrop(e, assignment.id)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Always-present drop target at the bottom when dragging */}
        {isDraggingFromHere && sorted.length > 0 && (
          <div
            className="h-8 rounded border-2 border-dashed border-muted mt-1"
            onDragOver={(e) => { e.preventDefault(); setDropTarget('bottom') }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => handleDrop(e, sorted[sorted.length - 1]?.id)}
          />
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
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">Gépalap log</p>
          <p className="text-xs text-muted-foreground truncate">{machine.name}</p>
        </div>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-2">
          {loading && (
            <p className="text-xs text-muted-foreground text-center py-4">Betöltés…</p>
          )}
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
              {entry.productName && (
                <p className="font-medium">{entry.productName}</p>
              )}
              {entry.designation && (
                <p className="text-muted-foreground">{entry.designation}</p>
              )}
              {entry.customer && (
                <p className="text-muted-foreground">{entry.customer}</p>
              )}
              {entry.ownOrderNumber && (
                <p className="text-muted-foreground">Rendelés: {entry.ownOrderNumber}</p>
              )}
              {entry.fromMachineId && (
                <p className="text-muted-foreground text-[10px]">Előző gép: {entry.fromMachineId}</p>
              )}
              {entry.userName && (
                <p className="text-muted-foreground text-[10px]">Felhasználó: {entry.userName}</p>
              )}
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
  const [logMachine, setLogMachine] = useState<Machine | null>(null)
  const [unassignedSearch, setUnassignedSearch] = useState('')

  // Build lookup maps
  const orderMap = new Map(orders.map((o) => [o.id, o]))

  // Set of assigned order IDs
  const assignedOrderIds = new Set(assignments.map((a) => a.orderId))

  // Load assignments from server
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

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStartUnassigned(orderId: string) {
    setDragSource({ kind: 'unassigned', orderId })
  }

  function handleDragStartAssigned(assignment: MachinePlanningAssignment) {
    setDragSource({
      kind: 'assigned',
      assignmentId: assignment.id,
      machineId: assignment.machineId,
      orderId: assignment.orderId,
    })
  }

  function handleDragEnd() {
    setDragSource(null)
  }

  async function handleDropOnMachine(machineId: string, afterAssignmentId?: string) {
    if (!dragSource) return

    const orderId = dragSource.orderId

    // If dropped onto same machine and it's already assigned there — just reorder
    if (
      dragSource.kind === 'assigned' &&
      dragSource.machineId === machineId
    ) {
      await handleReorder(machineId, dragSource.assignmentId, afterAssignmentId)
      setDragSource(null)
      return
    }

    // Determine new position
    const machineAssignments = assignments
      .filter((a) => a.machineId === machineId)
      .sort((a, b) => a.position - b.position)

    let position = 0
    if (afterAssignmentId) {
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
      // Update local state optimistically
      setAssignments((prev) => {
        // Remove old assignment for this order (if any)
        const without = prev.filter((a) => a.orderId !== orderId)
        // Re-number positions in new machine
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

    // Optimistic UI update
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
      loadAssignments() // reload on error
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

  // ── Drop on unassigned zone (remove from machine) ──────────────────────────

  function handleDropOnUnassigned(e: React.DragEvent) {
    e.preventDefault()
    if (dragSource?.kind !== 'assigned') { setDragSource(null); return }
    handleRemoveAssignment(dragSource.assignmentId)
    setDragSource(null)
  }

  // ── Filtered unassigned orders ─────────────────────────────────────────────

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
      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 gap-4">

        {/* ── Machines row — vízszintes scroll, kártyák természetes magassággal ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GearSix size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Gépek</h2>
            <span className="text-xs text-muted-foreground">({machines.length} gép)</span>
          </div>

          {machines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-muted-foreground">
              <GearSix size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Nincsenek gépek</p>
              <p className="text-xs mt-1">Adatkezelés → Gépek menüpontban add hozzá</p>
            </div>
          ) : (
            /* overflow-x-auto: vízszintesen görgethető ha sok gép van */
            <div className="flex gap-3 overflow-x-auto pb-2 items-start">
              {machines.map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  assignments={assignments.filter((a) => a.machineId === machine.id)}
                  orderMap={orderMap}
                  dragSource={dragSource}
                  onDragStartAssigned={handleDragStartAssigned}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDropOnMachine}
                  onRemoveAssignment={handleRemoveAssignment}
                  onOpenLog={setLogMachine}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Nem hozzárendelt rendelések — közvetlenül a gépek alatt ── */}
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
                className="h-6 pl-6 text-xs w-40"
              />
            </div>
          </div>

          {/* Max 320px, saját scrollbar */}
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

      {/* ── Log side panel — sticky a viewport tetejéhez képest ── */}
      {logMachine && (
        <div className="w-72 shrink-0 rounded-lg border overflow-hidden sticky top-4">
          <LogPanel machine={logMachine} onClose={() => setLogMachine(null)} />
        </div>
      )}
    </div>
  )
}
