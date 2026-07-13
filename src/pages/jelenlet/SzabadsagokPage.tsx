import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAppSetting } from '@/hooks/useAppSetting'
import {
  DEFAULT_ATTENDANCE_SETTINGS, usedLeaveWorkdays, workdaysBetween,
  type AttendanceSettings,
} from '@/lib/attendanceCalc'
import { generateId } from '@/lib/generateId'
import { DEFAULT_WORK_CALENDAR, isWorkday, type WorkCalendarSettings } from '@/lib/workCalendar'
import type { LeaveStatus } from '@/lib/types'

const STATUS_BADGE: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: 'Függőben', cls: 'bg-warning/15 text-warning border-warning/30' },
  approved: { label: 'Jóváhagyva', cls: 'bg-success/15 text-success border-success/30' },
  rejected: { label: 'Elutasítva', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
}

export default function SzabadsagokPage() {
  const s = useAppShell()
  const [workCal] = useAppSetting<WorkCalendarSettings>('work-calendar', DEFAULT_WORK_CALENDAR)
  const [attSettings] = useAppSetting<AttendanceSettings>(
    'attendance-settings', DEFAULT_ATTENDANCE_SETTINGS,
  )
  const [empId, setEmpId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')

  const isAdmin = s.auth.status === 'bypass' || s.auth.user?.role === 'admin'
  const workday = (d: string) => isWorkday(d, workCal)
  const year = new Date().getFullYear()
  // A jelenlét alanyai az operátor szerepű felhasználók. Operátorként csak
  // saját magadnak adhatsz be kérelmet; adminként bárkinek.
  const operators = s.auth.publicUsers.filter((u) => u.role === 'operator')
  const selfOnly = !isAdmin && s.auth.user?.role === 'operator'
  const selectable = selfOnly
    ? operators.filter((u) => u.id === s.auth.user?.id)
    : operators
  const empName = (id: string) =>
    s.auth.publicUsers.find((u) => u.id === id)?.name ?? '(törölt felhasználó)'

  const effectiveEmpId = selfOnly ? (s.auth.user?.id ?? '') : empId

  const previewDays = useMemo(
    () => workdaysBetween(from, to, workday),
    [from, to, workCal], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const usedOf = (id: string) =>
    usedLeaveWorkdays(
      s.leaveRequests.filter((l) => l.employeeId === id),
      year, workday,
    )

  const submit = () => {
    if (!effectiveEmpId || !from || !to) {
      toast.error('Válassz dolgozót és add meg az időszakot!')
      return
    }
    if (from > to) {
      toast.error('Az első nap nem lehet később, mint az utolsó.')
      return
    }
    const used = usedOf(effectiveEmpId)
    if (used + previewDays > attSettings.yearlyLeaveDays) {
      toast.warning(
        `Figyelem: a keret túllépne (${used} + ${previewDays} > ${attSettings.yearlyLeaveDays} nap) — a kérelem ettől még beadható és jóváhagyható.`,
      )
    }
    s.handleSaveLeave({
      id: generateId(), employeeId: effectiveEmpId, fromDate: from, toDate: to,
      note: note.trim(), status: 'pending', requestedAt: new Date().toISOString(),
    })
    setFrom(''); setTo(''); setNote('')
    toast.success('Kérelem beadva, jóváhagyásra vár.')
  }

  const decide = (id: string, status: LeaveStatus) =>
    s.handleSaveLeave({ id, status, decidedAt: new Date().toISOString().slice(0, 10) })

  const sorted = [...s.leaveRequests].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Szabadság kérelem beadása</CardTitle>
          <CardDescription>
            Éves keret: {attSettings.yearlyLeaveDays} munkanap / dolgozó ({year}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-48">
              <Label>Operátor</Label>
              {selfOnly ? (
                <div className="h-11 flex items-center px-3 rounded-md border bg-muted text-sm">
                  {s.auth.user?.name} ({usedOf(effectiveEmpId)}/{attSettings.yearlyLeaveDays} nap)
                </div>
              ) : (
                <Select value={empId} onValueChange={setEmpId}>
                  <SelectTrigger><SelectValue placeholder="Válassz…" /></SelectTrigger>
                  <SelectContent>
                    {selectable.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} ({usedOf(e.id)}/{attSettings.yearlyLeaveDays} nap)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-from">Első nap</Label>
              <Input id="l-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-to">Utolsó nap</Label>
              <Input id="l-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1 min-w-44">
              <Label htmlFor="l-note">Megjegyzés</Label>
              <Input id="l-note" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="pl. családi program" />
            </div>
            <div className="text-sm text-muted-foreground pb-2 min-w-24">
              {previewDays > 0 ? `${previewDays} munkanap` : ''}
            </div>
            <Button onClick={submit} disabled={selectable.length === 0}>Beadás</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kérelmek</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-muted-foreground">Még nincs kérelem.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dolgozó</TableHead>
                  <TableHead>Időszak</TableHead>
                  <TableHead>Munkanap</TableHead>
                  <TableHead>Megjegyzés</TableHead>
                  <TableHead>Állapot</TableHead>
                  <TableHead className="text-right">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{empName(l.employeeId)}</TableCell>
                    <TableCell className="font-mono">{l.fromDate} – {l.toDate}</TableCell>
                    <TableCell>{workdaysBetween(l.fromDate, l.toDate, workday)} nap</TableCell>
                    <TableCell className="max-w-56 truncate" title={l.note}>{l.note}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[l.status].cls}>
                        {STATUS_BADGE[l.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {isAdmin && l.status === 'pending' && (
                        <>
                          <Button size="sm" className="mr-1" onClick={() => decide(l.id, 'approved')}>
                            Jóváhagy
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => decide(l.id, 'rejected')}>
                            Elutasít
                          </Button>
                        </>
                      )}
                      {isAdmin && l.status !== 'pending' && (
                        <Button size="sm" variant="ghost"
                          onClick={() => {
                            if (window.confirm('Törlöd a kérelmet?')) s.handleDeleteLeave(l.id)
                          }}>
                          Töröl
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
