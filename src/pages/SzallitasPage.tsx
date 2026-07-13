import { DeliveryNotesTable } from '@/components/DeliveryNotesTable'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function SzallitasPage() {
  const s = useAppShell()
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Szállítólevelek</h2>
        <p className="text-muted-foreground">Létrehozott szállítólevelek és CMR dokumentumok</p>
      </div>

      <DeliveryNotesTable
        deliveryNotes={s.deliveryNotes}
        orders={s.orders}
        customers={s.customers}
        products={s.products}
        onDelete={s.handleDeleteDeliveryNote}
        onUpdate={s.handleUpdateDeliveryNote}
        onEditExtraItems={s.setExtraItemsNote}
        onCreateNew={() => s.setCreateNoteDialogOpen(true)}
        onDownloadPdf={s.handleDownloadPdf}
      />
    </div>
  )
}
