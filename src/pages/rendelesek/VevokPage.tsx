import { CustomersPanel } from '@/components/panels/CustomersPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function VevokPage() {
  const s = useAppShell()
  return (
    <CustomersPanel
      filteredCustomers={s.filteredCustomers}
      orders={s.orders}
      customerSearchQuery={s.customerSearchQuery}
      setCustomerSearchQuery={s.setCustomerSearchQuery}
      setBulkImportDialogOpen={s.setBulkImportDialogOpen}
      handleNewCustomer={s.handleNewCustomer}
      handleEditCustomer={s.handleEditCustomer}
      handleDeleteCustomer={s.handleDeleteCustomer}
    />
  )
}
