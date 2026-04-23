import { useState, useEffect } from 'react'
import { InventoryItem, Product } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
            <Select
              value={formData.productId}
              onValueChange={handleProductSelect}
            >
              <SelectTrigger id="product-select">
                <SelectValue placeholder="Válassz terméket..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.drawingNumber} - {product.productName} ({product.customer})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="quantity">Mennyiség (db)</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Raktár hely</Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="pl. A1-polc-3"
            />
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
