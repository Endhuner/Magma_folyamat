import { Order, Product } from './types'

function parseNumberLoose(x: string | number | null | undefined): number | null {
  if (x == null) return null
  const s = String(x).trim()
  if (!s) return null

  const cleaned = s
    .replace(/db|mp|g|kg|ora|óra/gi, '')
    .replace(/\s/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/,/g, '')

  const m = cleaned.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function round1(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

function fmtKg1(n: number | null): string {
  const r = round1(n)
  if (r == null) return ''
  return `${r.toFixed(1)} kg`
}

function fmtHours0(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return ''
  return `${Math.round(n)} óra`
}

export function computeBoxesCount(rendeltDb: number, dbDoboz?: string): number | null {
  const rendelt = parseNumberLoose(rendeltDb)
  const perBox = parseNumberLoose(dbDoboz)
  if (rendelt == null) return null
  if (perBox == null || perBox <= 0) return null
  return Math.ceil(rendelt / perBox)
}

export function computePalletsCount(boxesCount: number | null, dobozRaklap?: string): number | null {
  const boxes = parseNumberLoose(boxesCount)
  const boxPerPallet = parseNumberLoose(dobozRaklap)
  if (boxes == null) return null
  if (boxPerPallet == null || boxPerPallet <= 0) return null
  return Math.ceil(boxes / boxPerPallet)
}

export function computeRequiredMaterialKg(
  rendeltDb: number,
  weightPerPcG?: string
): string {
  const rendelt = parseNumberLoose(rendeltDb)
  const weightG = parseNumberLoose(weightPerPcG)
  if (rendelt == null) return ''
  if (weightG == null) return ''
  
  const kg = (rendelt * weightG) / 1000
  return fmtKg1(kg)
}

export function computeGrossWeightKg(
  rendeltDb: number,
  weightPerPcG?: string,
  palletsCount?: number | null
): string {
  const rendelt = parseNumberLoose(rendeltDb)
  const weightG = parseNumberLoose(weightPerPcG)
  
  if (rendelt == null || weightG == null) return ''
  
  const termekKg = (rendelt * weightG) / 1000

  const raklapTaraKg = 20

  const pallets = palletsCount || 0
  const raklapSuly = pallets * raklapTaraKg
  
  const osszBrutto = termekKg + raklapSuly
  
  return fmtKg1(osszBrutto)
}

export function computePlannedProductionHours(
  rendeltDb: number,
  beallitasIdoPerc: number | undefined,
  ciklusidoMpDb?: string,
  feszekszam?: string
): string {
  const rendelt = parseNumberLoose(rendeltDb)
  const beallitas = beallitasIdoPerc || 0
  const ciklus = parseNumberLoose(ciklusidoMpDb)
  const feszek = parseNumberLoose(feszekszam) || 1

  if (rendelt == null) return ''
  if (ciklus == null) return ''

  // ((rendelt × ciklus) / fészekszám) / 3600
  const futasIdoMp = (rendelt * ciklus) / feszek
  const tervezettIdoOra = (beallitas * 60 + futasIdoMp) / 3600

  return fmtHours0(tervezettIdoOra)
}

export function computeAutoFieldsForOrder(
  customer: string,
  productName: string,
  amountPc: number,
  products: Product[]
): {
  surfaceTreatment: string
  material: string
  boxesCount: number | null
  palletsCount: number | null
  requiredMaterialKg: string
  grossWeightKg: string
  plannedProductionHours: string
} {
  const product = products.find(
    p => p.customer.trim() === customer.trim() && 
    (p.drawingNumber.trim() === productName.trim() || p.productName.trim() === productName.trim())
  )

  if (!product) {
    return {
      surfaceTreatment: '',
      material: '',
      boxesCount: null,
      palletsCount: null,
      requiredMaterialKg: '',
      grossWeightKg: '',
      plannedProductionHours: '',
    }
  }

  const boxesCount = computeBoxesCount(amountPc, product.piecesPerBox)
  const palletsCount = computePalletsCount(boxesCount, product.boxesPerPallet)
  
  const requiredMaterialKg = computeRequiredMaterialKg(amountPc, product.weightPerPiece)
  
  const grossWeightKg = computeGrossWeightKg(
    amountPc,
    product.weightPerPiece,
    palletsCount
  )
  
  const plannedProductionHours = computePlannedProductionHours(amountPc, undefined, product.cycleTime, product.nestCount)

  return {
    surfaceTreatment: product.surfaceTreatment || '',
    material: product.material || '',
    boxesCount,
    palletsCount,
    requiredMaterialKg,
    grossWeightKg,
    plannedProductionHours,
  }
}

/**
 * Dinamikusan számolja a tervezett gyártási időt egy rendeléshez
 * a termék aktuális adatai (ciklusidő, fészekszám) alapján.
 * Ha a termék nem található, a rendelésen tárolt értéket adja vissza tartalékként.
 */
export function getPlannedHoursForOrder(order: Order, products: Product[]): string {
  const product = products.find(
    p => p.customer.trim() === order.customer.trim() &&
      (p.drawingNumber.trim() === order.productName.trim() ||
       p.productName.trim() === order.productName.trim() ||
       p.drawingNumber.trim() === order.designation.trim() ||
       p.productName.trim() === order.designation.trim())
  )
  if (!product) return order.plannedProductionHours || ''
  return computePlannedProductionHours(order.amountPc, undefined, product.cycleTime, product.nestCount)
}
