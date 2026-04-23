import { DashboardMetrics, OrderStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, Package, Receipt, ArrowRight } from '@phosphor-icons/react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor?: string
  onViewClick?: () => void
}

function MetricCard({ title, value, icon: Icon, iconColor = 'text-primary', onViewClick }: MetricCardProps) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
          <p className="text-4xl font-bold font-mono">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-muted ${iconColor}`}>
          <Icon className="w-6 h-6" weight="duotone" />
        </div>
      </div>
      {onViewClick && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onViewClick}
          className="w-full gap-2 text-muted-foreground hover:text-foreground"
        >
          Részletek
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </Card>
  )
}

interface DashboardProps {
  metrics: DashboardMetrics
  onFilterByStatus?: (status: OrderStatus | 'all') => void
}

export function Dashboard({ metrics, onFilterByStatus }: DashboardProps) {
  const deliveryRate = metrics.totalOrders > 0 
    ? Math.round((metrics.deliveredOrders / metrics.totalOrders) * 100) 
    : 0

  const invoicedRate = metrics.totalOrders > 0 
    ? Math.round((metrics.invoicedOrders / metrics.totalOrders) * 100) 
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Rendelések Áttekintése</h2>
        <p className="text-muted-foreground">Valós idejű rendelés állapot és teljesítmény</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Összes Rendelés"
          value={metrics.totalOrders}
          icon={Package}
          iconColor="text-primary"
          onViewClick={onFilterByStatus ? () => onFilterByStatus('all') : undefined}
        />
        
        <MetricCard
          title="Függőben"
          value={metrics.pendingOrders}
          icon={Clock}
          iconColor="text-secondary"
          onViewClick={onFilterByStatus ? () => onFilterByStatus('Felvéve') : undefined}
        />
        
        <MetricCard
          title="Gyártás alatt"
          value={metrics.inProductionOrders}
          icon={Package}
          iconColor="text-warning"
          onViewClick={onFilterByStatus ? () => onFilterByStatus('Folyamatban') : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Szállításra kész</p>
          <p className="text-4xl font-bold font-mono">{metrics.readyForDeliveryOrders}</p>
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent to-success transition-all duration-500"
              style={{ width: `${metrics.readyForDeliveryOrders > 0 ? 100 : 0}%` }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Kiszállítva</p>
          <p className="text-4xl font-bold font-mono">{metrics.deliveredOrders}</p>
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-success to-primary transition-all duration-500"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">{deliveryRate}% teljesítve</p>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Számlázva</p>
          <p className="text-4xl font-bold font-mono">{metrics.invoicedOrders}</p>
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${invoicedRate}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">{invoicedRate}% számlázva</p>
        </Card>
      </div>
    </div>
  )
}

