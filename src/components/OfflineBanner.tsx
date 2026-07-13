import { WifiSlash } from '@phosphor-icons/react'

interface OfflineBannerProps {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
}

/**
 * Csak az OFFLINE állapotot jelzi (akkor fontos: az adatok nem menthetők).
 * Online, folyamatban lévő szinkron esetén nem mutatunk semmit — a
 * „…függő művelet — szinkronizálás folyamatban" sávra nincs szükség.
 */
export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground text-sm font-medium rounded-md">
      <WifiSlash className="w-4 h-4 shrink-0" weight="fill" />
      <span>Nincs kapcsolat — az adatok offline módban nem menthetők</span>
    </div>
  )
}
