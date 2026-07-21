/**
 * AuditLogView — Változásnapló (audit-log) megtekintő.
 *
 * A Dokumentumok fülön belüli al-fülön jelenik meg. Minden lényeges
 * adatmódosítás (rendelés / vevő / termék / gép / felhasználó / anyag /
 * műszak / selejt / készlet) auditbejegyzéseket mutat:
 *
 *   - Időpont (legújabb felül)
 *   - Entitás-típus (Rendelés / Termék / Készlet …)
 *   - Megnevezés (rendelési szám, termék neve, …)
 *   - Művelet (Létrehozás / Módosítás / Törlés / Státusz / Készlet ki/be / Korrekció …)
 *   - Megjegyzés
 *   - Részletek (összecsukható) — mező-szintű előtte / utána diff
 *
 * Szűrés: dátum-tartomány, entitás-típus, művelet, szabad-szöveges keresés.
 */
import { memo, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ClockCounterClockwise,
  MagnifyingGlass,
  CaretDown,
  CaretRight,
  ArrowRight,
  Funnel,
  X,
  Download,
} from '@phosphor-icons/react'
import type { AuditAction, AuditEntityType, AuditLogEntry } from '@/lib/types'
import {
  actionLabelFor,
  displayValue,
  entityLabelFor,
  fieldLabelFor,
} from '@/lib/auditLog'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { VIRTUAL_AUDIT_ROW_STYLE } from '@/lib/virtualRow'

interface AuditLogViewProps {
  entries: AuditLogEntry[]
}

