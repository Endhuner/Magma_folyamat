/**
 * IssueDateDialog — dátumválasztó a szállítólevél / CMR kiállítás előtt.
 *
 * Alapértelmezés: mai nap. A felhasználó tetszőleges dátumot választhat.
 */
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CalendarBlank } from '@phosphor-icons/react'

interface IssueDateDialogProps {
  open: boolean
  type: 'delivery' | 'cmr'
  onConfirm: (issueDate: string) => void
  onClose: () => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function IssueDateDialog({ open, type, onConfirm, onClose }: IssueDateDialogProps) {
  const [issueDate, setIssueDate] = useState(todayIso())

  useEffect(() => {
    if (open) setIssueDate(todayIso())
  }, [open])

  const label = type === 'cmr' ? 'CMR' : 'Szállítólevél'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarBlank className="w-5 h-5" />
            {label} kiállítás dátuma
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="issue-date">Kiállítás dátuma</Label>
          <Input
            id="issue-date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Ez a dátum kerül a dokumentumra a{' '}
            <code className="bg-muted px-1 rounded">{'{{issueDate}}'}</code> és{' '}
            <code className="bg-muted px-1 rounded">{'{{deliveryDate}}'}</code> helyére.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Mégsem</Button>
          <Button
            onClick={() => { if (issueDate) onConfirm(issueDate) }}
            disabled={!issueDate}
          >
            Generálás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
