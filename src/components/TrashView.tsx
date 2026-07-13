import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowCounterClockwise, Trash, TrashSimple, ArrowClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface TrashItem {
  id: string
  entityType: string
  entityId: string
  entityLabel: string
  entityName: string
  deletedByName: string
  deletedAt: string
}

const RETENTION_DAYS = 30

function daysLeft(deletedAt: string): number {
  const gone = Date.now() - new Date(deletedAt).getTime()
  return Math.max(0, RETENTION_DAYS - Math.floor(gone / (1000 * 60 * 60 * 24)))
}

/**
 * Lomtár nézet — a törölt tételek 30 napig visszaállíthatók. A visszaállítás
 * SSE-t vált ki, így az érintett lista magától frissül a háttérben.
 */
export function TrashView() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/trash', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setItems(await res.json())
    } catch (err) {
      console.error('[trash] betöltés hiba:', err)
      toast.error('A lomtár betöltése sikertelen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (item: TrashItem) => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/v1/trash/${item.id}/restore`, { method: 'POST', credentials: 'include' })
      if (res.status === 409) { toast.error('Ez az azonosító már létezik — nem állítható vissza'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Visszaállítva: ${item.entityName || item.entityLabel}`)
      setItems((cur) => cur.filter((x) => x.id !== item.id))
    } catch (err) {
      console.error('[trash] visszaállítás hiba:', err)
      toast.error('A visszaállítás sikertelen')
    } finally {
      setBusyId(null)
    }
  }

  const purge = async (item: TrashItem) => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/v1/trash/${item.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      toast.success('Véglegesen törölve')
      setItems((cur) => cur.filter((x) => x.id !== item.id))
    } catch (err) {
      console.error('[trash] végleges törlés hiba:', err)
      toast.error('A törlés sikertelen')
    } finally {
      setBusyId(null)
    }
  }

  const emptyAll = async () => {
    if (!confirm('Biztosan véglegesen törlöd a teljes lomtárat? Ez nem visszavonható.')) return
    try {
      const res = await fetch('/api/v1/trash', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('A lomtár kiürítve')
      setItems([])
    } catch (err) {
      console.error('[trash] ürítés hiba:', err)
      toast.error('A lomtár ürítése sikertelen')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lomtár</h2>
          <p className="text-sm text-muted-foreground">
            A törölt tételek {RETENTION_DAYS} napig visszaállíthatók, utána a rendszer véglegesen törli őket.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <ArrowClockwise className="w-4 h-4" /> Frissítés
          </Button>
          {items.length > 0 && (
            <Button variant="destructive" size="sm" onClick={emptyAll} className="gap-2">
              <TrashSimple className="w-4 h-4" /> Lomtár ürítése
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Betöltés…</Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <TrashSimple className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="duotone" />
          <h3 className="text-lg font-semibold mb-2">A lomtár üres</h3>
          <p className="text-muted-foreground">A törölt tételek itt jelennek meg, és 30 napig visszaállíthatók.</p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Típus</TableHead>
                <TableHead>Megnevezés</TableHead>
                <TableHead>Törölte</TableHead>
                <TableHead>Törlés ideje</TableHead>
                <TableHead className="text-right">Hátralévő</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const left = daysLeft(item.deletedAt)
                return (
                  <TableRow key={item.id} className="even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]">
                    <TableCell><Badge variant="outline">{item.entityLabel || item.entityType}</Badge></TableCell>
                    <TableCell className="font-medium">{item.entityName || item.entityId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.deletedByName || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => { try { return format(new Date(item.deletedAt), 'yyyy. MM. dd. HH:mm', { locale: hu }) } catch { return item.deletedAt } })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={left <= 3 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                        {left} nap
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm" variant="outline" className="gap-1"
                          disabled={busyId === item.id}
                          onClick={() => restore(item)}
                          title="Visszaállítás"
                        >
                          <ArrowCounterClockwise className="w-4 h-4" /> Visszaállít
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          disabled={busyId === item.id}
                          onClick={() => purge(item)}
                          title="Végleges törlés"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
