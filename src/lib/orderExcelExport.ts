/**
 * Rendelés Excel export / import sablon
 *
 * downloadOrderImportTemplate() — letölti az üres import sablont a helyes
 *   fejlécekkel és néhány példasorral, hogy az import dialog azonnal
 *   értse a fájlt.
 *
 * exportOrdersToExcel(orders, filename?) — exportálja a megadott rendelés-
 *   tömböt Excel formátumba, az összes mezővel, fejléccel és alapformázással.
 */
import ExcelJS from 'exceljs'
import type { Order } from '@/lib/types'

// ─── Oszlop definíciók (fejléc label + Order mező neve) ──────────────────────

interface ColDef {
  header: string
  key: keyof Order | 'none'
  width: number
  /** Megjegyzés a sablon fejlécéhez */
  note?: string
}

// Dátum oszlop fejlécek — ezeket szövegként kell formázni,
// hogy Excel ne konvertálja automatikusan dátum-típusra.
const DATE_HEADERS = new Set([
  'Order date (year/month/day)',
  'Required date (year/month/day)',
  'Actual pickup date (year/month/day)',
])

const COLUMNS: ColDef[] = [
  { header: 'Pos',                                    key: 'pos',                    width: 6  },
  { header: 'Customer',                               key: 'customer',               width: 20 },
  { header: 'Megnevezése',                            key: 'productName',            width: 22, note: 'Rajzszám / terméknév' },
  { header: 'Megjelölés',                             key: 'designation',            width: 20 },
  { header: 'Anyag',                                  key: 'material',               width: 14 },
  { header: 'Rendelési szám',                         key: 'orderNumber',            width: 18 },
  { header: 'Saját rendelési szám',                   key: 'ownOrderNumber',         width: 20 },
  { header: 'Mennyiség db',                           key: 'amountPc',               width: 14, note: 'Egész szám' },
  { header: 'Order date (year/month/day)',            key: 'orderDate',              width: 22, note: 'ÉÉÉÉ-HH-NN formátum, pl. 2025-04-01' },
  { header: 'Required date (year/month/day)',         key: 'requiredDate',           width: 24, note: 'Határidő. ÉÉÉÉ-HH-NN formátum, pl. 2025-04-30' },
  { header: 'Actual pickup date (year/month/day)',    key: 'pickupDate',             width: 28, note: 'Tényleges átvétel. ÉÉÉÉ-HH-NN formátum' },
  { header: 'Szállításra kész',                       key: 'ready',                  width: 16 },
  { header: 'Felületkezelés',                         key: 'surfaceTreatment',       width: 16 },
  { header: 'Össz raklapok száma',                    key: 'palletsCount',           width: 18, note: 'Egész szám' },
  { header: 'Szükséges anyag kg',                     key: 'requiredMaterialKg',     width: 18, note: 'Szám, pl. 12.5' },
  { header: 'Bruttó súly kg',                         key: 'grossWeightKg',          width: 15, note: 'Szám, pl. 25.0' },
  { header: 'Tervezett gyártási órák',                key: 'plannedProductionHours', width: 22 },
  { header: 'Szállítólevél',                          key: 'deliveryNote',           width: 14 },
  { header: 'CMR',                                    key: 'cmr',                    width: 12 },
  { header: 'Status',                                 key: 'status',                 width: 16, note: 'Felvéve / Folyamatban / Előkészítve / Csomagolás alatt / Kiszállítva / Szünetel / Javítás alatt' },
  { header: 'Notes',                                  key: 'notes',                  width: 30 },
]

// ─── Segédfüggvény: mai dátum YYYY-MM-DD ─────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Blob letöltő ─────────────────────────────────────────────────────────────

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 200)
}

// ─── Közös munkalap-felépítő ───────────────────────────────────────────────────

function buildSheet(ws: ExcelJS.Worksheet, rows: Record<string, unknown>[]) {
  ws.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width,
    // Dátum oszlopok szövegként — megakadályozza, hogy Excel automatikusan
    // dátum-típusra konvertálja a ÉÉÉÉ-HH-NN formátumú stringeket.
    style: DATE_HEADERS.has(c.header) ? { numFmt: '@' } : undefined,
  }))

  // Fejléc sor formázása
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  headerRow.alignment = { vertical: 'middle', wrapText: true }
  headerRow.height = 32

  // Fejléc megjegyzések
  COLUMNS.forEach((col, i) => {
    if (col.note) {
      const cell = ws.getRow(1).getCell(i + 1)
      cell.note = col.note
    }
  })

  // Adatsorok
  rows.forEach((row, ri) => {
    const wsRow = ws.addRow(row)
    wsRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: ri % 2 === 0 ? 'FFEEF2FA' : 'FFFFFFFF' },
    }
    wsRow.alignment = { vertical: 'middle' }
    wsRow.height = 20

    // Dátum cellák explicit szöveg-típus beállítása soronként
    COLUMNS.forEach((col, ci) => {
      if (DATE_HEADERS.has(col.header)) {
        const cell = wsRow.getCell(ci + 1)
        const val = cell.value
        if (val !== null && val !== undefined && val !== '') {
          cell.value = String(val)
          cell.numFmt = '@'
        }
      }
    })
  })

  // Szegélyek az összes cellán
  const lastRow = 1 + rows.length
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= COLUMNS.length; c++) {
      ws.getRow(r).getCell(c).border = {
        top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
      }
    }
  }

  // Ablaktábla rögzítése (fejléc sor mindig látszik)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

