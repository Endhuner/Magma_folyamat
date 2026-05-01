import { useMemo, useState } from 'react'
import type { MissingShift } from '@/lib/shiftValidation'
import { shiftLabel } from '@/lib/shiftValidation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Warning, X, CaretUp, CaretDown } from '@phosphor-icons/react'
import { useKV } from '@/hooks/useKV'

interface ShiftValidationBannerProps {
  missing: MissingShift[]
  /** Bannerből kattintott hiány → QuickShiftEntryDialog. */
  onQuickEntry: (m: MissingShift) => void
}

/**
 * Figyelmeztető banner a Gyártás fül tetején. Csak akkor jelenik meg, ha van hiányzó
 * műszak, és a felhasználó korábban nem csukta be. A rejtés a kv-ben perzisztál,
 * ezért tab/böngésző újratöltése után is elrejtve marad — addig, amíg új hiány nem születik.
 */
export function ShiftValidationBanner({ missing, onQuickEntry }: ShiftValidationBannerProps) {
  // „Rejtett" állapotot pillanatkép-szignatúrával tároljuk — ha új hiány jön, a banner újra előjön.
  const [hiddenSig, setHiddenSig] = useKV<string>('production-shift-banner-hidden', '')
  const [collapsed, setCollapsed] = useState(false)

  // A szignatúra a hiányok összefűzött kulcsa. Új / megszűnt hiányok új szignatúrát eredményeznek.
  const signature = useMemo(() => {
    return missing.map((m) => `${m.orderId}|${m.date}|${m.shift}`).join(';')
  }, [missing])

  if (missing.length === 0) return null
  if (signature === hiddenSig) return null

  // Csoportosítás rendelésenként — átláthatóbb megjelenítés.
  const byOrder = new Map<string, MissingShift[]>()
  for (const m of missing) {
    const list = byOrder.get(m.orderId) ?? []
    list.push(m)
    byOrder.set(m.orderId, list)
  }

  return (
    <div
      className="relative border border-warning/40 bg-warning/10 rounded-lg overflow-hidden animate-in slide-in-from-top-2 duration-300"
      role="alert"
    >
      <div className="flex items-center gap-3 p-3">
        <Warning className="w-5 h-5 text-warning shrink-0" weight="fill" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            Hiányzó műszakadatok az elmúlt 7 napban
          </div>
          <div className="text-xs text-muted-foreground">
            {missing.length} bejegyzés pótolható — kattints rá a gyors rögzítéshez.
          </div>
        </div>
        <Badge variant="outline" className="border-warning/60 text-warning-foreground bg-warning/20">
          {missing.length}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Lista kibontása' : 'Lista összecsukása'}
        >
          {collapsed ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setHiddenSig(signature)}
          aria-label="Elrejtés"
          title="Elrejtés — új hiány esetén újra megjelenik"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {!collapsed && (
        <ScrollArea className="max-h-[200px] border-t border-warning/30 bg-background/40">
          <div className="p-2 space-y-1">
            {Array.from(byOrder.entries()).map(([orderId, items]) => (
              <div key={orderId} className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground px-2 pt-1">
                  {items[0].productName} — {items[0].customer}
                </div>
                <div className="flex flex-wrap gap-1 px-2 pb-1">
                  {items.map((m) => (
                    <button
                      key={`${m.orderId}|${m.date}|${m.shift}`}
                      type="button"
                      onClick={() => onQuickEntry(m)}
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-warning/40 bg-background hover:bg-warning/10 hover:border-warning/60 transition-colors"
                    >
                      <span className="font-mono">{m.date}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium">{shiftLabel(m.shift)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
