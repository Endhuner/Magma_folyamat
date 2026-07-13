/**
 * Az EREDETI hivatalos dokumentumok kitöltése — nem újraépítés.
 *
 *  - MOHU gyűjtőhelyi szállítólevél: az eredeti Excel (public/templates/mohu.xlsx)
 *    változó celláiba írjuk az adatokat ExcelJS-szel; minden formázás, képlet,
 *    összevont cella és a „Specifikáció segédlet" munkalap megmarad.
 *  - Intermetal fémleadó nyilatkozat: az eredeti PDF (public/templates/intermetal.pdf)
 *    fölé rajzoljuk a szöveget + a kategória „X"-et pdf-lib-bel (a PDF-ben nincs
 *    kitölthető űrlapmező, ezért koordinátás ráírás).
 *
 * A koordináták/cellák az eredeti fájlokból mértük ki; ha valami elcsúszna,
 * itt egy helyen hangolható.
 */

/** WinAnsi (pdf-lib szabvány betű) nem ismeri a magyar kettős ékezeteket
 *  (ő/ű) — ezeket ö/ü-re fokozzuk le, hogy a PDF-ráírás ne dobjon hibát. */
function toWinAnsi(s: string): string {
  return s.replace(/ő/g, 'ö').replace(/ű/g, 'ü').replace(/Ő/g, 'Ö').replace(/Ű/g, 'Ü')
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------- MOHU (Excel)

export interface MohuFillData {
  date: string            // YYYY-MM-DD
  transportMode: 'Begyűjtés' | 'Áttárolás'
  orderNumber?: string
  vehiclePlate?: string
  trailerPlate?: string
  netQuantity?: string    // nettó mennyiség (kg)
  wasteName?: string      // hulladék specifikáció megnevezés (J33) — opcionális felülírás
}

export async function fillMohuXlsx(d: MohuFillData): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJS = await import('exceljs')
  const res = await fetch('/templates/mohu.xlsx')
  if (!res.ok) throw new Error('MOHU sablon nem található (public/templates/mohu.xlsx).')
  const buf = await res.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.getWorksheet('Szállítólevél')
  if (!ws) throw new Error('MOHU sablon: hiányzik a „Szállítólevél" munkalap.')

  // Dátum — UTC dél, hogy az időzóna ne csússzon egy napot vissza
  if (d.date) {
    const [y, m, dd] = d.date.split('-').map(Number)
    ws.getCell('C5').value = new Date(Date.UTC(y, m - 1, dd, 12))
  }
  if (d.orderNumber) ws.getCell('C33').value = d.orderNumber          // Megrendelés száma
  if (d.vehiclePlate) ws.getCell('N23').value = d.vehiclePlate        // Jármű rendszám
  if (d.trailerPlate) ws.getCell('N24').value = d.trailerPlate        // Pótkocsi rendszám
  if (d.netQuantity) ws.getCell('T33').value = Number(d.netQuantity) || d.netQuantity
  if (d.wasteName) ws.getCell('J33').value = d.wasteName              // Hulladék megnevezés

  // Szállítás módja — jelölőnégyzetek (a Wingdings-glyph törékeny, ezért
  // egyértelmű Unicode ballot-boxszal írjuk felül a cellát).
  const box = (on: boolean) => (on ? '☒' : '☐')
  ws.getCell('H27').value =
    `${box(d.transportMode === 'Begyűjtés')} Begyűjtés    ${box(d.transportMode === 'Áttárolás')} Áttárolás`

  const out = await wb.xlsx.writeBuffer()
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  return { blob, fileName: `MOHU_szallitolevel_${d.date || 'kitoltes'}.xlsx` }
}

export async function fillAndDownloadMohu(d: MohuFillData): Promise<void> {
  const { blob, fileName } = await fillMohuXlsx(d)
  download(blob, fileName)
}

// ------------------------------------------------------------ Intermetal (PDF)

/** Az eredeti PDF kategória-felsorolása a golyó („o") függőleges pozíciójával
 *  (pdfplumber „top", A4 = 841.9 pt magas). Az „X" a golyó mellé kerül (x≈89). */
export const INTERMETAL_CATEGORIES: Array<{ label: string; top: number }> = [
  { label: 'Építési-bontási hulladék', top: 418 },
  { label: 'Kiterjesztett gyártói felelősségi rendszeren kívüli gyártásközi hulladék', top: 429 },
  { label: 'Elektromos, elektronikus berendezések hulladéka', top: 454 },
  { label: 'Elem, akkumulátor hulladék', top: 468 },
  { label: 'Gépjármű (M1/N1 kategória, háromkerekű)', top: 480 },
  { label: 'Egyéb, gépjárműbontásból származó hulladék', top: 548 },
  { label: 'Csomagolási hulladék', top: 559 },
  { label: 'Elkülönítetten gyűjtött intézményi hulladék', top: 571 },
  { label: 'Egyéb, a fentiek alá nem sorolható hulladék', top: 584 },
]

export interface IntermetalFillData {
  docNumber?: string      // szállítólevél / okmány száma
  signerName?: string     // aláíró neve (Alulírott …)
  date?: string           // YYYY-MM-DD
  category: string        // a kiválasztott kategória label-je (INTERMETAL_CATEGORIES)
}

export async function fillIntermetalPdf(d: IntermetalFillData): Promise<{ blob: Blob; fileName: string }> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const res = await fetch('/templates/intermetal.pdf')
  if (!res.ok) throw new Error('Intermetal sablon nem található (public/templates/intermetal.pdf).')
  const buf = await res.arrayBuffer()
  const pdf = await PDFDocument.load(buf)
  const page = pdf.getPages()[0]
  const { height: H } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const draw = (text: string, x: number, top: number, size = 11) =>
    page.drawText(toWinAnsi(text), { x, y: H - top - size + 1, size, font })

  if (d.docNumber) draw(d.docNumber, 345, 180)          // okmány száma (pontsor)
  if (d.signerName) draw(d.signerName, 112, 227)        // Alulírott …
  if (d.date) draw(`Kelt: ${d.date}`, 64, 690, 10)      // aláírás-sor mellett balra

  const cat = INTERMETAL_CATEGORIES.find((c) => c.label === d.category)
  if (cat) draw('X', 89, cat.top, 11)                   // kategória-jelölés a „o" mellé

  const bytes = await pdf.save()
  const blob = new Blob([bytes.slice()], { type: 'application/pdf' })
  return { blob, fileName: `Intermetal_nyilatkozat_${d.date || 'kitoltes'}.pdf` }
}

export async function fillAndDownloadIntermetal(d: IntermetalFillData): Promise<void> {
  const { blob, fileName } = await fillIntermetalPdf(d)
  download(blob, fileName)
}
