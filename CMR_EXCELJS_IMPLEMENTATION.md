# CMR ExcelJS Implementáció

## Áttekintés

A CMR dokumentum generálás mostantól teljes mértékben **ExcelJS**-t használ sablonok helyett. Ez modern, kód-alapú megközelítés a dokumentum létrehozáshoz.

## Fő Előnyök

### 1. Sablon Függetlenség
- ❌ **Régi módszer**: Külső .xltx sablon fájl szükséges a /public mappában
- ✅ **Új módszer**: Minden a kódban van, nincs külső függőség

### 2. Teljes Kontroll
- Programozottan beállítható minden formázás
- Dinamikus tartalomgenerálás feltételes logikával
- Professional Excel kimenetek natív formázással

### 3. Egyszerűbb Karbantartás
- Egyetlen forrás fájl: `src/lib/cmrDirectExport.ts`
- Verziókezelés könnyű
- Nincs sablon szinkronizálási probléma

### 4. Megbízhatóság
- Nincs sablon betöltési hiba
- Nincs fájl nem található hiba
- Minden környezetben azonosan működik

## Implementációs Részletek

### Fő Fájl: cmrDirectExport.ts

```typescript
export async function generateCmrDirectExport(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  onExportSaved?: (deliveryNote: Partial<DeliveryNote>, deliveryNoteNumber?: string) => void,
  userSettings?: CmrLayoutSettings
)
```

### Generálási Folyamat

1. **Munkafüzet létrehozása**
   ```typescript
   const workbook = new ExcelJS.Workbook()
   const worksheet = workbook.addWorksheet('CMR')
   ```

2. **Fejléc formázás**
   - Cím cellák egyesítése
   - Betűtípus beállítása (méret, vastagság, szín)
   - Sorszám jobb felső sarokban

3. **Feladó adatok**
   - Név, cím, város, ország
   - Adószám
   - Telefon és email (opcionális)
   - Aláhúzott szakasz címek

4. **Átvevő adatok**
   - Vevő adatai az adatbázisból
   - Teljes cím formázva
   - Városról és országról külön sorok

5. **Szállítási információk**
   - Áru átvételének helye és dátuma
   - Kiszállítás helye
   - Fuvarozó információk (ha megadva)

6. **Termék táblázat**
   - Fejléc sor kék háttérrel, fehér szöveggel
   - Keretes cellák minden sorban
   - Központozott numerikus adatok
   - Összegzés sor szürke háttérrel, vastag betűvel

7. **Aláírási blokk**
   - Kiállítás helye és dátuma
   - Aláírás mezők

8. **Export és mentés**
   - Buffer generálás
   - Blob létrehozás megfelelő MIME típussal
   - Automatikus letöltés
   - Adatbázisba mentés metaadatokkal

## Formázási Lehetőségek

### Betűtípus
```typescript
cell.font = { 
  bold: true,
  size: 12, 
  color: { argb: 'FFFFFFFF' },
  underline: true,
  italic: true
}
```

### Háttérszín
```typescript
cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0066CC' }
}
```

### Keretek
```typescript
cell.border = {
  top: { style: 'medium' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
}
```

### Igazítás
```typescript
cell.alignment = { 
  horizontal: 'center', 
  vertical: 'middle',
  wrapText: true 
}
```

### Cellák egyesítése
```typescript
worksheet.mergeCells('A1:K1')
```

## Beállítások (CMR Settings Dialog)

A felhasználók testreszabhatják:

### Feladó Információk
- Név
- Cím
- Város
- Ország
- Adószám
- Telefon
- Email

### Szállítási Helyek
- Áru átvételének helye
- Kiállítás helye

### Fuvarozó
- Név
- Cím
- Jármű rendszám

Ezek az értékek a `cmr-layout-settings` kulcs alatt tárolódnak a useKV-ben.

## Automatizmusok

### Sorszámozás
```typescript
const sequenceNumber = generateDeliveryNoteSequenceNumber(deliveryNotes, 'cmr')
// Eredmény: CMR-20240115-0001
```

### Fájlnév generálás
```typescript
const fileName = `${sequenceNumber}_${safeCustomerName}.xlsx`
// Eredmény: CMR-20240115-0001_VevoNev.xlsx
```