/** Egyetlen sor (kibontható) az audit-naplóban. */
function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasChanges = (entry.changes?.length ?? 0) > 0

  // Művelethez társított színkód a Badge-en.
  const actionVariant = (() => {
    switch (entry.action) {
      case 'create':
      case 'in':
        return 'default' as const
      case 'delete':
      case 'out':
      case 'bulkDelete':
        return 'destructive' as const
      case 'update':
      case 'status':
      case 'adjustment':
      case 'bulkImport':
        return 'secondary' as const
      default:
        return 'outline' as const
    }
  })()

  const ts = (() => {
    try {
      return format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: hu })
    } catch {
      return entry.createdAt
    }
  })()

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <TableRow className="border-b" style={VIRTUAL_AUDIT_ROW_STYLE}>
          <TableCell className="font-mono text-xs whitespace-nowrap align-top py-2">
            {ts}
          </TableCell>
          <TableCell className="align-top py-2">
            <Badge variant="outline" className="font-normal">
              {entry.entityLabel || entityLabelFor(entry.entityType)}
            </Badge>
          </TableCell>
          <TableCell className="align-top py-2 max-w-[280px]">
            <div className="font-medium truncate" title={entry.entityName}>
              {entry.entityName}
            </div>
          </TableCell>
          <TableCell className="align-top py-2">
            <Badge variant={actionVariant} className="font-normal whitespace-nowrap">
              {actionLabelFor(entry.action)}
            </Badge>
          </TableCell>
          <TableCell className="align-top py-2 max-w-[320px]">
            <div className="text-sm text-muted-foreground truncate" title={entry.notes ?? ''}>
              {entry.notes || '—'}
            </div>
          </TableCell>
          <TableCell className="align-top py-2 text-xs text-muted-foreground">
            {entry.userName || entry.userId || '—'}
          </TableCell>
          <TableCell className="align-top py-2 text-right">
            {hasChanges ? (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  {open ? (
                    <CaretDown className="w-3.5 h-3.5" />
                  ) : (
                    <CaretRight className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1 text-xs">
                    {entry.changes!.length} mező
                  </span>
                </Button>
              </CollapsibleTrigger>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        </TableRow>
        {hasChanges && (
          <CollapsibleContent asChild>
            <TableRow className="bg-muted/30">
              <TableCell colSpan={7} className="py-3">
                <div className="grid gap-1.5">
                  {entry.changes!.map((c, idx) => (
                    <div
                      key={`${c.field}-${idx}`}
                      className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto_1fr] gap-2 items-start text-sm"
                    >
                      <div className="text-muted-foreground font-medium">
                        {c.label || fieldLabelFor(entry.entityType, c.field)}
                      </div>
                      <div className="font-mono text-xs bg-card border rounded px-2 py-1 break-words">
                        {displayValue(c.before)}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground self-center justify-self-center" />
                      <div className="font-mono text-xs bg-card border rounded px-2 py-1 break-words">
                        {displayValue(c.after)}
                      </div>
                    </div>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          </CollapsibleContent>
        )}
      </>
    </Collapsible>
  )
}

function AuditLogViewImpl({ entries }: AuditLogViewProps) {
  // Szűrők
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<AuditEntityType | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null
    const toTs = toDate ? new Date(toDate + 'T23:59:59').getTime() : null
    return [...entries]
      .filter((e) => {
        if (entityFilter !== 'all' && e.entityType !== entityFilter) return false
        if (actionFilter !== 'all' && e.action !== actionFilter) return false
        const ts = new Date(e.createdAt).getTime()
        if (fromTs !== null && ts < fromTs) return false
        if (toTs !== null && ts > toTs) return false
        if (q) {
          const hay = [
            e.entityLabel,
            e.entityName,
            e.notes,
            e.userName,
            e.userId,
            ...(e.changes?.map((c) => `${c.field} ${c.before} ${c.after}`) ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }, [entries, search, entityFilter, actionFilter, fromDate, toDate])

  const resetFilters = () => {
    setSearch('')
    setEntityFilter('all')
    setActionFilter('all')
    setFromDate('')
    setToDate('')
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    entityFilter !== 'all' ||
    actionFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== ''

  /** CSV-export — egyszerű letöltés a böngészőből. */
  const exportCsv = () => {
    const rows = filtered.map((e) => ({
      createdAt: e.createdAt,
      entityType: e.entityType,
      entityLabel: e.entityLabel,
      entityName: e.entityName,
      action: e.action,
      actionLabel: actionLabelFor(e.action),
      notes: e.notes ?? '',
      userId: e.userId ?? '',
      userName: e.userName ?? '',
      changes: e.changes?.map((c) => `${c.field}: ${displayValue(c.before)} → ${displayValue(c.after)}`).join(' | ') ?? '',
    }))
    const headers = Object.keys(rows[0] ?? {
      createdAt: '',
      entityType: '',
      entityLabel: '',
      entityName: '',
      action: '',
      actionLabel: '',
      notes: '',
      userId: '',
      userName: '',
      changes: '',
    })
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = String((r as Record<string, unknown>)[h] ?? '')
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
          })
          .join(',')
      ),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `valtozasnaplo-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Egyedi entitás-típusok és műveletek a szűrőkben (csak amit valóban használunk)
  const entityTypes: AuditEntityType[] = [
    'order',
    'customer',
    'product',
    'machine',
    'user',
    'material',
    'shift',
    'defect',
    'inventory',
    'tool',
  ]
  const actions: AuditAction[] = [
    'create',
    'update',
    'delete',
    'status',
    'in',
    'out',
    'adjustment',
    'bulkDelete',
    'bulkImport',
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClockCounterClockwise className="w-5 h-5" weight="duotone" />
            Változásnapló
          </h2>
          <p className="text-sm text-muted-foreground">
            Minden adatmódosítás visszakövethető. Összesen {entries.length} bejegyzés
            {hasActiveFilters && filtered.length !== entries.length
              ? ` · ${filtered.length} látható a szűrés alapján`
              : ''}
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="w-4 h-4 mr-1.5" />
            CSV export
          </Button>
        </div>
      </div>

      {/* Szűrő kártya */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap justify-between">
          <div className="flex items-center gap-2">
            <Funnel className="w-4 h-4 text-muted-foreground" weight="duotone" />
            <span className="text-sm font-medium">Szűrők</span>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="w-4 h-4 mr-1" />
              Szűrők törlése
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="audit-search" className="text-xs">
              Keresés
            </Label>
            <div className="relative">
              <MagnifyingGlass className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Név, megjegyzés, mező..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="audit-entity" className="text-xs">
              Entitás
            </Label>
            <Select
              value={entityFilter}
              onValueChange={(v) => setEntityFilter(v as AuditEntityType | 'all')}
            >
              <SelectTrigger id="audit-entity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mind</SelectItem>
                {entityTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {entityLabelFor(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="audit-action" className="text-xs">
              Művelet
            </Label>
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}
            >
              <SelectTrigger id="audit-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mind</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabelFor(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:col-span-1 sm:col-span-2">
            <div className="grid gap-1.5">
              <Label htmlFor="audit-from" className="text-xs">
                -tól
              </Label>
              <Input
                id="audit-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="audit-to" className="text-xs">
                -ig
              </Label>
              <Input
                id="audit-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Táblázat */}
      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClockCounterClockwise
              className="w-12 h-12 text-muted-foreground mx-auto mb-3"
              weight="duotone"
            />
            <h3 className="font-semibold mb-1">Nincs megjeleníthető bejegyzés</h3>
            <p className="text-sm text-muted-foreground">
              {entries.length === 0
                ? 'Még nincs változás rögzítve. A naplózás minden új módosítást automatikusan rögzít.'
                : 'A szűrési feltételeknek egy bejegyzés sem felel meg.'}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[640px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[170px]">Időpont</TableHead>
                  <TableHead className="w-[120px]">Entitás</TableHead>
                  <TableHead>Megnevezés</TableHead>
                  <TableHead className="w-[140px]">Művelet</TableHead>
                  <TableHead>Megjegyzés</TableHead>
                  <TableHead className="w-[140px]">Felhasználó</TableHead>
                  <TableHead className="w-[110px] text-right">Részletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <AuditRow key={e.id} entry={e} />
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </Card>
    </div>
  )
}

export const AuditLogView = memo(AuditLogViewImpl)
