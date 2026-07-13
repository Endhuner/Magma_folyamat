import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Szabad gépeléssel megadott időt normalizál 24 órás „HH:MM" alakra —
 * böngésző-lokáltól függetlenül (a natív `type=time` a rendszer nyelvétől
 * függően AM/PM-et mutatna). Rugalmas: "8"→08:00, "830"→08:30, "1830"→18:30,
 * "8:00"→08:00; a tartományt 23:59-re vágja.
 */
export function normalizeTime24(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (!d) return ''
  let h: number
  let m: number
  if (d.length <= 2) {
    h = Number(d)
    m = 0
  } else if (d.length === 3) {
    h = Number(d.slice(0, 1))
    m = Number(d.slice(1))
  } else {
    h = Number(d.slice(0, 2))
    m = Number(d.slice(2, 4))
  }
  return `${pad(Math.min(23, h))}:${pad(Math.min(59, m))}`
}

interface TimeInput24Props {
  value: string
  onChange: (v: string) => void
  id?: string
  className?: string
}

/** 24 órás időmező (nem type=time, hogy sose legyen AM/PM). Blur/Enter normalizál. */
export function TimeInput24({ value, onChange, id, className }: TimeInput24Props) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const norm = normalizeTime24(draft)
    setDraft(norm)
    if (norm !== value) onChange(norm)
  }

  return (
    <Input
      id={id}
      value={draft}
      inputMode="numeric"
      placeholder="óó:pp"
      maxLength={5}
      className={cn('font-mono', className)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
    />
  )
}
