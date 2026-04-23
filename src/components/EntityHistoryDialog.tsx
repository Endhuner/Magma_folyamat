import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Order } from '@/lib/types'
import { Clock, Package, TrendUp, CalendarBlank, CheckCircle } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface EntityHistoryDialogProps {
  open: boolean
  onClose: () => void
  entityName: string
  entityType: 'customer' | 'product'
  relatedOrders: Order[]
}

export function EntityHistoryDialog({
  open,
  onClose,
  entityName,
  entityType,
  relatedOrders
}: EntityHistoryDialogProps) {
  const totalOrders = relatedOrders.length
  const totalPieces = relatedOrders.reduce((sum, order) => sum + (order.amountPc || 0), 0)
  const completedOrders = relatedOrders.filter(o => 
    o.status.toLowerCase().includes('kiszállítva')
  ).length
  
  const recentOrders = [...relatedOrders]
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 10)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'yyyy. MM. dd.', { locale: hu })
    } catch {
      return dateStr
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('kiszállítva')) {
      return <Badge variant="default" className="bg-success text-success-foreground">Kiszállítva</Badge>
    } else if (statusLower.includes('folyamatban')) {
      return <Badge variant="default">Folyamatban</Badge>
    } else if (statusLower.includes('előkészítve')) {
      return <Badge variant="secondary">Előkészítve</Badge>
    } else if (statusLower.includes('csomagolás')) {
      return <Badge variant="secondary">Csomagolás alatt</Badge>
    } else if (statusLower.includes('szünetel')) {
      return <Badge variant="outline">Szünetel</Badge>
    } else if (statusLower.includes('javítás')) {
      return <Badge variant="destructive">Javítás alatt</Badge>
    }
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {entityType === 'customer' ? 'Vevő' : 'Termék'} előzmények
          </DialogTitle>
          <p className="text-base font-semibold mt-2">{entityName}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-6 h-6 text-primary" weight="duotone" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Összes rendelés</p>
                <p className="text-2xl font-bold font-mono">{totalOrders}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <TrendUp className="w-6 h-6 text-accent" weight="duotone" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Összes darabszám</p>
                <p className="text-2xl font-bold font-mono">{totalPieces.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-6 h-6 text-success" weight="duotone" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kiszállítva</p>
                <p className="text-2xl font-bold font-mono">{completedOrders}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex-1 overflow-hidden">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CalendarBlank className="w-4 h-4" />
            Legutóbbi rendelések (max. 10)
          </h3>
          <ScrollArea className="h-[400px] border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[140px]">Rendelés szám</TableHead>
                  {entityType === 'customer' && <TableHead>Termék</TableHead>}
                  {entityType === 'product' && <TableHead>Vevő</TableHead>}
                  <TableHead className="w-[110px] text-right">Mennyiség</TableHead>
                  <TableHead className="w-[130px]">Dátum</TableHead>
                  <TableHead className="w-[150px]">Határidő</TableHead>
                  <TableHead className="w-[150px]">Státusz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nincs rendelés
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.ownOrderNumber || order.orderNumber}
                      </TableCell>
                      {entityType === 'customer' && (
                        <TableCell className="font-medium">{order.productName}</TableCell>
                      )}
                      {entityType === 'product' && (
                        <TableCell className="font-medium">{order.customer}</TableCell>
                      )}
                      <TableCell className="text-right font-mono">
                        {(order.amountPc || 0).toLocaleString()} db
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.orderDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.requiredDate)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
