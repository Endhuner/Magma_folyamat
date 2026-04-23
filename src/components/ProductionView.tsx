import { useState, useMemo } from 'react'
import { Order, OrderStatus, Product } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Package, 
  Clock, 
  CheckCircle, 
  PlayCircle, 
  PauseCircle,
  Wrench,
  MagnifyingGlass,
  Funnel,
  ArrowRight,
  Factory
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ProductionViewProps {
  orders: Order[]
  products: Product[]
  onStatusChange: (id: string, status: OrderStatus) => void
  onEdit: (id: string) => void
}

export function ProductionView({ orders, products, onStatusChange, onEdit }: ProductionViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'normal'>('all')

  const productionOrders = useMemo(() => {
    return orders.filter(o => 
      o.status === 'Felvéve' || 
      o.status === 'Folyamatban' || 
      o.status === 'Előkészítve' ||
      o.status === 'Javítás alatt' ||
      o.status === 'Szünetel'
    )
  }, [orders])

  const filteredOrders = useMemo(() => {
    let filtered = productionOrders

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(o =>
        o.productName.toLowerCase().includes(query) ||
        o.customer.toLowerCase().includes(query) ||
        o.orderNumber.toLowerCase().includes(query) ||
        o.ownOrderNumber.toLowerCase().includes(query)
      )
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(o => {
        const requiredDate = new Date(o.requiredDate)
        const today = new Date()
        const daysUntilDue = Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (priorityFilter === 'urgent') {
          return daysUntilDue <= 7
        } else {
          return daysUntilDue > 7
        }
      })
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.requiredDate)
      const dateB = new Date(b.requiredDate)
      return dateA.getTime() - dateB.getTime()
    })
  }, [productionOrders, searchQuery, priorityFilter])

  const groupedOrders = useMemo(() => {
    return {
      pending: filteredOrders.filter(o => o.status === 'Felvéve'),
      inProgress: filteredOrders.filter(o => o.status === 'Folyamatban'),
      ready: filteredOrders.filter(o => o.status === 'Előkészítve'),
      paused: filteredOrders.filter(o => o.status === 'Szünetel'),
      repair: filteredOrders.filter(o => o.status === 'Javítás alatt'),
    }
  }, [filteredOrders])

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'Felvéve': return 'bg-muted text-muted-foreground'
      case 'Folyamatban': return 'bg-accent text-accent-foreground'
      case 'Előkészítve': return 'bg-success text-success-foreground'
      case 'Szünetel': return 'bg-warning text-warning-foreground'
      case 'Javítás alatt': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'Felvéve': return <Clock className="w-4 h-4" weight="duotone" />
      case 'Folyamatban': return <PlayCircle className="w-4 h-4" weight="duotone" />
      case 'Előkészítve': return <CheckCircle className="w-4 h-4" weight="duotone" />
      case 'Szünetel': return <PauseCircle className="w-4 h-4" weight="duotone" />
      case 'Javítás alatt': return <Wrench className="w-4 h-4" weight="duotone" />
      default: return <Package className="w-4 h-4" weight="duotone" />
    }
  }

  const getPriorityBadge = (order: Order) => {
    const requiredDate = new Date(order.requiredDate)
    const today = new Date()
    const daysUntilDue = Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilDue < 0) {
      return <Badge variant="destructive" className="text-xs">KÉSÉSBEN</Badge>
    } else if (daysUntilDue <= 3) {
      return <Badge variant="destructive" className="text-xs">Sürgős</Badge>
    } else if (daysUntilDue <= 7) {
      return <Badge variant="default" className="text-xs bg-warning text-warning-foreground">Fontos</Badge>
    }
    return null
  }

  const renderOrderCard = (order: Order) => {
    const product = products.find(p => 
      p.productName === order.productName && p.customer === order.customer
    )

    return (
      <Card key={order.id} className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold truncate">
                {order.productName}
              </CardTitle>
              <p className="text-sm text-muted-foreground truncate">{order.customer}</p>
            </div>
            {getPriorityBadge(order)}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rendelés szám:</span>
              <span className="font-mono font-medium">{order.orderNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saját szám:</span>
              <span className="font-mono font-medium">{order.ownOrderNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mennyiség:</span>
              <span className="font-semibold">{order.amountPc} db</span>
            </div>
            {product && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rajzszám:</span>
                <span className="font-mono text-xs">{product.drawingNumber}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Határidő:</span>
              <span className="font-semibold">
                {order.requiredDate ? format(new Date(order.requiredDate), 'yyyy-MM-dd') : '-'}
              </span>
            </div>
            {order.plannedProductionHours && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tervezett óra:</span>
                <span className="font-mono">{order.plannedProductionHours}h</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 pt-2">
            {getStatusIcon(order.status)}
            <Badge className={getStatusColor(order.status)} variant="secondary">
              {order.status}
            </Badge>
          </div>

          <div className="flex gap-2 pt-2">
            <Select
              value={order.status}
              onValueChange={(value) => {
                onStatusChange(order.id, value as OrderStatus)
                toast.success('Státusz frissítve')
              }}
            >
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Felvéve">Felvéve</SelectItem>
                <SelectItem value="Folyamatban">Folyamatban</SelectItem>
                <SelectItem value="Előkészítve">Előkészítve</SelectItem>
                <SelectItem value="Szünetel">Szünetel</SelectItem>
                <SelectItem value="Javítás alatt">Javítás alatt</SelectItem>
                <SelectItem value="Csomagolás alatt">Csomagolás</SelectItem>
                <SelectItem value="Kiszállítva">Kiszállítva</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onEdit(order.id)}
            >
              Részletek
            </Button>
          </div>

          {order.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                {order.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderColumn = (title: string, orders: Order[], icon: React.ReactNode) => (
    <div className="flex-1 min-w-[300px]">
      <div className="bg-card border rounded-lg p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h3 className="font-semibold text-lg">{title}</h3>
          <Badge variant="outline" className="ml-auto">{orders.length}</Badge>
        </div>
        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-3 pb-4">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nincs {title.toLowerCase()} rendelés
              </div>
            ) : (
              orders.map(renderOrderCard)
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Gyártás</h2>
          <p className="text-muted-foreground">Folyamatban lévő rendelések nyomon követése</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Factory className="w-5 h-5 mr-2" weight="duotone" />
            {productionOrders.length} aktív munka
          </Badge>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Keresés termék, vevő vagy rendelésszám szerint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={priorityFilter} onValueChange={(value: any) => setPriorityFilter(value)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Funnel className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes prioritás</SelectItem>
              <SelectItem value="urgent">Sürgős (7 nap)</SelectItem>
              <SelectItem value="normal">Normál (7+ nap)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {renderColumn(
          'Felvéve',
          groupedOrders.pending,
          <Clock className="w-5 h-5 text-muted-foreground" weight="duotone" />
        )}
        {renderColumn(
          'Folyamatban',
          groupedOrders.inProgress,
          <PlayCircle className="w-5 h-5 text-accent" weight="duotone" />
        )}
        {renderColumn(
          'Előkészítve',
          groupedOrders.ready,
          <CheckCircle className="w-5 h-5 text-success" weight="duotone" />
        )}
        {renderColumn(
          'Szünetel',
          groupedOrders.paused,
          <PauseCircle className="w-5 h-5 text-warning" weight="duotone" />
        )}
        {renderColumn(
          'Javítás alatt',
          groupedOrders.repair,
          <Wrench className="w-5 h-5 text-destructive" weight="duotone" />
        )}
      </div>

      {filteredOrders.length === 0 && searchQuery && (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" weight="duotone" />
          <h3 className="text-xl font-semibold mb-2">Nincs találat</h3>
          <p className="text-muted-foreground">
            Próbáljon más keresési feltételt
          </p>
        </div>
      )}
    </div>
  )
}
