import type { KeyboardEventHandler, Ref } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NumberStepperProps {
  value: string
  onChange: (v: string) => void
  step?: number
  min?: number
  id?: string
  placeholder?: string
  autoFocus?: boolean
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  inputClassName?: string
  /** A −/+ gombok magassága igazodjon a mezőhöz (pl. 'h-13'). */
  buttonClassName?: string
  /** A belső <input>-ra mutató ref — célzott fókuszáláshoz. */
  inputRef?: Ref<HTMLInputElement>
}

/** Szám-mező −/+ léptető gombokkal — üzemi (kesztyűs/érintő) bevitelhez. */
export function NumberStepper({
  value, onChange, step = 1, min = 0, id, placeholder, autoFocus, onKeyDown,
  inputClassName, buttonClassName, inputRef,
}: NumberStepperProps) {
  const n = Number.parseInt(value || '0', 10) || 0
  return (
    <div className="flex items-stretch gap-1">
      <Button
        type="button" variant="outline" aria-label="Csökkentés"
        className={cn('px-3 shrink-0', buttonClassName)}
        onClick={() => onChange(String(Math.max(min, n - step)))}
      >
        <Minus className="w-4 h-4" weight="bold" />
      </Button>
      <Input
        ref={inputRef}
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn('text-center', inputClassName)}
      />
      <Button
        type="button" variant="outline" aria-label="Növelés"
        className={cn('px-3 shrink-0', buttonClassName)}
        onClick={() => onChange(String(n + step))}
      >
        <Plus className="w-4 h-4" weight="bold" />
      </Button>
    </div>
  )
}
