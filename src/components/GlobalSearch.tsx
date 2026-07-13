import { useEffect, useMemo, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Package, User, Wrench, ArrowRight } from '@phosphor-icons/react'
import { stripDiacritics } from '@/lib/helpers'
import type { Order, Customer, Product } from '@/lib/types'

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: Order[]
  customers: Customer[]
  products: Product[]
  onOpenOrder: (id: string) => void
  onOpenCustomer: (id: string) => void
  onOpenProduct: (id: string) => void
  onNavigate: (tab: string) => void
}

const MAX_PER_GROUP = 6

/**
 * Globális gyorskereső (Ctrl/Cmd+K). Egy helyről kereshető rendelés, vevő és
 * termék — kiválasztáskor megnyílik a szerkesztő, vagy a megfelelő fülre ugrik.
 * A szűrés ékezet-független (a cmdk beépített szűrője nem az) → shouldFilter=false.
 */
export function GlobalSearch({
  open,
  onOpenChange,
  orders,
  customers,
  products,
  onOpenOrder,
  onOpenCustomer,
  onOpenProduct,
  onNavigate,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const q = stripDiacritics(query)

  const orderHits = useMemo(() => {
    if (!q) return orders.slice(0, MAX_PER_GROUP)
    return orders
      .filter(
        (o) =>
          stripDiacritics(o.ownOrderNumber).includes(q) ||
          stripDiacritics(o.orderNumber).includes(q) ||
          stripDiacritics(o.customer).includes(q) ||
          stripDiacritics(o.productName).includes(q) ||
          stripDiacritics(o.designation).includes(q)
      )
      .slice(0, MAX_PER_GROUP)
  }, [orders, q])

  const customerHits = useMemo(() => {
    if (!q) return customers.slice(0, MAX_PER_GROUP)
    return customers
      .filter(
        (c) =>
          stripDiacritics(c.name).includes(q) ||
          stripDiacritics(c.city).includes(q) ||
          stripDiacritics(c.taxNumber).includes(q)
      )
      .slice(0, MAX_PER_GROUP)
  }, [customers, q])

  const productHits = useMemo(() => {
    if (!q) return products.slice(0, MAX_PER_GROUP)
    return products
      .filter(
        (p) =>
          stripDiacritics(p.productName).includes(q) ||
          stripDiacritics(p.drawingNumber).includes(q) ||
          stripDiacritics(p.customer).includes(q) ||
          stripDiacritics(p.articleNumber).includes(q)
      )
      .slice(0, MAX_PER_GROUP)
  }, [products, q])

  const run = (fn: () => void) => {
    onOpenChange(false)
    setQuery('')
    // A dialógus záródása után futtatjuk, hogy ne ütközzön a focus-kezeléssel.
    setTimeout(fn, 0)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldFilter={false}
      title="Gyorskereső"
      description="Rendelés, vevő vagy termék keresése"
    >
      <CommandInput
        placeholder="Keresés rendelés, vevő, termék között…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nincs találat.</CommandEmpty>

        {orderHits.length > 0 && (
          <CommandGroup heading="Rendelések">
            {orderHits.map((o) => (
              <CommandItem
                key={o.id}
                value={`order-${o.id}`}
                onSelect={() => run(() => onOpenOrder(o.id))}
              >
                <Package className="w-4 h-4 text-muted-foreground" weight="duotone" />
                <span className="font-mono text-xs">{o.ownOrderNumber || o.orderNumber || '—'}</span>
                <span className="truncate">{o.customer} · {o.productName || o.designation}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {customerHits.length > 0 && (
          <CommandGroup heading="Vevők">
            {customerHits.map((c) => (
              <CommandItem
                key={c.id}
                value={`customer-${c.id}`}
                onSelect={() => run(() => onOpenCustomer(c.id))}
              >
                <User className="w-4 h-4 text-muted-foreground" weight="duotone" />
                <span className="truncate">{c.name}</span>
                {c.city && <span className="text-xs text-muted-foreground truncate">{c.city}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {productHits.length > 0 && (
          <CommandGroup heading="Termékek">
            {productHits.map((p) => (
              <CommandItem
                key={p.id}
                value={`product-${p.id}`}
                onSelect={() => run(() => onOpenProduct(p.id))}
              >
                <Wrench className="w-4 h-4 text-muted-foreground" weight="duotone" />
                <span className="font-mono text-xs">{p.drawingNumber || '—'}</span>
                <span className="truncate">{p.productName} · {p.customer}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ugrás">
          {[
            { tab: 'dashboard', label: 'Áttekintés' },
            { tab: 'production', label: 'Gyártás' },
            { tab: 'orders', label: 'Rendelések' },
            { tab: 'inventory', label: 'Készlet' },
            { tab: 'reports', label: 'Riportok' },
          ].map((t) => (
            <CommandItem key={t.tab} value={`nav-${t.tab}`} onSelect={() => run(() => onNavigate(t.tab))}>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span>{t.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