### Összegzések
- Összes darabszám
- Összes dobozszám
- Összes raklap
- Összes bruttó súly (automatikus számítás)

### Dokumentum mentés
- Automatikus hozzáadás a delivery notes listához
- Order kapcsolás (deliveryNoteNumber mező kitöltése)
- Metaadatok tárolása (fájlnév, dátum, exportált adatok)

## Kód Struktúra

### 1. Validálás
```typescript
if (!orders.length) {
  toast.error('Nincsenek exportálandó rendelések')
  return
}
```

### 2. Vevő adatok lekérése
```typescript
const customerInfo = customers.find(c => c.name === firstCustomer)
const fullAddress = customerInfo?.fullAddress || ...
```

### 3. Munkafüzet összeállítás
- Fejléc
- Feladó blokk
- Átvevő blokk
- Szállítási információk
- Termék táblázat
- Összegzés
- Aláírási blokk

### 4. Export végrehajtás
```typescript
const buffer = await workbook.xlsx.writeBuffer()
const blob = new Blob([buffer], { type: '...' })
// Letöltés trigger
```

### 5. Callback végrehajtás
```typescript
if (onExportSaved) {
  onExportSaved({
    type: 'cmr',
    customer: firstCustomer,
    orderIds: orders.map(o => o.id),
    fileName,
    exportDate,
    exportData,
  }, sequenceNumber)
}
```

## Testreszabási Útmutató

### Új mező hozzáadása

1. **Adjon hozzá egy új sort:**
   ```typescript
   worksheet.getCell('A15').value = 'Új mező címke'
   worksheet.getCell('B15').value = ujMezőÉrtéke
   ```

2. **Formázza a cellát:**
   ```typescript
   worksheet.getCell('A15').font = { bold: true }
   ```

### Táblázat módosítása

1. **Új oszlop hozzáadása a headers tömböz:**
   ```typescript
   const headers = [
     'Termék név',
     'Mennyiség',
     'ÚJ OSZLOP'  // <- Új
   ]
   ```

2. **Adjon hozzá adatot az orders ciklusban:**
   ```typescript
   row.getCell(8).value = order.ujMezo || ''
   ```

### Színséma módosítása

```typescript
// Fejléc háttérszíne
fgColor: { argb: 'FF0066CC' }  // Kék -> módosítható

// Összegzés háttérszíne  
fgColor: { argb: 'FFE7E6E6' }  // Világosszürke -> módosítható
```

## Hibakezelés

```typescript
try {
  // Generálás
  const buffer = await workbook.xlsx.writeBuffer()
  // ...
  toast.success(`CMR létrehozva!`)
} catch (error) {
  console.error('CMR export hiba:', error)
  toast.error('CMR export sikertelen: ' + error.message)
}
```

## Tesztelés

### Manuális teszt lépések:
1. Válassz ki rendeléseket (egy vevőhöz)
2. Kattints a CMR gombra
3. Ellenőrizd:
   - Fájl automatikus letöltése
   - Helyes sorszám
   - Helyes vevő adatok
   - Termékek megjelennek
   - Összegzés helyes
   - Dokumentum lista frissül
   - Rendeléseknél megjelenik a szállítólevél szám

### Érvényesítési pontok:
- ✅ Sorszám egyedi és növekvő
- ✅ Vevő adatok helytállóak
- ✅ Termékek mind megjelennek
- ✅ Számítások helyesek
- ✅ Formázás professional
- ✅ Metaadatok mentődnek

## Kapcsolódó Fájlok

- **Fő logika**: `src/lib/cmrDirectExport.ts`
- **Típusok**: `src/lib/types.ts`
- **Beállítások**: `src/lib/cmrTemplateBuilder.ts` (CmrLayoutSettings)
- **Beállítások UI**: `src/components/CmrSettingsDialog.tsx`
- **Hívás**: `src/App.tsx` (handleExportCmr)

## Összegzés

Az ExcelJS-alapú CMR generálás modern, megbízható és rugalmas megoldás. Nincs külső sablon függőség, minden programozottan kontrollálható, és könnyű karbantartani és testreszabni.
