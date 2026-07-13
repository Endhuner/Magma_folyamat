import { SignIn, SignOut } from '@phosphor-icons/react'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { generateId } from '@/lib/generateId'

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const DAY_FMT = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
})

export default function KioszkPage() {
  const s = useAppShell()
  const today = todayISO()
  // A jelenlét alanyai az operátor szerepű felhasználók.
  const operators = s.auth.publicUsers.filter((u) => u.role === 'operator')

  const entryOf = (empId: string) =>
    s.attendanceEntries.find((a) => a.employeeId === empId && a.date === today)
  const onLeave = (empId: string) =>
    s.leaveRequests.some((l) =>
      l.employeeId === empId && l.status === 'approved' && l.fromDate <= today && today <= l.toDate)

  const checkIn = (empId: string) =>
    s.handleSaveAttendance({ id: generateId(), employeeId: empId, date: today, inTime: nowHHMM() })
  const checkOut = (entryId: string) =>
    s.handleSaveAttendance({ id: entryId, outTime: nowHHMM() })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{DAY_FMT.format(new Date())}</h2>
      {operators.length === 0 && (
        <p className="text-muted-foreground">
          Nincs operátor szerepű felhasználó — a Beállítások → Felhasználók oldalon vegyél fel.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {operators.map((emp) => {
          const att = entryOf(emp.id)
          const leave = onLeave(emp.id)
          return (
            <div key={emp.id} className="bg-card border rounded-lg p-4 flex flex-col gap-3">
              <div className="font-semibold text-lg">{emp.name}</div>
              {leave ? (
                <Badge variant="secondary" className="w-fit">Szabadságon</Badge>
              ) : !att ? (
                <>
                  <Badge variant="outline" className="w-fit bg-warning/10 text-warning border-warning/30">
                    Még nem érkezett
                  </Badge>
                  <Button size="lg" className="h-14 text-base" onClick={() => checkIn(emp.id)}>
                    <SignIn className="w-5 h-5 mr-2" weight="bold" /> Érkezés rögzítése
                  </Button>
                </>
              ) : !att.outTime ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-success text-success-foreground">Bent van</Badge>
                    <span className="text-muted-foreground">Érkezett: <span className="font-mono">{att.inTime}</span></span>
                  </div>
                  <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => checkOut(att.id)}>
                    <SignOut className="w-5 h-5 mr-2" weight="bold" /> Távozás rögzítése
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Végzett</Badge>
                  <span className="font-mono text-muted-foreground">{att.inTime} – {att.outTime}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
