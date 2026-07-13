import { DocumentsPanel } from '@/components/panels/DocumentsPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function SzallitolevelPage() {
  const s = useAppShell()
  return (
    <DocumentsPanel
      documentFilters={s.documentFilters}
      setDocumentFilters={s.setDocumentFilters}
      activeFilterId={s.activeFilterId}
      setActiveFilterId={s.setActiveFilterId}
      setNewFilterDialogOpen={s.setNewFilterDialogOpen}
      deliveryNotes={s.deliveryNotes}
      orders={s.orders}
      customers={s.customers}
      products={s.products}
      auditLog={s.auditLog}
      handleDeleteDeliveryNote={s.handleDeleteDeliveryNote}
      handleUpdateDeliveryNote={s.handleUpdateDeliveryNote}
      handlePreviewNote={s.handlePreviewNote}
      handleDownloadPdf={s.handleDownloadPdf}
      onEditExtraItems={s.setExtraItemsNote}
      onCreateNew={() => s.setCreateNoteDialogOpen(true)}
      handleEmailNote={s.handleEmailNote}
      emailTemplate={s.emailTemplate}
      setEmailTemplate={s.setEmailTemplate}
    />
  )
}
