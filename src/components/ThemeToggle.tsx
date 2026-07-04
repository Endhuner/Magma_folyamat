import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

/**
 * Világos/sötét mód kapcsoló. A `next-themes` a `.dark` osztályt teszi a
 * <html>-re, amit a main.css `.dark { --… }` blokkja használ.
 *
 * Body-toggle helyett három állapotot ciklizálunk? Nem — egyszerű világos↔sötét.
 * A rendszer-preferencia az alapértelmezett (ThemeProvider defaultTheme="system").
 */
export function ThemeToggle() {
  // A szerver-render / első paint nem ismeri a témát → hydration mismatch
  // elkerülésére csak mount után rendereljük az ikont.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { resolvedTheme, setTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 w-9 coarse:h-10 coarse:w-10"
      title={isDark ? 'Világos mód' : 'Sötét mód'}
      aria-label={isDark ? 'Világos módra váltás' : 'Sötét módra váltás'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted && isDark
        ? <Sun className="w-5 h-5" weight="bold" />
        : <Moon className="w-5 h-5" weight="bold" />}
    </Button>
  )
}
