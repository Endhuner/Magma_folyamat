import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useAppSetting } from '@/hooks/useAppSetting'
import {
  DEFAULT_WORK_CALENDAR,
  hungarianHolidays,
  type WorkCalendarSettings,
} from '@/lib/workCalendar'

interface WorkCalendarDialogProps {
  open: boolean
  onClose: () => void
}

const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: 'Hétfő' },
  { day: 2, label: 'Kedd' },
  { day: 3, label: 'Szerda' },
  { day: 4, label: 'Csütörtök' },
  { day: 5, label: 'Péntek' },
  { day: 6, label: 'Szombat' },
  { day: 0, label: 'Vasárnap' },
]

/**
 * Munkanaptár beállítás — mely hét-napok munkanapok, és figyeljük-e a magyar
 * ünnepnapokat. A műszakadat-hiány ellenőrzés (Gyártás nézet) ezt használja,
 * hogy hétvégére/ünnepre ne adjon álriasztást.
 */
export function WorkCalendarDialog({ open, onClose }: WorkCalendarDialogProps) {
  const [saved, setSetting] = useAppSetting<WorkCalendarSettings>('work-calendar', DEFAULT_WORK_CALENDAR)
  const [draft, setDraft] = useState<WorkCalendarSettings>(DEFAULT_WORK_CALENDAR)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft({ ...DEFAULT_WORK_CALENDAR, ...saved })
  }, [open, saved])

  const toggleDay = (day: number) => {
    setDraft((d) => {
      const has = d.workdays.includes(day)
      return {
        ...d,
        workdays: has ? d.workdays.filter((x) => x !== day) : [...d.workdays, day].sort(),
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setSetting(draft)
      toast.success('Munkanaptár mentve')
      onClose()
    } catch {
      toast.error('A mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  // Következő néhány ünnepnap előnézete (idei + jövő évi, a mai naptól).
  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const upcoming = [now.getFullYear(), now.getFullYear() + 1]
    .flatMap((y) => [...hungarianHolidays(y)])
    .filter((d) => d >= todayIso)
    .sort()
    .slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Munkanaptár</DialogTitle>
          <DialogDescription>
            A gyártás-nézet a munkanapokra vár műszakadatot — hétvégére és
            ünnepnapra nem jelez hiányt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium">Munkanapok</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WEEKDAYS.map(({ day, label }) => (
                <label
                  key={day}
                  className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer"
                >
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={draft.workdays.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                  />
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer">
            <span className="text-sm">Magyar ünnepnapok figyelése</span>
            <Switch
              checked={draft.observeHolidays}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, observeHolidays: v }))}
            />
          </label>

          {draft.observeHolidays && upcoming.length > 0 && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Következő ünnepnapok</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {upcoming.map((d) => (
                  <li key={d} className="font-mono">{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button onClick={handleSave} disabled={saving || draft.workdays.length === 0}>
            {saving ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
