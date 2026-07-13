import { ProductionPlanningView } from '@/components/ProductionPlanningView'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function TervezesPage() {
  const s = useAppShell()
  return <ProductionPlanningView machines={s.machines} orders={s.orders} />
}
