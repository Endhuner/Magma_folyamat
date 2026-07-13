import { Suspense, lazy } from 'react'
import { useAppShell } from '@/components/layout/AppShellContext'

const MaintenanceView = lazy(() =>
  import('@/components/MaintenanceView').then((m) => ({ default: m.MaintenanceView })),
)

export default function KarbantartasPage() {
  const s = useAppShell()
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4">Karbantartás betöltése…</div>}>
      <MaintenanceView
        machines={s.machines}
        maintenance={s.maintenance}
        onSave={s.maintenanceAdd}
        onDelete={s.maintenanceRemove}
      />
    </Suspense>
  )
}
