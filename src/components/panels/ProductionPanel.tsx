/**
 * Gyártás (Production) kezelőpanel — a TIR fő tabjának egyik szigetelt blokkja.
 *
 * Felelőssége:
 *  - mobil eszközön a kompakt érintőbarát `MobileProductionView`-t rendereli
 *  - asztali nézeten a teljes `ProductionView`-t
 *  - mindkét kapcsolt komponens ugyanazokat a műszak / hibanapló handler-eket
 *    használja, így ezek prop-on át mennek be
 *
 * Architektúra: csak prop-ok, nincs közvetlen DB-elérés. A `isMobile` döntést
 * is propként adjuk át, hogy a panel teszthető legyen anélkül, hogy a
 * `useMediaQuery` hook fusson.
 */
import { TabsContent } from '@/components/ui/tabs'
import { ProductionView } from '@/components/ProductionView'
import { MobileProductionView } from '@/components/MobileProductionView'
import type {
  Order,
  OrderStatus,
  Product,
  ProductionShift,
  ProductionDefect,
  Machine,
} from '@/lib/types'

export interface ProductionPanelProps {
  isMobile: boolean
  orders: Order[] | null | undefined
  products: Product[] | null | undefined
  productionShifts: ProductionShift[] | null | undefined
  productionDefects: ProductionDefect[] | null | undefined
  machines?: Machine[]

  handleStatusChange: (id: string, status: OrderStatus) => void
  handleEditOrder: (id: string) => void
  handleSaveShift: (shift: ProductionShift) => void
  handleDeleteShift: (id: string) => void
  handleUpdateOrderNotes: (orderId: string, notes: string) => void
  handleSaveDefect: (defect: ProductionDefect) => void
  handleDeleteDefect: (id: string) => void
}

export function ProductionPanel({
  isMobile,
  orders,
  products,
  productionShifts,
  productionDefects,
  machines,
  handleStatusChange,
  handleEditOrder,
  handleSaveShift,
  handleDeleteShift,
  handleUpdateOrderNotes,
  handleSaveDefect,
  handleDeleteDefect,
}: ProductionPanelProps) {
  return (
    <TabsContent value="production" className="space-y-6">
      {isMobile ? (
        <MobileProductionView
          orders={orders || []}
          products={products || []}
          shifts={productionShifts || []}
          onStatusChange={handleStatusChange}
          onEdit={handleEditOrder}
          onSaveShift={handleSaveShift}
          onDeleteShift={handleDeleteShift}
          onUpdateOrderNotes={handleUpdateOrderNotes}
          defects={productionDefects || []}
          onSaveDefect={handleSaveDefect}
          onDeleteDefect={handleDeleteDefect}
        />
      ) : (
        <ProductionView
          orders={orders || []}
          products={products || []}
          shifts={productionShifts || []}
          onStatusChange={handleStatusChange}
          onEdit={handleEditOrder}
          onSaveShift={handleSaveShift}
          onDeleteShift={handleDeleteShift}
          defects={productionDefects || []}
          onSaveDefect={handleSaveDefect}
          onDeleteDefect={handleDeleteDefect}
          machines={machines}
        />
      )}
    </TabsContent>
  )
}
