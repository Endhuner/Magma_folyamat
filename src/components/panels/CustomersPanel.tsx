/**
 * Vevők (Customers) kezelőpanel — szigetelt blokk a fő tabhoz.
 *
 * Csak prop-okon át kap adatot — a CRUD műveleteket a hívó (App.tsx) végzi.
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Upload, MagnifyingGlass } from '@phosphor-icons/react'
import { CustomersTable } from '@/components/CustomersTable'
import type { Customer, Order } from '@/lib/types'

export interface CustomersPanelProps {
  filteredCustomers: Customer[]
  orders: Order[] | null | undefined
  customerSearchQuery: string
  setCustomerSearchQuery: (q: string) => void
  setBulkImportDialogOpen: (open: boolean) => void
  handleNewCustomer: () => void
  handleEditCustomer: (id: string) => void
  handleDeleteCustomer: (id: string) => void
}

export function CustomersPanel({
  filteredCustomers,
  orders,
  customerSearchQuery,
  setCustomerSearchQuery,
  setBulkImportDialogOpen,
  handleNewCustomer,
  handleEditCustomer,
  handleDeleteCustomer,
}: CustomersPanelProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Vevők</h2>
          <p className="text-muted-foreground">Vevői adatok kezelése</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setBulkImportDialogOpen(true)}>
            <Upload className="w-5 h-5 mr-2" />
            Tömeges Import
          </Button>
          <Button onClick={handleNewCustomer}>
            <Plus className="w-5 h-5 mr-2" />
            Új Vevő
          </Button>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Keresés név, város, ország, irányítószám vagy adószám szerint..."
          value={customerSearchQuery}
          onChange={(e) => setCustomerSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <CustomersTable
        customers={filteredCustomers}
        orders={orders || []}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
      />
    </section>
  )
}
