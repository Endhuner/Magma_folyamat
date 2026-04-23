import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Product } from '@/lib/types'

interface ProductDialogProps {
  open: boolean
  onClose: () => void
  onSave: (product: Partial<Product>) => void
  product: Product | null
}

export function ProductDialog({ open, onClose, onSave, product }: ProductDialogProps) {
  const [formData, setFormData] = useState({
    customer: '',
    drawingNumber: '',
    productName: '',
    notes: '',
    nestCount: '',
    weightPerPiece: '',
    material: '',
    surfaceTreatment: '',
    cycleTime: '',
    postProcessingTime: '',
    postProcessing: '',
    boxSize: '',
    piecesPerBox: '',
    boxesPerPallet: '',
    articleNumber: '',
    warehouse: '',
    spruWeight: '',
  })

  useEffect(() => {
    if (product) {
      setFormData({
        customer: product.customer || '',
        drawingNumber: product.drawingNumber || '',
        productName: product.productName || '',
        notes: product.notes || '',
        nestCount: product.nestCount || '',
        weightPerPiece: product.weightPerPiece || '',
        material: product.material || '',
        surfaceTreatment: product.surfaceTreatment || '',
        cycleTime: product.cycleTime || '',
        postProcessingTime: product.postProcessingTime || '',
        postProcessing: product.postProcessing || '',
        boxSize: product.boxSize || '',
        piecesPerBox: product.piecesPerBox || '',
        boxesPerPallet: product.boxesPerPallet || '',
        articleNumber: product.articleNumber || '',
        warehouse: product.warehouse || '',
        spruWeight: product.spruWeight || '',
      })
    } else {
      setFormData({
        customer: '',
        drawingNumber: '',
        productName: '',
        notes: '',
        nestCount: '',
        weightPerPiece: '',
        material: '',
        surfaceTreatment: '',
        cycleTime: '',
        postProcessingTime: '',
        postProcessing: '',
        boxSize: '',
        piecesPerBox: '',
        boxesPerPallet: '',
        articleNumber: '',
        warehouse: '',
        spruWeight: '',
      })
    }
  }, [product, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const productData: Partial<Product> = {
      ...formData,
      updatedAt: new Date().toISOString(),
    }
    if (!product) {
      productData.createdAt = new Date().toISOString()
    }
    onSave(productData)
    onClose()
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Termék szerkesztése' : 'Új termék'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Ügyfél</Label>
              <Input
                id="customer"
                value={formData.customer}
                onChange={(e) => handleChange('customer', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawingNumber">Termék rajzszáma</Label>
              <Input
                id="drawingNumber"
                value={formData.drawingNumber}
                onChange={(e) => handleChange('drawingNumber', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productName">Termék megnevezés</Label>
            <Input
              id="productName"
              value={formData.productName}
              onChange={(e) => handleChange('productName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Megjegyzés</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nestCount">Fészekszáma</Label>
              <Input
                id="nestCount"
                value={formData.nestCount}
                onChange={(e) => handleChange('nestCount', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightPerPiece">Súly/db</Label>
              <Input
                id="weightPerPiece"
                value={formData.weightPerPiece}
                onChange={(e) => handleChange('weightPerPiece', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material">Anyag</Label>
              <Input
                id="material"
                value={formData.material}
                onChange={(e) => handleChange('material', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surfaceTreatment">Felületkezelés</Label>
              <Input
                id="surfaceTreatment"
                value={formData.surfaceTreatment}
                onChange={(e) => handleChange('surfaceTreatment', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cycleTime">Ciklus idő</Label>
              <Input
                id="cycleTime"
                value={formData.cycleTime}
                onChange={(e) => handleChange('cycleTime', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postProcessingTime">Utómunka idő</Label>
              <Input
                id="postProcessingTime"
                value={formData.postProcessingTime}
                onChange={(e) => handleChange('postProcessingTime', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postProcessing">Utómunkák</Label>
            <Textarea
              id="postProcessing"
              value={formData.postProcessing}
              onChange={(e) => handleChange('postProcessing', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="boxSize">Doboz méret</Label>
              <Input
                id="boxSize"
                value={formData.boxSize}
                onChange={(e) => handleChange('boxSize', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="piecesPerBox">Doboz/db</Label>
              <Input
                id="piecesPerBox"
                value={formData.piecesPerBox}
                onChange={(e) => handleChange('piecesPerBox', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="boxesPerPallet">Doboz/Raklap</Label>
              <Input
                id="boxesPerPallet"
                value={formData.boxesPerPallet}
                onChange={(e) => handleChange('boxesPerPallet', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="articleNumber">Arktikál nr.</Label>
              <Input
                id="articleNumber"
                value={formData.articleNumber}
                onChange={(e) => handleChange('articleNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Raktár</Label>
              <Input
                id="warehouse"
                value={formData.warehouse}
                onChange={(e) => handleChange('warehouse', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spruWeight">Engusz súly</Label>
            <Input
              id="spruWeight"
              value={formData.spruWeight}
              onChange={(e) => handleChange('spruWeight', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit">
              {product ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
