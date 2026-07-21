/**
 * Érintő-numpad — tableten a RENDSZER-billentyűzet helyett.
 *
 * Miért kell: a beépített billentyűzet a tablet fél képernyőjét elfoglalja, és
 * eltakarja a kalkulációt meg a mentés gombot. A megoldás: a szám-mező
 * `inputMode='none'`-nal nem hívja fel a rendszer-billentyűzetet, helyette ez a
 * nagy gombos numpad jelenik meg a mező alatt.
 *
 * Ez a komponens a QuickShiftEntryDialog-ban bevált numpad kiemelt,
 * újrahasznosítható változata (ott a lövésszám-bevitel már így működött).
 */
import { useMemo } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

/** Igaz, ha az eszköz elsődlegesen érintős (tablet / telefon). */
export function useIsTouch(): boolean {
  return useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    [],
  )
}

export interface TouchNumpadProps {
  /** Melyik mezőt szerkesztjük — a numpad fejlécében jelenik meg. */
  label: string
  value: string
  onChange: (next: string) => void
  /** A "Kész" gomb — a hívó ilyenkor általában bezárja a numpadot. */
  onDone: () => void
}

export function TouchNumpad({ label, value, onChange, onDone }: TouchNumpadProps) {
  const press = (k: string) => {
    if (k === 'C') return onChange('')
    if (k === '⌫') return onChange(value.slice(0, -1))
    // vezető nullák levágása, hogy ne "007" legyen
    const base = value === '0' ? '' : value
    onChange((base + k).replace(/^0+(?=\d)/, ''))
  }

  return (
    <div className="rounded-xl border bg-card shadow-md p-3 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="font-mono font-bold text-xl">{value || '0'}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <Button
            key={k}
            type="button"
            variant="outline"
            className="h-16 text-3xl font-semibold"
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-16 text-xl font-semibold text-orange-600"
          onClick={() => press('C')}
        >
          C
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 text-3xl font-semibold"
          onClick={() => press('0')}
        >
          0
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 text-2xl font-semibold text-orange-600"
          onClick={() => press('⌫')}
          aria-label="Visszatörlés"
        >
          ⌫
        </Button>
      </div>
      <Button type="button" className="w-full h-12 text-base" onClick={onDone}>
        <CheckCircle className="w-5 h-5 mr-2" weight="fill" />
        Kész
      </Button>
    </div>
  )
}
