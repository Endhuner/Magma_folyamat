/**
 * Termékek (Products) kezelőpanel — szigetelt blokk a fő tabhoz.
 *
 * Csak prop-okon át kap adatot — a CRUD műveleteket a hívó (App.tsx) végzi.
 */
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Plus, Upload, MagnifyingGlass } from '@phosphor-icons/react'
import { ProductsTable } from '@/components/ProductsTable'
import type { Product, Order } from '@/lib/types'

export interface ProductsPanelProps {
  filteredProducts: Product[]
  orders: Order[] | null | undefined
  productSearchQuery: string
  setProductSearchQuery: (q: string) => void
  setProductBulkImportDialogOpen: (open: boolean) => void
  handleNewProduct: () => void
  handleEditProduct: (id: string) => void
  handleDeleteProduct: (id: string) => void
  handleBulkDeleteProducts: (ids: string[]) => void
}

export function ProductsPanel({
  filteredProducts,
  orders,
  productSearchQuery,
  setProductSearchQuery,
  setProductBulkImportDialogOpen,
  handleNewProduct,
  handleEditProduct,
  handleDeleteProduct,
  handleBulkDeleteProducts,
}: ProductsPanelProps) {
  return (
    <TabsContent value="products" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Termékek</h2>
          <p className="text-muted-foreground">Termék adatok kezelése</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setProductBulkImportDialogOpen(true)}>
            <Upload className="w-5 h-5 mr-2" />
            Tömeges Import
          </Button>
          <Button onClick={handleNewProduct}>
            <Plus className="w-5 h-5 mr-2" />
            Új Termék
          </Button>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Keresés ügyfél, termék név, rajzszám, cikkszám vagy anyag szerint..."
          value={productSearchQuery}
          onChange={(e) => setProductSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ProductsTable
        products={filteredProducts}
        orders={orders || []}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onBulkDelete={handleBulkDeleteProducts}
      />
    </TabsContent>
  )
}
