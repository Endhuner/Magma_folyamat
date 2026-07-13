import { Factory, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { Dashboard } from '@/components/Dashboard'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AttekintesPage() {
  const s = useAppShell()
  return (
    <div className="space-y-6">
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Keresés rendelések között..."
          value={s.dashboardSearchQuery}
          onChange={(e) => s.setDashboardSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Dashboard
        metrics={s.metrics}
        productionKPIs={s.productionKPIs}
        lowStockItems={s.lowStockItems}
        overdueOrders={s.overdueOrders}
        onFilterByStatus={s.handleFilterByStatus}
        onNavigateToInventory={() => s.goToTab('inventory')}
        onShowOverdue={() => { s.goToTab('orders'); s.setStatusFilter('all'); s.setHideDelivered(true) }}
      />

      {s.orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Factory className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
          <h3 className="text-xl font-semibold mb-2">Nincs rendelés</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Kezdje el az új rendelés létrehozásával a termelés nyomon követéséhez
          </p>
          <Button onClick={s.handleNewOrder}>
            <Plus className="w-5 h-5 mr-2" />
            Első Rendelés Létrehozása
          </Button>
        </div>
      )}
    </div>
  )
}
