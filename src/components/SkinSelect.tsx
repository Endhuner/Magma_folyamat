/**
 * Skin-választó a fejlécben (a sötét mód kapcsoló mellett).
 *
 * A választás felhasználó-gépenként él (localStorage), és a <html
 * data-skin="…"> attribútumot állítja — a stílusokat a styles/skins.css
 * adja. A sötét móddal szabadon kombinálható.
 */
import { useEffect, useState } from 'react'
import { Palette, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const SKINS: Array<{ id: string; name: string; desc: string }> = [
  { id: '', name: 'Alap', desc: 'Az eredeti kék megjelenés' },
  { id: 'prime', name: 'Prime', desc: 'primeng.dev — slate + smaragd, aláhúzásos fülek' },
]

const STORAGE_KEY = 'pp-skin'

/** A mentett skin alkalmazása — a main.tsx is ezt hívja betöltéskor. */
export function applySavedSkin(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || ''
    if (saved) document.documentElement.dataset.skin = saved
    else delete document.documentElement.dataset.skin
  } catch { /* privát mód stb. — marad az alap */ }
}

export function SkinSelect() {
  const [skin, setSkin] = useState<string>('')

  useEffect(() => {
    try { setSkin(localStorage.getItem(STORAGE_KEY) || '') } catch { /* noop */ }
  }, [])

  const choose = (id: string) => {
    setSkin(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* noop */ }
    if (id) document.documentElement.dataset.skin = id
    else delete document.documentElement.dataset.skin
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 coarse:h-10 coarse:w-10"
          title="Megjelenés (skin)"
          aria-label="Megjelenés kiválasztása"
        >
          <Palette className="w-5 h-5" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {SKINS.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => choose(s.id)} className="flex-col items-start gap-0.5">
            <span className="flex items-center gap-2 font-medium">
              {skin === s.id && <Check className="w-4 h-4 text-primary" weight="bold" />}
              {s.name}
            </span>
            <span className="text-xs text-muted-foreground">{s.desc}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
