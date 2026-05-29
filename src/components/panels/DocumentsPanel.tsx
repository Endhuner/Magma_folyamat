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
import { Funnel, CaretDown, Plus, FilePdf, EnvelopeSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useState } from 'react'
import { DeliveryNotesTable } from '@/components/DeliveryNotesTable'
import { AuditLogView } from '@/components/AuditLogView'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  handlePreviewNote: (note: DeliveryNote) => void | Promise<void>
  handleEmailNote: (note: DeliveryNote, ccEmails?: string) => void
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
  handlePreviewNote,
  handleEmailNote,
}: DocumentsPanelProps) {
  const [ccEmails, setCcEmails] = useState<Record<string, string>>({})

  return (
    <TabsContent value="documents" className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Dokumentumok</h2>
        <p className="text-muted-foreground">Szállítólevelek, CMR-ek és változásnapló</p>
      </div>

      <Tabs defaultValue="delivery-notes" className="w-full">
        <TabsList>
          <TabsTrigger value="delivery-notes">Szállítólevelek és CMR</TabsTrigger>
          <TabsTrigger value="levelezés">Levelezés</TabsTrigger>
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

        <TabsContent value="levelezés" className="space-y-4 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Levelezés</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Szállítólevelek és CMR dokumentumok PDF-ben való elküldése. Kattints a <strong>PDF megnyitás</strong> gombra, majd a megnyíló ablakban nyomtasd/mentsd el PDF-ként, ezután küld el a <strong>Email küldés</strong> gombbal.
            </p>
          </div>

          {(deliveryNotes || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nincs még kiállított dokumentum.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Típus</th>
                    <th className="text-left p-3 font-medium">Sorszám</th>
                    <th className="text-left p-3 font-medium">Vevő / Email</th>
                    <th className="text-left p-3 font-medium">Dátum</th>
                    <th className="text-left p-3 font-medium">CC (másolatot kap)</th>
                    <th className="text-right p-3 font-medium">Műveletek</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(deliveryNotes || [])]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((note) => {
                      const customer = (customers || []).find(c => c.name === note.customer)
                      const hasEmail = !!customer?.email
                      return (
                        <tr key={note.id} className="border-t hover:bg-muted/30">
                          <td className="p-3">
                            <Badge variant={note.type === 'cmr' ? 'default' : 'secondary'}>
                              {note.type === 'cmr' ? 'CMR' : 'Szállítólevél'}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">{note.sequenceNumber}</td>
                          <td className="p-3">
                            <div>{note.customer}</div>
                            {customer?.email && (
                              <div className="text-xs text-muted-foreground">{customer.email}</div>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {note.issueDate || note.exportDate?.slice(0, 10) || note.createdAt.slice(0, 10)}
                          </td>
                          <td className="p-3">
                            <Input
                              className="h-8 text-xs w-48"
                              placeholder="cc@example.com, cc2@..."
                              value={ccEmails[note.id] || ''}
                              onChange={e => setCcEmails(prev => ({ ...prev, [note.id]: e.target.value }))}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePreviewNote(note)}
                                title="PDF megnyitás nyomtatáshoz"
                              >
                                <FilePdf className="w-4 h-4 mr-1" />
                                PDF megnyitás
                              </Button>
                              <Button
                                size="sm"
                                variant={hasEmail ? 'default' : 'outline'}
                                onClick={() => {
                                  if (!hasEmail) {
                                    toast.error(`${note.customer} vevőhöz nincs email cím megadva`)
                                    return
                                  }
                                  handleEmailNote(note, ccEmails[note.id] || undefined)
                                }}
                                title={hasEmail ? `Email küldés: ${customer?.email}` : 'Nincs email cím a vevőnél'}
                              >
                                <EnvelopeSimple className="w-4 h-4 mr-1" />
                                Email küldés
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit-log" className="space-y-6 mt-6">
          <AuditLogView entries={auditLog || []} />
        </TabsContent>
      </Tabs>
    </TabsContent>
  )
}
