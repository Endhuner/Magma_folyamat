/**
 * MachinePlanningListView
 * ─────────────────────────────────────────────────────────────────────────────
 * Megjeleníti az összes géphez rendelt rendelést/terméket egy kereshető,
 * szűrhető táblázatban. A "Gépek" tab "Tervezett munkák" alfülén jelenik meg.
 */

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { Machine, Order, MachinePlanningAssignment } from '@/lib/types'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

interface Props {
  machines: Machine[]
  orders: Order[]
}

export function MachinePlanningListView({ machines, orders }: Props) {
  const [assignments, setAssignments] = useState<MachinePlanningAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [machineFilter, setMachineFilter] = useState<string>('all')

  // Betöltés
  useEffect(() => {
    setLoading(true)
    apiFetch<{ assignments: MachinePlanningAssignment[] }>('/machine-planning')
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false))
  }, [])

  // Segédleképezések
  const machineMap = useMemo(
    () => new Map(machines.map((m) => [m.id, m])),
    [machines],
  )
  const orderMap = useMemo(
    () => new Map(orders.map((o) => [o.id, o])),
    [orders],
  )

  // Szűrés + keresés
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assignments
      .filter((a) => machineFilter === 'all' || a.machineId === machineFilter)
      .filter((a) => {
        if (!q) return true
        const o = orderMap.get(a.orderId)
        const m = machineMap.get(a.machineId)
        const haystack = [
          o?.productName,
          o?.designation,
          o?.ownOrderNumber,
          o?.orderNumber,
          o?.customer,
          m?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => {
        // gépenként, azon belül pozíció szerint
        if (a.machineId !== b.machineId) {
          const ma = machineMap.get(a.machineId)?.name ?? ''
          const mb = machineMap.get(b.machineId)?.name ?? ''
          return ma.localeCompare(mb, 'hu')
        }
        return a.position - b.position
      })
  }, [assignments, machineFilter, search, machineMap, orderMap])

  // Gépek amikhez van bejegyzés (szűrő listához)
  const usedMachines = useMemo(() => {
    const ids = new Set(assignments.map((a) => a.machineId))
    return machines.filter((m) => ids.has(m.id))
  }, [assignments, machines])

  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div>
        <h2 className="text-lg font-semibold">Tervezett munkák</h2>
        <p className="text-sm text-muted-foreground">
          Gépekhez rendelt rendelések — keresés és szűrés
        </p>
      </div>

      {/* Szűrősáv */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Keresés terméknév, rendelésszám, ügyfél alapján…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={machineFilter} onValueChange={setMachineFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Összes gép" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes gép</SelectItem>
            {usedMachines.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Táblázat */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Betöltés…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {assignments.length === 0
            ? 'Még nincs tervezett munka. Rendeld hozzá a rendeléseket a Gy. tervezés nézetben.'
            : 'Nincs a keresési feltételnek megfelelő bejegyzés.'}
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Gép</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Saját rendelésszám
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Terméknév
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Megnevezés
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ügyfél</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Pozíció
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, idx) => {
                const machine = machineMap.get(a.machineId)
                const order = orderMap.get(a.orderId)
                return (
                  <tr
                    key={a.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {machine ? (
                        <span>{machine.name}</span>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          ismeretlen
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {order?.ownOrderNumber || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{order?.productName || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {order?.designation || '—'}
                    </td>
                    <td className="px-3 py-2">{order?.customer || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="secondary" className="text-xs">
                        {a.position + 1}.
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-muted-foreground border-t">
            {rows.length} bejegyzés
            {assignments.length !== rows.length && ` (összesen: ${assignments.length})`}
          </div>
        </div>
      )}
    </div>
  )
}
