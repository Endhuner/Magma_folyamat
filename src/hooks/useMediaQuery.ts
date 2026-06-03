import { useEffect, useState } from 'react'

/**
 * `useMediaQuery` — reaktív CSS media query egyezés-figyelő.
 *
 * Példa:
 *   const isMobile = useMediaQuery('(max-width: 767px)')
 *
 * SSR-biztos: szerveren / pre-render fázisban `false`-ot ad vissza, és csak a
 * `useEffect`-ben kapcsolódik be a böngészős figyelő.
 */
export function useMediaQuery(query: string): boolean {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false

  const [matches, setMatches] = useState<boolean>(get)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    // Régebbi WebKit fallback
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [query])

  return matches
}

/** Convenience: telefon-méret (Tailwind `md` alatt). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/**
 * Convenience: telefon ÉS tablet (Tailwind `lg` alatt, ≤1024px — pl. iPad
 * álló és fekvő nézet is). Ott használjuk, ahol a kompakt, érintőbarát
 * nézetet a tabletre is ki akarjuk terjeszteni (pl. a gyártás-panel).
 */
export function useIsTouchLayout(): boolean {
  return useMediaQuery('(max-width: 1024px)')
}
