import { MaterialPanel } from '@/components/MaterialPanel'
import { ProductionPanel } from '@/components/panels/ProductionPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function GyartasPage() {
  const s = useAppShell()
  return (
    <ProductionPanel
      isMobile={s.isMobile}
      isOperator={s.auth.user?.role === 'operator'}
      orders={s.orders}
      products={s.products}
      productionShifts={s.productionShifts}
      productionDefects={s.productionDefects}
      machines={s.machines}
      materialSlot={
        <MaterialPanel
          compact
          inventory={s.inventory}
          shifts={s.productionShifts}
          orders={s.orders}
          products={s.products}
          transactions={s.inventoryTransactions}
          onApply={s.handleMaterialAction}
        />
      }
      handleStatusChange={s.handleStatusChange}
      handleEditOrder={s.handleEditOrder}
      handleSaveShift={s.handleSaveShift}
      handleDeleteShift={s.handleDeleteShift}
      handleUpdateOrderNotes={s.handleUpdateOrderNotes}
      handleSaveDefect={s.handleSaveDefect}
      handleDeleteDefect={s.handleDeleteDefect}
    />
  )
}
