import { InventoryPanel } from '@/components/panels/InventoryPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function KeszletPage() {
  const s = useAppShell()
  return (
    <InventoryPanel
      inventory={s.inventory}
      setInventory={s.setInventory}
      products={s.products}
      orders={s.orders}
      inventoryTransactions={s.inventoryTransactions}
      productionShifts={s.productionShifts}
      onMaterialAction={s.handleMaterialAction}
      lowStockItems={s.lowStockItems}
      inventorySearchQuery={s.inventorySearchQuery}
      setInventorySearchQuery={s.setInventorySearchQuery}
      setSelectedInventoryItem={s.setSelectedInventoryItem}
      setInventoryDialogOpen={s.setInventoryDialogOpen}
      setInventoryAdjustDialogOpen={s.setInventoryAdjustDialogOpen}
      setHistoryInventoryItem={s.setHistoryInventoryItem}
      setInventoryHistoryDialogOpen={s.setInventoryHistoryDialogOpen}
      setWarehouseAddPrefillProductId={s.setWarehouseAddPrefillProductId}
      setWarehouseAddDialogOpen={s.setWarehouseAddDialogOpen}
      appendAudit={s.appendAudit}
    />
  )
}
