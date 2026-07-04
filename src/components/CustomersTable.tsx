import { memo } from 'react'
import { Customer, Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { PencilSimple, Trash, UserCircle, ClockCounterClockwise, EnvelopeSimple } from '@phosphor-icons/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { EntityHistoryDialog } from '@/components/EntityHistoryDialog'

interface CustomersTableProps {
  customers: Customer[]
  orders: Order[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function CustomersTableImpl({ customers, orders, onEdit, onDelete }: CustomersTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (customerToDelete) {
      onDelete(customerToDelete)
      setCustomerToDelete(null)
    }
    setDeleteDialogOpen(false)
  }

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer)
    setHistoryDialogOpen(true)
  }

  const getCustomerOrders = (customerName: string) => {
    return orders.filter(o => o.customer === customerName)
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <UserCircle className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
        <h3 className="text-xl font-semibold mb-2">Nincs vevő</h3>
        <p className="text-muted-foreground max-w-md">
          Kezdje el az új vevő létrehozásával
        </p>
      </div>
    )
  }

  return (
    <>

      <Card className="w-full">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Vevő Név</TableHead>
                  <TableHead className="min-w-[150px]">Szállító Nyelve</TableHead>
                  <TableHead className="min-w-[150px]">Város</TableHead>
                  <TableHead className="min-w-[120px]">Irányítószám</TableHead>
                  <TableHead className="min-w-[200px]">Utca, Házszám</TableHead>
                  <TableHead className="min-w-[120px]">Ország</TableHead>
                  <TableHead className="min-w-[250px]">Cím</TableHead>
                  <TableHead className="min-w-[150px]">Adószám</TableHead>
                  <TableHead className="min-w-[200px]">E-mail</TableHead>
                  <TableHead className="text-right min-w-[120px] sticky right-0 bg-card">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer, index) => (
                  <TableRow key={customer.id} className="even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]">
                    <TableCell className="font-medium min-w-[200px]">{customer.name}</TableCell>
                    <TableCell className="min-w-[150px]">{customer.language}</TableCell>
                    <TableCell className="min-w-[150px]">{customer.city}</TableCell>
                    <TableCell className="font-mono min-w-[120px]">{customer.postalCode}</TableCell>
                    <TableCell className="min-w-[200px]">{customer.street}</TableCell>
                    <TableCell className="min-w-[120px]">{customer.country}</TableCell>
                    <TableCell className="min-w-[250px]">{customer.fullAddress}</TableCell>
                    <TableCell className="font-mono min-w-[150px]">{customer.taxNumber}</TableCell>
                    <TableCell className="min-w-[200px]">
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex items-center gap-1 text-primary hover:underline text-sm"
                          title={customer.email}
                        >
                          <EnvelopeSimple className="w-4 h-4 shrink-0" />
                          {customer.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right min-w-[120px] sticky right-0 bg-card">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewHistory(customer)}
                          title="Rendelési előzmények"
                        >
                          <ClockCounterClockwise className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(customer.id)}
                        >
                          <PencilSimple className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick(customer.id)}
                        >
                          <Trash className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törli a vevőt?</AlertDialogTitle>
            <AlertDialogDescription>
              Ez a művelet nem visszavonható. A vevő véglegesen törlésre kerül.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>
              Mégse
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedCustomer && (
        <EntityHistoryDialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          entityName={selectedCustomer.name}
          entityType="customer"
          relatedOrders={getCustomerOrders(selectedCustomer.name)}
        />
      )}
    </>
  )
}

export const CustomersTable = memo(CustomersTableImpl)