// ─── Sablon letöltése ─────────────────────────────────────────────────────────

export async function downloadOrderImportTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ProduktívPro'
  wb.created = new Date()

  const ws = wb.addWorksheet('Rendelések')

  const exampleRows: Record<string, unknown>[] = [
    {
      'Pos': 1,
      'Customer': 'Példa Kft.',
      'Megnevezése': 'PELDASZ-001',
      'Megjelölés': 'Alkatrész A',
      'Anyag': 'Acél',
      'Rendelési szám': 'REN-2025-001',
      'Saját rendelési szám': 'SAJAT-001',
      'Mennyiség db': 100,
      'Order date (year/month/day)': todayStr(),
      'Required date (year/month/day)': '',
      'Actual pickup date (year/month/day)': '',
      'Szállításra kész': '',
      'Felületkezelés': 'Festés',
      'Össz raklapok száma': 2,
      'Szükséges anyag kg': 50.5,
      'Bruttó súly kg': 60,
      'Tervezett gyártási órák': '8',
      'Szállítólevél': '',
      'CMR': '',
      'Status': 'Felvéve',
      'Notes': 'Példa megjegyzés',
    },
    {
      'Pos': 2,
      'Customer': 'Másik Zrt.',
      'Megnevezése': 'MASIKRAJ-042',
      'Megjelölés': 'Szerkezeti elem',
      'Anyag': 'Alumínium',
      'Rendelési szám': 'REN-2025-002',
      'Saját rendelési szám': '',
      'Mennyiség db': 50,
      'Order date (year/month/day)': todayStr(),
      'Required date (year/month/day)': '',
      'Actual pickup date (year/month/day)': '',
      'Szállításra kész': '',
      'Felületkezelés': '',
      'Össz raklapok száma': 1,
      'Szükséges anyag kg': 20,
      'Bruttó súly kg': 25,
      'Tervezett gyártási órák': '4',
      'Szállítólevél': '',
      'CMR': '',
      'Status': 'Felvéve',
      'Notes': '',
    },
  ]

  buildSheet(ws, exampleRows)

  // Második lap: útmutató
  const wsGuide = wb.addWorksheet('Útmutató')
  wsGuide.getColumn(1).width = 30
  wsGuide.getColumn(2).width = 50

  const guideData = [
    ['Mező', 'Leírás'],
    ['Pos', 'Pozíció / prioritás szám (opcionális egész)'],
    ['Customer', 'Vevő neve (kötelező)'],
    ['Megnevezése', 'Rajzszám (kötelező)'],
    ['Megjelölés', 'Termék megnevezés'],
    ['Anyag', 'Alapanyag'],
    ['Rendelési szám', 'Vevő rendelési száma'],
    ['Saját rendelési szám', 'Belső rendelési szám'],
    ['Mennyiség db', 'Egész szám, pl. 100'],
    ['Order date (year/month/day)', 'Rendelési dátum ÉÉÉÉ-HH-NN formátumban, pl. 2025-04-01'],
    ['Required date (year/month/day)', 'Határidő ÉÉÉÉ-HH-NN formátumban, pl. 2025-04-30'],
    ['Actual pickup date (year/month/day)', 'Tényleges átvétel dátuma, ÉÉÉÉ-HH-NN formátum'],
    ['Status', 'Felvéve | Folyamatban | Előkészítve | Csomagolás alatt | Kiszállítva | Szünetel | Javítás alatt'],
    ['Notes', 'Szabad szöveges megjegyzés'],
  ]

  const guideHeaderRow = wsGuide.addRow(guideData[0])
  guideHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  guideHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }

  for (let i = 1; i < guideData.length; i++) {
    const row = wsGuide.addRow(guideData[i])
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFEEF2FA' : 'FFFFFFFF' },
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, 'rendeles_import_sablon.xlsx')
}

// ─── Rendelések exportálása ───────────────────────────────────────────────────

export async function exportOrdersToExcel(
  orders: Order[],
  filename?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ProduktívPro'
  wb.created = new Date()

  const ws = wb.addWorksheet('Rendelések')

  const rows: Record<string, unknown>[] = orders.map((o) => ({
    'Pos':                                     o.pos ?? '',
    'Customer':                                o.customer,
    'Megnevezése':                             o.productName,
    'Megjelölés':                              o.designation,
    'Anyag':                                   o.material,
    'Rendelési szám':                          o.orderNumber,
    'Saját rendelési szám':                    o.ownOrderNumber,
    'Mennyiség db':                            o.amountPc,
    'Order date (year/month/day)':             o.orderDate,
    'Required date (year/month/day)':          o.requiredDate,
    'Actual pickup date (year/month/day)':     o.pickupDate,
    'Szállításra kész':                        o.ready,
    'Felületkezelés':                          o.surfaceTreatment,
    'Össz raklapok száma':                     o.palletsCount ?? '',
    'Szükséges anyag kg':                      o.requiredMaterialKg,
    'Bruttó súly kg':                          o.grossWeightKg,
    'Tervezett gyártási órák':                 o.plannedProductionHours,
    'Szállítólevél':                           o.deliveryNote,
    'CMR':                                     o.cmr,
    'Status':                                  o.status,
    'Notes':                                   o.notes,
  }))

  buildSheet(ws, rows)

  const outputName = filename ?? `rendeles_export_${todayStr()}.xlsx`
  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, outputName)
}
