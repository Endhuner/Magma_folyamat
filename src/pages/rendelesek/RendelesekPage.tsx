import { OrdersPanel } from '@/components/panels/OrdersPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function RendelesekPage() {
  const s = useAppShell()
  return (
    <OrdersPanel
      filteredOrders={s.filteredOrders}
      orders={s.orders}
      customers={s.customers}
      products={s.products}
      materialEstimateKg={s.materialEstimateKg}
      priceLists={s.priceLists}
      labelTemplates={s.labelTemplates}
      savedDeliveryTemplates={s.savedDeliveryTemplates}
      activeTemplates={s.activeTemplates}
      activeLabelTemplateId={s.activeLabelTemplateId}
      hideDelivered={s.hideDelivered}
      setHideDelivered={s.setHideDelivered}
      hideInvoiced={s.hideInvoiced}
      setHideInvoiced={s.setHideInvoiced}
      yearFilterEnabled={s.yearFilterEnabled}
      setYearFilterEnabled={s.setYearFilterEnabled}
      yearOptions={s.yearOptions}
      selectedYears={s.selectedYears}
      toggleYear={s.toggleYear}
      orderSearchQuery={s.orderSearchQuery}
      setOrderSearchQuery={s.setOrderSearchQuery}
      statusFilter={s.statusFilter}
      setStatusFilter={s.setStatusFilter}
      selectedOrderIds={s.selectedOrderIds}
      setSelectedOrderIds={s.setSelectedOrderIds}
      orderColumnFilters={s.orderColumnFilters}
      setOrderColumnFilters={s.setOrderColumnFilters}
      activeOrderFilterId={s.activeOrderFilterId}
      setActiveOrderFilterId={s.setActiveOrderFilterId}
      setOrderBulkImportDialogOpen={s.setOrderBulkImportDialogOpen}
      setNewOrderFilterDialogOpen={s.setNewOrderFilterDialogOpen}
      setLabelPrintSettingsDialogOpen={s.setLabelPrintSettingsDialogOpen}
      setCurrentTab={s.goToTab}
      lastAction={s.lastAction}
      handleNewOrder={s.handleNewOrder}
      handleEditOrder={s.handleEditOrder}
      handleDeleteOrder={s.handleDeleteOrder}
      handleDuplicateOrder={s.handleDuplicateOrder}
      handleStatusChange={s.handleStatusChange}
      handleBatchStatusChange={s.handleBatchStatusChange}
      handleDeleteSelectedOrders={s.handleDeleteSelectedOrders}
      handleUndoLastAction={s.handleUndoLastAction}
      handleExportDelivery={s.handleExportDelivery}
      handleExportCmr={s.handleExportCmr}
    />
  )
}
