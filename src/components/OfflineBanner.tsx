import { WifiSlash, ArrowsClockwise } from '@phosphor-icons/react'

interface OfflineBannerProps {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
}

export function OfflineBanner({ isOnline, pendingCount, isSyncing }: OfflineBannerProps) {
  if (isOnline && pendingCount === 0) return null

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground text-sm font-medium rounded-md">
        <WifiSlash className="w-4 h-4 shrink-0" weight="fill" />
        <span>Nincs kapcsolat — az adatok offline módban nem menthetők</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/20 text-warning-foreground border border-warning/40 text-sm font-medium rounded-md">
      <ArrowsClockwise className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} weight="bold" />
      <span>
        {isSyncing
          ? `Szinkronizálás… (${pendingCount} művelet)`
          : `${pendingCount} függő művelet — szinkronizálás folyamatban`}
      </span>
    </div>
  )
}
