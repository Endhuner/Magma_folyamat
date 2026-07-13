import { useMemo, useState } from 'react'
import { CaretLeft, CaretRight, Printer, X } from '@phosphor-icons/react'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { TimeInput24 } from '@/components/ui/time-input-24'
import { useAppSetting } from '@/hooks/useAppSetting'
import {
  DEFAULT_ATTENDANCE_SETTINGS, dayBreakdown, monthlySummary, weightedHours,
  type AttendanceSettings,
} from '@/lib/attendanceCalc'
import { generateId } from '@/lib/generateId'
import { DEFAULT_WORK_CALENDAR, isWorkday, type WorkCalendarSettings } from '@/lib/workCalendar'

const WEEKDAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const MONTH_FMT = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' })
const pad = (n: number) => String(n).padStart(2, '0')
const fmtH = (h: number) => h.toLocaleString('hu-HU', { maximumFractionDigits: 1 })

export default function HaviIvPage() {
  const s = useAppShell()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [workCal] = useAppSetting<WorkCalendarSettings>('work-calendar', DEFAULT_WORK_CALENDAR)
  const [attSettings] = useAppSetting<AttendanceSettings>(
    'attendance-settings', DEFAULT_ATTENDANCE_SETTINGS,
  )

  // A jelenlét alanyai az operátor szerepű felhasználók — egy ív egy operátoré
  // (mint a papír/Excel változatban), fent választóval.
  const operators = s.auth.publicUsers.filter((u) => u.role === 'operator')
  const [selectedId, setSelectedId] = useState('')
  const operator = operators.find((o) => o.id === selectedId) ?? operators[0] ?? null

  const [y, m] = month.split('-').map(Number)
  const dayCount = new Date(y, m, 0).getDate()
  const dates = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => `${month}-${pad(i + 1)}`),
    [month, dayCount],
  )
  const workday = (d: string) => isWorkday(d, workCal)

  const entryOf = (date: string) =>
    operator
      ? s.attendanceEntries.find((a) => a.employeeId === operator.id && a.date === date)
      : undefined
  const leaveOn = (date: string, status: string) =>
    operator
      ? s.leaveRequests.some((l) =>
          l.employeeId === operator.id && l.status === status &&
          l.fromDate <= date && date <= l.toDate)
      : false

  const shiftMonth = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }

  const saveTime = (date: string, field: 'inTime' | 'outTime', value: string) => {
    if (!operator) return
    const entry = entryOf(date)
    s.handleSaveAttendance({
      id: entry?.id ?? generateId(),
      employeeId: operator.id,
      date,
      inTime: field === 'inTime' ? value : entry?.inTime ?? '',
      outTime: field === 'outTime' ? value : entry?.outTime ?? '',
    })
  }

  const monthEntries = operator
    ? s.attendanceEntries.filter((a) => a.employeeId === operator.id && a.date.startsWith(month))
    : []
  const sum = monthlySummary(monthEntries, workday, attSettings)
  const leaveDaysInMonth = dates.filter((ds) => workday(ds) && leaveOn(ds, 'approved')).length

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Nyomtatásnál csak az ív látszik (álló A4, egy operátor íve). */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          [data-slot='sidebar-wrapper'] > *:not([data-slot='sidebar-inset']) { display: none !important; }
          header, .no-print { display: none !important; }
          .print-sheet { font-size: 9pt; }
          .print-sheet th, .print-sheet td { border: 0.2mm solid #999 !important; padding: 0.8mm 1.5mm !important; }
          .print-sheet input { border: none !important; box-shadow: none !important; padding: 0 !important; height: auto !important; font-size: 9pt; width: 14mm; }
          .sign-line { display: flex !important; }
        }
        .sign-line { display: none; }
      `}</style>

      <div className="flex flex-wrap items-center gap-2 no-print">
        <Select value={operator?.id ?? ''} onValueChange={setSelectedId}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Operátor…" /></SelectTrigger>
          <SelectContent>
            {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)} title="Előző hónap">
          <CaretLeft className="w-4 h-4" />
        </Button>
        <Input
          type="month" value={month} className="w-44"
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
        <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)} title="Következő hónap">
          <CaretRight className="w-4 h-4" />
        </Button>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!operator}>
          <Printer className="w-4 h-4 mr-1" /> Nyomtatás
        </Button>
      </div>

      {!operator ? (
        <p className="text-muted-foreground">
          Nincs operátor szerepű felhasználó — a Beállítások → Felhasználók oldalon vegyél fel.
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Jelenléti ív — {operator.name}
            </h2>
            <p className="text-muted-foreground">{MONTH_FMT.format(new Date(y, m - 1, 1))}</p>
          </div>
          <p className="text-xs text-muted-foreground no-print">
            Az időket közvetlenül a sorba írod. SZ = jóváhagyott szabadság, SZ? = függő kérelem.
            Pótlék: délutáni ({attSettings.afternoonStartHour}:00-tól) ×{attSettings.afternoonMultiplier},
            hétvégi/ünnep ×{attSettings.weekendMultiplier}.
          </p>

          <div className="bg-card border rounded-lg overflow-hidden print-sheet">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border px-2 py-1 w-36">Nap</th>
                  <th className="border px-2 py-1 w-32">Érkezés</th>
                  <th className="border px-2 py-1 w-32">Távozás</th>
                  <th className="border px-2 py-1 w-16 text-right">Óra</th>
                  <th className="border px-2 py-1 w-20 text-right" title="Pótlékolt óraegyenérték">Egyenért.</th>
                  <th className="border px-2 py-1">Megjegyzés</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((ds) => {
                  const d = new Date(ds)
                  const work = workday(ds)
                  const att = entryOf(ds)
                  const approved = leaveOn(ds, 'approved')
                  const pending = leaveOn(ds, 'pending')
                  const hasTimes = !!(att?.inTime && att?.outTime)
                  const b = hasTimes ? dayBreakdown(att!.inTime, att!.outTime, work, attSettings) : null
                  const rowCls = !work
                    ? 'bg-muted/50'
                    : approved
                      ? 'bg-success/10'
                      : pending ? 'bg-warning/10' : ''
                  return (
                    <tr key={ds} className={rowCls}>
                      <td className="border px-2 py-1 whitespace-nowrap">
                        <span className="font-mono">{pad(d.getDate())}.</span>{' '}
                        <span className={work ? '' : 'text-muted-foreground'}>{WEEKDAYS[d.getDay()]}</span>
                      </td>
                      {approved && work ? (
                        <td className="border px-2 py-1 text-center font-semibold text-success" colSpan={2}>
                          SZABADSÁG
                        </td>
                      ) : (
                        <>
                          <td className="border px-1 py-0.5">
                            <TimeInput24
                              className="h-8 w-full"
                              value={att?.inTime ?? ''}
                              onChange={(v) => saveTime(ds, 'inTime', v)}
                            />
                          </td>
                          <td className="border px-1 py-0.5">
                            <TimeInput24
                              className="h-8 w-full"
                              value={att?.outTime ?? ''}
                              onChange={(v) => saveTime(ds, 'outTime', v)}
                            />
                          </td>
                        </>
                      )}
                      <td className="border px-2 py-1 text-right font-mono tabular-nums">
                        {b ? fmtH(b.normal + b.afternoon + b.weekend) : ''}
                      </td>
                      <td className="border px-2 py-1 text-right font-mono tabular-nums">
                        {b ? fmtH(weightedHours(b, attSettings)) : ''}
                      </td>
                      <td className="border px-2 py-1 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between gap-1">
                          <span>
                            {pending && work && <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 mr-1">SZ?</Badge>}
                            {b && b.weekend > 0 && 'hétvégi/ünnepi'}
                            {b && b.afternoon > 0 && b.weekend === 0 && `délutáni: ${fmtH(b.afternoon)} ó`}
                          </span>
                          {att && (att.inTime || att.outTime) && (
                            <Button
                              variant="ghost" size="sm" className="h-7 px-1.5 no-print shrink-0"
                              title="Nap törlése"
                              onClick={() => s.handleDeleteAttendance(att.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-medium bg-muted/40">
                  <td className="border px-2 py-1.5">Összesen</td>
                  <td className="border px-2 py-1.5 text-xs" colSpan={2}>
                    normál {fmtH(sum.normal)} ó · délutáni {fmtH(sum.afternoon)} ó · hétvégi {fmtH(sum.weekend)} ó
                  </td>
                  <td className="border px-2 py-1.5 text-right font-mono">
                    {fmtH(sum.normal + sum.afternoon + sum.weekend)}
                  </td>
                  <td className="border px-2 py-1.5 text-right font-mono font-semibold">{fmtH(sum.weighted)}</td>
                  <td className="border px-2 py-1.5 text-xs">
                    szabadság: {leaveDaysInMonth} nap · ledolgozott: {sum.daysWorked} nap
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Aláírás-sor — csak nyomtatásban */}
          <div className="sign-line justify-between pt-10">
            <span>__________________________<br />munkavállaló</span>
            <span>__________________________<br />munkáltató</span>
          </div>
        </>
      )}
    </div>
  )
}
