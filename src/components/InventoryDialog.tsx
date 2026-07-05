import { useState, useEffect, useMemo } from 'react'
import { InventoryItem, Product } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { CaretUpDown, Check } from '@phosphor-icons/react'
import { parseIntSafe, stripDiacritics } from '@/lib/helpers'

interface InventoryDialogProps {
  open: boolean
  onClose: () => void
  onSave: (item: Partial<InventoryItem>) => void
  item: InventoryItem | null
  products: Product[]
}

export function InventoryDialog({ open, onClose, onSave, item, products }: InventoryDialogProps) {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    productId: '',
    productName: '',
    drawingNumber: '',
    customer: '',
    quantity: 0,
    itemType: 'termek',
    location: '',
    notes: '',
  })

  useEffect(() => {
    if (item) {
      setFormData(item)
    } else {
      setFormData({
        productId: '',
        productName: '',
        drawingNumber: '',
        customer: '',
        quantity: 0,
        itemType: 'termek',
        location: '',
        notes: '',
      })
    }
  }, [item, open])

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setFormData(prev => ({
        ...prev,
        productId: product.id,
        productName: product.productName,
        drawingNumber: product.drawingNumber,
        customer: product.customer,
      }))
    }
  }

  // ── Kereshető termékválasztó ──
  // Sok termék esetén a sima legördülő használhatatlan — itt ékezet-független
  // keresés megy rajzszámra, névre és vevőre; max. 50 találat jelenik meg.
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const selectedProduct = products.find(p => p.id === formData.productId)

  const filteredProducts = useMemo(() => {
    const q = stripDiacritics(productQuery)
    if (!q) return products.slice(0, 50)
    return products
      .filter(
        p =>
          stripDiacritics(p.drawingNumber).includes(q) ||
          stripDiacritics(p.productName).includes(q) ||
          stripDiacritics(p.customer).includes(q)
      )
      .slice(0, 50)
  }, [products, productQuery])

  const handleSubmit = () => {
    onSave({
      ...formData,
      lastUpdated: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Készlet tétel szerkesztése' : 'Új készlet tétel'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="product-select">Termék kiválasztása</Label>
            <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="product-select"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productPickerOpen}
                  className="justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedProduct
                      ? `${selectedProduct.drawingNumber} – ${selectedProduct.productName} (${selectedProduct.customer})`
                      : 'Válassz terméket… (szerszámnál/alapanyagnál nem kötelező)'}
                  </span>
                  <CaretUpDown className="w-4 h-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Keresés: rajzszám, név, vevő…"
                    value={productQuery}
                    onValueChange={setProductQuery}
                  />
                  <CommandList>
                    <CommandEmpty>Nincs találat.</CommandEmpty>
                    {filteredProducts.map(product => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => {
                          handleProductSelect(product.id)
                          setProductPickerOpen(false)
                          setProductQuery('')
                        }}
                      >
                        <Check className={`w-4 h-4 ${formData.productId === product.id ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="font-mono text-xs">{product.drawingNumber || '—'}</span>
                        <span className="truncate">{product.productName}</span>
                        <span className="text-muted-foreground text-xs truncate ml-auto">{product.customer}</span>
                      </CommandItem>
                    ))}
                    {filteredProducts.length === 50 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Az első 50 találat látszik — szűkítsd a keresést.
                      </div>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="drawing-number">Rajzszám</Label>
              <Input
                id="drawing-number"
                value={formData.drawingNumber || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, drawingNumber: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-name">Termék neve</Label>
              <Input
                id="product-name"
                value={formData.productName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="customer">Vevő</Label>
              <Input
                id="customer"
                value={formData.customer || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity">Mennyiség ({formData.itemType === 'alapanyag' ? 'kg' : 'db'})</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                inputMode="numeric"
                value={formData.quantity || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseIntSafe(e.target.value, 0, { allowNegative: false }) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="item-type">Típus</Label>
              <Select
                value={formData.itemType || 'termek'}
                onValueChange={(v) => setFormData(prev => ({ ...prev, itemType: v as InventoryItem['itemType'] }))}
              >
                <SelectTrigger id="item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="termek">Kész termék</SelectItem>
                  <SelectItem value="szerszam">Szerszám</SelectItem>
                  <SelectItem value="alapanyag">Alapanyag</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Raktár hely</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="pl. A-2-3 (állvány-szint-rekesz)"
              />
              <p className="text-xs text-muted-foreground">
                Az „állvány-szint-rekesz" formátumú kód (pl. A-2-3) a Polc nézetben vizuálisan is megjelenik.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Megjegyzés</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Megjegyzés..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handleSubmit}>
            {item ? 'Mentés' : 'Létrehozás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
