import { ProductsPanel } from '@/components/panels/ProductsPanel'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function TermekekPage() {
  const s = useAppShell()
  const navigate = useNavigate()
  const datasheetProductIds = useMemo(
    () => new Set(s.datasheets.map((d) => d.productId)),
    [s.datasheets],
  )
  return (
    <ProductsPanel
      onOpenDatasheet={(id) => navigate(`/rendelesek/termekek/adatlap/${id}`)}
      datasheetProductIds={datasheetProductIds}
      filteredProducts={s.filteredProducts}
      orders={s.orders}
      productSearchQuery={s.productSearchQuery}
      setProductSearchQuery={s.setProductSearchQuery}
      setProductBulkImportDialogOpen={s.setProductBulkImportDialogOpen}
      handleNewProduct={s.handleNewProduct}
      handleEditProduct={s.handleEditProduct}
      handleDeleteProduct={s.handleDeleteProduct}
      handleBulkDeleteProducts={s.handleBulkDeleteProducts}
      savedTemplates={s.savedDeliveryTemplates?.map(t => ({ id: (t as any).id, name: (t as any).name || (t as any).data?.name || '', data: { type: t.data?.type || '', active: t.data?.active } })) || []}
    />
  )
}
