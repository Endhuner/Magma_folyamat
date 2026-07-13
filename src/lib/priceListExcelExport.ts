/**
 * Vevői árlista XLSX-export — a Systec-Excel oszlopaival, hogy a lista
 * közvetlenül küldhető legyen a vevőnek.
 */
import { buildProductIndex, calcPriceListItem, resolveItemSource } from '@/lib/materialPriceCalc'
import type { PriceList, Product } from '@/lib/types'

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadPriceListXlsx(pl: PriceList, products: Product[] = []): Promise<void> {
  // Megnevezés + súly élőben a terméktörzsből (cikkszám-egyezésnél).
  const productIndex = buildProductIndex(products)
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Aktuelle Preise ${new Date().getFullYear()}`)

  ws.addRow([`Aktuelle Teilepreise — ${pl.customerName}`])
  ws.getRow(1).font = { bold: true, size: 14 }
  ws.addRow([])
  const header = ws.addRow([
    'Teile Nr.', 'Artikel Bezeichnung', 'Losgröße', 'Gewicht / g',
    `Abbrand ${Math.round(pl.burnRate * 100)}%`, 'MPB kg €', 'aktueller MP kg €',
    'Grundpreis 100 St €', 'Diff. durch MP per kg', 'Diff+Abbrand / kg',
    'Preis-Diff. / 100 St', 'Aktueller Preis / 100 St €',
  ])
  header.font = { bold: true }

  for (const item of pl.items) {
    const src = resolveItemSource(item, pl.customerName, productIndex)
    const weightG = src.weightG ?? 0
    const r = calcPriceListItem(
      { weightG, basePricePer100Eur: item.basePricePer100Eur ?? 0 },
      pl,
    )
    ws.addRow([
      item.partNumber, src.name, item.lotSize ?? '', weightG || '',
      weightG > 0 ? r.diffPerKg * pl.burnRate : '',
      pl.mpbEurPerKg, pl.currentMpEurPerKg,
      item.basePricePer100Eur ?? '', r.diffPerKg, r.diffWithBurnPerKg,
      r.correctionPer100Eur, r.currentPricePer100Eur,
    ])
  }

  ws.columns.forEach((c, i) => { c.width = i <= 1 ? 24 : 14 })
  const buffer = await wb.xlsx.writeBuffer()
  const safe = pl.customerName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'arlista'
  downloadBuffer(buffer as ArrayBuffer, `Aktuelle_Preise_${safe}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
