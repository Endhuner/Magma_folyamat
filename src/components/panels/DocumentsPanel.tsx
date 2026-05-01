/**
 * Dokumentumok kezelőpanel — szállítólevelek, CMR-ek és változásnapló
 * (audit log) egy szigetelt blokkban.
 *
 * Felelőssége:
 *  - belső al-tabok ("delivery-notes" + "audit-log") rendereléseElement
 *  - oszlop-szűrők (`documentFilters`) választása / létrehozása / törlése
 *  - listázza a `DeliveryNotesTable`-t a szűrt oszlopokkal
 *  - megjeleníti az `AuditLogView` változásnaplót
 *
 * Architektúra: csak prop-ok, nincs közvetlen DB-elérés. A delete/update
 * műveleteket a hívó által átadott handler-ek végzik (App.tsx-ben dexie-be írnak).
 */
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Funnel, CaretDown, Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { DeliveryNotesTable } from '@/components/DeliveryNotesTable'
import { AuditLogView } from '@/components/AuditLogView'
import type {
  Order,
  Customer,
  Product,
  DeliveryNote,
  AuditLogEntry,
} from '@/lib/types'

export interface DocumentFilter {
  id: string
  name: string
  columns: string[]
}

export interface DocumentsPanelProps {
  /** Mentett oszlop-szűrők — localStorage-ban élnek (kis méret). */
  documentFilters: DocumentFilter[] | null | undefined
  setDocumentFilters: (
    updater: (current: DocumentFilter[] | null | undefined) => DocumentFilter[]
  ) => void
  activeFilterId: string | null
  setActiveFilterId: (id: string | null) => void
  setNewFilterDialogOpen: (open: boolean) => void

  /** Olvasandó adatok a szállítólevél tábla feltöltéséhez. */
  deliveryNotes: DeliveryNote[] | null | undefined
  orders: Order[] | null | undefined
  customers: Customer[] | null | undefined
  products: Product[] | null | undefined
  auditLog: AuditLogEntry[] | null | undefined

  /** Műveletek — a hívó (App.tsx) IndexedDB-be / state-be ír. */
  handleDeleteDeliveryNote: (id: string) => void
  handleUpdateDeliveryNote: (
    id: string,
    updatedData: Record<string, string | number | null | undefined>[]
  ) => void
}

export function DocumentsPanel({
  documentFilters,
  setDocumentFilters,
  activeFilterId,
  setActiveFilterId,
  setNewFilterDialogOpen,
  deliveryNotes,
  orders,
  customers,
  products,
  auditLog,
  handleDeleteDeliveryNote,
  handleUpdateDeliveryNote,
}: DocumentsPanelProps) {
  return (
    <TabsContent value="documents" className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Dokumentumok</h2>
        <p className="text-muted-foreground">Szállítólevelek, CMR-ek és változásnapló</p>
      </div>

      <Tabs defaultValue="delivery-notes" className="w-full">
        <TabsList>
          <TabsTrigger value="delivery-notes">Szállítólevelek és CMR</TabsTrigger>
          <TabsTrigger value="audit-log">Változások</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery-notes" className="space-y-6 mt-6">
          <div className="flex items-end justify-end">
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Funnel className="w-4 h-4" />
                    {activeFilterId
                      ? documentFilters?.find((f) => f.id === activeFilterId)?.name ||
                        'Szűrő választás'
                      : 'Szűrő választás'}
                    <CaretDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setActiveFilterId(null)}>
                    Összes oszlop (alapértelmezett)
                  </DropdownMenuItem>
                  {(documentFilters || []).map((filter) => (
                    <DropdownMenuItem
                      key={filter.id}
                      onSelect={() => setActiveFilterId(filter.id)}
                    >
                      {filter.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="secondary" onClick={() => setNewFilterDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Új szűrő
              </Button>

              {activeFilterId && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDocumentFilters((current) =>
                      (current || []).filter((f) => f.id !== activeFilterId)
                    )
                    setActiveFilterId(null)
                    toast.success('Szűrő törölve')
                  }}
                >
                  Szűrő törlése
                </Button>
              )}
            </div>
          </div>

          <DeliveryNotesTable
            deliveryNotes={deliveryNotes || []}
            orders={orders || []}
            customers={customers || []}
            products={products || []}
            onDelete={handleDeleteDeliveryNote}
            onUpdate={handleUpdateDeliveryNote}
            visibleColumns={
              activeFilterId
                ? documentFilters?.find((f) => f.id === activeFilterId)?.columns
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="audit-log" className="space-y-6 mt-6">
          <AuditLogView entries={auditLog || []} />
        </TabsContent>
      </Tabs>
    </TabsContent>
  )
}
