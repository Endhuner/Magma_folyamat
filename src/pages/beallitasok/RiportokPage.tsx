import { Suspense, lazy } from 'react'
import { useAppShell } from '@/components/layout/AppShellContext'

const ReportsView = lazy(() =>
  import('@/components/ReportsView').then((m) => ({ default: m.ReportsView })),
)

export default function RiportokPage() {
  const s = useAppShell()
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4">Riportok betöltése…</div>}>
      <ReportsView
        orders={s.orders}
        shifts={s.productionShifts}
        defects={s.productionDefects}
        machines={s.machines}
        products={s.products}
        inventory={s.inventory}
      />
    </Suspense>
  )
}
