import { useEffect, useRef, useState, useMemo } from 'react'
import { Order, Customer, Product } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateOwnOrderNumber, parseIntSafe, stripDiacritics } from '@/lib/helpers'
import { computeAutoFieldsForOrder } from '@/lib/orderService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MagnifyingGlass, Check } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface OrderDialogProps {
  open: boolean
  onClose: () => void
  onSave: (orderData: Partial<Order>) => void
  order: Order | null
  customers: Customer[]
  products: Product[]
  orders: Order[]
}

function dateToYMD(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  // YYYY-MM-DD formátum (ISO 8601)
  return `${y}-${m}-${d}`
}

function ymdToInputDate(ymd: string): string {
  if (!ymd) return ''
  // Régi formátum: YYYY/MM/DD — új formátum: YYYY-MM-DD (mindkettő elfogadott)
  const parts = ymd.split(/[\/\-]/)
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function inputDateToYMD(value: string): string {
  // Az input[type=date] értéke már YYYY-MM-DD — visszaadjuk változtatás nélkül
  return value || ''
}

export function OrderDialog({ open, onClose, onSave, order, customers, products, orders }: OrderDialogProps) {
  const [formData, setFormData] = useState<Partial<Order>>({
    customer: '',
    productName: '',
    designation: '',
    notes: '',
    pos: null,
    ownOrderNumber: generateOwnOrderNumber(orders),
    material: '',
    orderNumber: '',
    amountPc: 0,
    orderDate: dateToYMD(new Date()),
    requiredDate: dateToYMD(new Date()),
    pickupDate: '',
    surfaceTreatment: '',
    boxesCount: null,
    palletsCount: null,
    grossWeightKg: '',
    requiredMaterialKg: '',
    plannedProductionHours: '',
    deliveryNote: '',
    cmr: '',
    status: 'Felvéve',
  })

  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [showProductList, setShowProductList] = useState(false)
  // Mező melletti hibaüzenetek a kötelező vevő/termék mezőkhöz + piszkos-űrlap
  // védelem: félrekoppintásra/Esc-re ne vesszen el szó nélkül a kitöltött űrlap.
  const [fieldErrors, setFieldErrors] = useState<{ customer?: string; product?: string }>({})
  const initialFormRef = useRef('')

  // A két kereső-legördülő dobozának külső kerete — ehhez mérjük, hogy a
  // kattintás/koppintás kívülre esett-e (akkor zárjuk a listát).
  const customerBoxRef = useRef<HTMLDivElement>(null)
  const productBoxRef = useRef<HTMLDivElement>(null)

  // Kívülre koppintás → zárás. Touch eszközön (tablet) ettől nem ragad ott a
  // lenyíló lista. Esc szintén zár.
  useEffect(() => {
    if (!showCustomerList && !showProductList) return
    const handlePointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (showCustomerList && customerBoxRef.current && !customerBoxRef.current.contains(t)) {
        setShowCustomerList(false)
      }
      if (showProductList && productBoxRef.current && !productBoxRef.current.contains(t)) {
        setShowProductList(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCustomerList(false)
        setShowProductList(false)
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showCustomerList, showProductList])

  const customerOptions = useMemo(() => {
    const names = customers.map(c => c.name.trim()).filter(Boolean)
    const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'hu'))
    
    if (!customerSearchQuery) return unique
    
    const query = stripDiacritics(customerSearchQuery)
    return unique.filter(name => stripDiacritics(name).includes(query))
  }, [customers, customerSearchQuery])

  const productOptions = useMemo(() => {
    if (!formData.customer) return []
    
    const customerProducts = products.filter(
      p => p.customer.trim() === formData.customer?.trim()
    )

    const allOptions = customerProducts.map(p => ({
      // A `value` a Product.id — egyedi és stabil. A label a felhasználónak
      // megjelenített név (vagy rajzszám), a `drawingNumber` / `productName`
      // pedig a `handleProductSelect` által a formra másolt mezők.
      id: p.id,
      label: p.productName || p.drawingNumber || '(nincs név)',
      value: p.id,
      drawingNumber: p.drawingNumber,
      productName: p.productName,
      material: p.material,
      notes: p.notes,
    }))

    if (!productSearchQuery) return allOptions

    const query = stripDiacritics(productSearchQuery)
    return allOptions.filter(p => 
      stripDiacritics(p.productName).includes(query) ||
      stripDiacritics(p.drawingNumber).includes(query)
    )
  }, [formData.customer, products, productSearchQuery])

  useEffect(() => {
    const next: Partial<Order> = order ?? {
      customer: '',
      productName: '',
      designation: '',
      notes: '',
      pos: null,
      ownOrderNumber: generateOwnOrderNumber(orders),
      material: '',
      orderNumber: '',
      amountPc: 0,
      orderDate: dateToYMD(new Date()),
      requiredDate: dateToYMD(new Date()),
      pickupDate: '',
      surfaceTreatment: '',
      boxesCount: null,
      palletsCount: null,
      grossWeightKg: '',
      requiredMaterialKg: '',
      plannedProductionHours: '',
      deliveryNote: '',
      cmr: '',
      status: 'Felvéve',
    }
    setFormData(next)
    initialFormRef.current = JSON.stringify(next)
    setFieldErrors({})
    setCustomerSearchQuery('')
    setProductSearchQuery('')
    setShowCustomerList(false)
    setShowProductList(false)
  }, [order, open, orders])

  /** Bezárás-kérés: kitöltött (piszkos) űrlapnál megerősítést kér. */
  const requestClose = () => {
    const dirty = JSON.stringify(formData) !== initialFormRef.current
    if (dirty && !window.confirm('Elveted a módosításokat?')) return
    onClose()
  }

  const handleCustomerSelect = (customerName: string) => {
    setFormData({
      ...formData,
      customer: customerName,
      // Vevőváltáskor a termékhivatkozást is nulláznunk kell, különben
      // ott marad a régi vevő terméke az új vevő alatt — ami a
      // `findProductForOrder`-en keresztül később false-positive találatot adna.
      productId: undefined,
      productName: '',
      designation: '',
      material: '',
      notes: '',
    })
    setShowCustomerList(false)
    setCustomerSearchQuery('')
    setProductSearchQuery('')
    setFieldErrors((prev) => ({ ...prev, customer: undefined }))
  }

  const handleProductSelect = (productValue: string) => {
    const product = productOptions.find(p => p.value === productValue)
    if (!product) return

    setFormData(prev => ({
      ...prev,
      // Erős hivatkozás a master-termékre. Ezt használja a `findProductForOrder`,
      // hogy a gyártás-kártyán mindig a *valódi* termékadat jelenjen meg.
      productId: product.id,
      productName: product.drawingNumber || '',
      designation: product.productName || '',
      material: product.material || prev.material || '',
      notes: product.notes || prev.notes || '',
    }))
    setShowProductList(false)
    setProductSearchQuery('')
    setFieldErrors((prev) => ({ ...prev, product: undefined }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Kötelező mezők: a csillag eddig csak dísz volt — begépelt, de ki nem
    // választott vevőnél a formData.customer üres, és a rendelés vevő nélkül
    // jönne létre (utána egyetlen vevő-alapú szűrésben sem található).
    const errors: { customer?: string; product?: string } = {}
    if (!formData.customer) errors.customer = 'Válassz vevőt a listából!'
    if (!formData.productName) errors.product = 'Válassz terméket a listából!'
    if (errors.customer || errors.product) {
      setFieldErrors(errors)
      return
    }

    const autoFields = computeAutoFieldsForOrder(
      formData.customer || '',
      formData.productName || '',
      formData.amountPc || 0,
      products
    )

    onSave({
      ...formData,
      ...autoFields,
      updatedAt: new Date().toISOString(),
      createdAt: order?.createdAt || new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose() }}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{order ? 'Rendelés Szerkesztése' : 'Új Rendelés'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-6 pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Vevő *</Label>
                {order ? (
                  <Input
                    id="customer"
                    value={formData.customer}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <div className="relative" ref={customerBoxRef}>
                    <div className="relative">
                      <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        placeholder="Keresés vevő neve szerint..."
                        value={formData.customer || customerSearchQuery}
                        onChange={(e) => {
                          setCustomerSearchQuery(e.target.value)
                          setFormData({ ...formData, customer: '' })
                          setShowCustomerList(true)
                        }}
                        onFocus={() => setShowCustomerList(true)}
                        onKeyDown={(e) => {
                          // Enter a keresőben: ne süsse el a formot (üres vevővel
                          // mentene) — helyette az első találatot választja ki.
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (customerOptions.length > 0) handleCustomerSelect(customerOptions[0])
                          }
                        }}
                        className="pl-10"
                      />
                    </div>
                    {showCustomerList && (
                      <Card className="absolute z-50 w-full mt-1 max-h-[300px] overflow-hidden">
                        <ScrollArea className="h-[300px]">
                          <div className="p-1">
                            {customerOptions.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">Nincs találat</div>
                            ) : (
                              customerOptions.map((name) => (
                                <div
                                  key={name}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-sm",
                                    formData.customer === name && "bg-accent"
                                  )}
                                  onClick={() => handleCustomerSelect(name)}
                                >
                                  {formData.customer === name && <Check className="w-4 h-4" />}
                                  <span className={cn(formData.customer !== name && "ml-6")}>{name}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </Card>
                    )}
                  </div>
                )}
                {fieldErrors.customer && (
                  <p className="text-sm text-destructive" role="alert">{fieldErrors.customer}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">Termék (rajzszám/név alapján) *</Label>
                {order ? (
                  <Input
                    id="productName"
                    value={formData.productName}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <div className="relative" ref={productBoxRef}>
                    <div className="relative">
                      <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={formData.customer ? "Keresés termék neve vagy rajzszáma szerint..." : "Előbb válassz vevőt"}
                        value={formData.productName || productSearchQuery}
                        onChange={(e) => {
                          setProductSearchQuery(e.target.value)
                          setFormData({ ...formData, productName: '' })
                          setShowProductList(true)
                        }}
                        onFocus={() => formData.customer && setShowProductList(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (productOptions.length > 0) handleProductSelect(productOptions[0].value)
                          }
                        }}
                        className="pl-10"
                        disabled={!formData.customer}
                      />
                    </div>
                    {showProductList && formData.customer && (
                      <Card className="absolute z-50 w-full mt-1 max-h-[300px] overflow-hidden">
                        <ScrollArea className="h-[300px]">
                          <div className="p-1">
                            {productOptions.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">Nincs találat</div>
                            ) : (
                              productOptions.map((p) => {
                                // A kijelölést elsődlegesen a productId alapján
                                // mutatjuk; ha az nincs (régi rendelés szerkesztésekor),
                                // visszaesünk a régi név-alapú összevetésre.
                                const isSelected = formData.productId
                                  ? formData.productId === p.id
                                  : formData.productName === p.drawingNumber
                                return (
                                  <div
                                    key={p.id}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-sm",
                                      isSelected && "bg-accent"
                                    )}
                                    onClick={() => handleProductSelect(p.value)}
                                  >
                                    {isSelected && <Check className="w-4 h-4" />}
                                    <div className={cn(!isSelected && "ml-6")}>
                                      <div>{p.label}</div>
                                      {p.drawingNumber && <div className="text-xs text-muted-foreground">Rajzszám: {p.drawingNumber}</div>}
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </ScrollArea>
                      </Card>
                    )}
                  </div>
                )}
                {fieldErrors.product && (
                  <p className="text-sm text-destructive" role="alert">{fieldErrors.product}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="designation">Megnevezése</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  disabled={!!order}
                  className={order ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Megjegyzés</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pos">Pos (pozíció)</Label>
                <Input
                  id="pos"
                  type="number"
                  inputMode="numeric"
                  value={formData.pos ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    setFormData({ ...formData, pos: raw === '' ? null : parseIntSafe(raw, 0, { allowNegative: false }) })
                  }}
                  min={0}
                  placeholder="pl. 1, 2, 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownOrderNumber">Saját rendelési szám (automatikus)</Label>
                <Input
                  id="ownOrderNumber"
                  value={formData.ownOrderNumber}
                  disabled
                  className="bg-muted font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="material">Anyag</Label>
                <Input
                  id="material"
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderNumber">Vevő rendelési száma *</Label>
                <Input
                  id="orderNumber"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  required
                  placeholder="Vevő által adott rendelési szám"
                  disabled={!!order}
                  className={order ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountPc">Mennyiség (db)</Label>
                <Input
                  id="amountPc"
                  type="number"
                  inputMode="numeric"
                  value={formData.amountPc || ''}
                  onChange={(e) => setFormData({ ...formData, amountPc: parseIntSafe(e.target.value, 0, { allowNegative: false }) })}
                  min={0}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderDate">Rendelés dátuma *</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={ymdToInputDate(formData.orderDate || '')}
                  onChange={(e) => setFormData({ ...formData, orderDate: inputDateToYMD(e.target.value) })}
                  required
                  disabled={!!order}
                  className={order ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requiredDate">Kért szállítási határidő *</Label>
                <Input
                  id="requiredDate"
                  type="date"
                  value={ymdToInputDate(formData.requiredDate || '')}
                  onChange={(e) => setFormData({ ...formData, requiredDate: inputDateToYMD(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickupDate">CMR / Szállítólevél kiállítási dátuma</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={ymdToInputDate(formData.pickupDate || '')}
                  onChange={(e) => setFormData({ ...formData, pickupDate: inputDateToYMD(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={requestClose}>
                Mégse
              </Button>
              <Button type="submit">
                {order ? 'Frissítés' : 'Létrehozás'}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
