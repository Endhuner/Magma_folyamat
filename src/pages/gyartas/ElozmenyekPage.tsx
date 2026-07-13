import { ProductionHistoryView } from '@/components/ProductionHistoryView'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function ElozmenyekPage() {
  const s = useAppShell()
  return (
    <ProductionHistoryView
      shifts={s.productionShifts}
      orders={s.orders}
      products={s.products}
      machines={s.machines}
    />
  )
}
