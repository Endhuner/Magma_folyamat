import { DashboardMetrics, Order, OrderStatus, ProductionKPIs, InventoryItem } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, Package, Receipt, ArrowRight, Factory, Warning, CalendarX } from '@phosphor-icons/react'
import { formatDate } from '@/lib/helpers'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor?: string
  onViewClick?: () => void
  subtitle?: string
  /** Opcionális trend az előző időszakhoz képest (százalék). Pozitív = növekedés. */
  trend?: { value: number; label?: string }
}

function MetricCard({ title, value, icon: Icon, iconColor = 'text-primary', onViewClick, subtitle, trend }: MetricCardProps) {
  // Számokat ezres tagolással jelenítünk meg (hu-HU), a string értéket változatlanul.
  const displayValue = typeof value === 'number' ? value.toLocaleString('hu-HU') : value
  return (
    // stat-tile: a Prime skin csempe-stílusa célozza (skins.css)
    <Card className="stat-tile p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
          {/* Rugalmas méret + tabular-nums + truncate → nagy szám sem csordul túl */}
          <p
            className="font-bold font-mono tabular-nums truncate"
            style={{ fontSize: 'clamp(1.5rem, 2.4vw, 2.25rem)' }}
            title={String(displayValue)}
          >
            {displayValue}
          </p>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-2 text-xs mt-2">
              <span
                className={`px-1.5 py-0.5 rounded font-semibold ${
                  trend.value >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                }`}
              >
                {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}%
              </span>
              {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-muted ${iconColor} shrink-0`}>
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
  productionKPIs?: ProductionKPIs
  lowStockItems?: InventoryItem[]
  overdueOrders?: Order[]
  onFilterByStatus?: (status: OrderStatus | 'all') => void
  onNavigateToInventory?: () => void
  onShowOverdue?: () => void
}

/** Naptári napok száma egy múltbeli határidő óta (pozitív = ennyi napja lejárt). */
function daysOverdue(dueDate: string): number {
  if (!dueDate) return 0
  const diff = Date.now() - new Date(dueDate).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export function Dashboard({ metrics, productionKPIs, lowStockItems = [], overdueOrders = [], onFilterByStatus, onNavigateToInventory, onShowOverdue }: DashboardProps) {
  const deliveryRate = metrics.totalOrders > 0
    ? Math.round((metrics.deliveredOrders / metrics.totalOrders) * 100)
    : 0

  const invoicedRate = metrics.totalOrders > 0
    ? Math.round((metrics.invoicedOrders / metrics.totalOrders) * 100)
    : 0

  // Valós arány az összes rendeléshez — nem a korábbi félrevezető 0/100%.
  const readyRate = metrics.totalOrders > 0
    ? Math.round((metrics.readyForDeliveryOrders / metrics.totalOrders) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* Lejárt határidő figyelmeztetés — a legfontosabb akcióigényes tétel, legfelül */}
      {overdueOrders.length > 0 && (
        <Card className="p-5 border-destructive/60 bg-destructive/5">
          <div className="flex items-start gap-3">
            <CalendarX className="w-5 h-5 text-destructive mt-0.5 shrink-0" weight="fill" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-destructive">
                {overdueOrders.length} rendelés határideje lejárt
              </p>
              <ul className="mt-1 space-y-0.5">
                {overdueOrders.slice(0, 3).map(order => (
                  <li key={order.id} className="text-sm text-muted-foreground truncate">
                    {order.customer} — {order.productName || order.designation} · határidő: {formatDate(order.requiredDate)}
                    <span className="text-destructive font-medium"> ({daysOverdue(order.requiredDate)} napja)</span>
                  </li>
                ))}
                {overdueOrders.length > 3 && (
                  <li className="text-sm text-muted-foreground">… és még {overdueOrders.length - 3} rendelés</li>
                )}
              </ul>
            </div>
            {onShowOverdue && (
              <Button variant="ghost" size="sm" onClick={onShowOverdue} className="shrink-0 gap-1 text-destructive hover:text-destructive">
                Megnézem
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Rendelések szekció */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-1">Rendelések Áttekintése</h2>
        <p className="text-sm text-muted-foreground mb-4">Valós idejű rendelés állapot és teljesítmény</p>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Szállításra kész</p>
            <p className="text-4xl font-bold font-mono tabular-nums">{metrics.readyForDeliveryOrders.toLocaleString('hu-HU')}</p>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-success transition-all duration-500"
                style={{ width: `${readyRate}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{readyRate}% az összes rendelésből</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Kiszállítva</p>
            <p className="text-4xl font-bold font-mono tabular-nums">{metrics.deliveredOrders.toLocaleString('hu-HU')}</p>
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
            <p className="text-4xl font-bold font-mono tabular-nums">{metrics.invoicedOrders.toLocaleString('hu-HU')}</p>
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

      {/* Alacsony készlet figyelmeztetés */}
      {lowStockItems.length > 0 && (
        <Card className="p-5 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <Warning className="w-5 h-5 text-destructive mt-0.5 shrink-0" weight="fill" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-destructive">
                {lowStockItems.length} termék készlete alacsony
              </p>
              <ul className="mt-1 space-y-0.5">
                {lowStockItems.slice(0, 3).map(item => (
                  <li key={item.id} className="text-sm text-muted-foreground truncate">
                    {item.productName} ({item.drawingNumber}) — {item.quantity} db
                  </li>
                ))}
                {lowStockItems.length > 3 && (
                  <li className="text-sm text-muted-foreground">… és még {lowStockItems.length - 3} tétel</li>
                )}
              </ul>
            </div>
            {onNavigateToInventory && (
              <Button variant="ghost" size="sm" onClick={onNavigateToInventory} className="shrink-0 gap-1 text-destructive hover:text-destructive">
                Készlet
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Gyártás KPI szekció */}
      {productionKPIs && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Gyártás – Elmúlt 7 nap</h2>
          <p className="text-sm text-muted-foreground mb-4">Gyártott darabszám és selejt arány</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <MetricCard
              title="Ma gyártva"
              value={productionKPIs.todayProduced.toLocaleString('hu-HU')}
              icon={Factory}
              iconColor="text-accent"
              subtitle="db"
            />
            <MetricCard
              title="Héten gyártva"
              value={productionKPIs.weekProduced.toLocaleString('hu-HU')}
              icon={CheckCircle}
              iconColor="text-success"
              subtitle="db összesen"
            />
            <MetricCard
              title="Selejt arány"
              value={`${productionKPIs.defectRate}%`}
              icon={Warning}
              iconColor={productionKPIs.defectRate > 5 ? 'text-destructive' : productionKPIs.defectRate > 2 ? 'text-warning' : 'text-success'}
              subtitle={`${productionKPIs.weekDefects} db selejt`}
            />
          </div>

          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Napi gyártás (db)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productionKPIs.dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString('hu-HU')} db`,
                    name === 'produced' ? 'Gyártva' : 'Selejt',
                  ]}
                  labelFormatter={(label) => `Dátum: ${label}`}
                />
                <Legend
                  formatter={(value) => value === 'produced' ? 'Gyártva' : 'Selejt'}
                />
                <Bar dataKey="produced" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="defects" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}
