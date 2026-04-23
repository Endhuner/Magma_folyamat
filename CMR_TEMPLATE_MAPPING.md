# CMR Sablon Helyettesítő Változók

Ez a dokumentum részletezi a CMR sablon (Cmr.xls) generálásához használt helyettesítő változókat.

## Cellahivatkozások és Helyettesítő Változók

A következő cellákba kerülnek be az adatok a CMR sablonba:

### Kötelező CMR Mezők

| Cella | Változó Neve | Leírás | Forrás |
|-------|--------------|--------|--------|
| **K1** | `deliveryNoteNumber` | Szállítólevél száma | Automatikusan generált sorszám |
| **A6** | `consigneeName` | Címzett (Vevő) neve | Rendelésből: `customer` |
| **A7** | `consigneeAddress` | Címzett teljes címe | Vevő adatbázisból: `utca, irányítószám, város, ország` |
| **B12** | `consigneeCity` | Címzett városa | Vevő adatbázisból: `city` |
| **B13** | `consigneeCountry` | Címzett országa | Vevő adatbázisból: `country` |

### További Helyettesítő Változók

A sablon az `xlsx-template` könyvtárat használja, amely a következő formátumot támogatja: `${változónév}`

| Változó | Leírás | Példa |
|---------|--------|-------|
| `senderName` | Feladó (cég) neve | "Magma Kft" |
| `senderAddress` | Feladó címe | "H-1211 Budapest, Déli utca 13." |
| `senderTaxNumber` | Feladó adószáma | "HU10368152-2-43" |
| `consigneeTaxNumber` | Címzett adószáma | Vevő adatbázisból |
| `marksAndNumbers` | Jel és szám (6. mező) | Termék rajzszáma |
| `numberOfPackages` | Darabszám (7. mező) | Dobozok száma összesen |
| `methodOfPacking` | Csomagolás (8. mező) | "X doboz, Y raklap" |
| `natureOfGoods` | Áru megnevezése (9. mező) | Termék megnevezése |
| `grossWeightKg` | Bruttósúly kg (11. mező) | Összes bruttó súly |
| `placeIssued` | Kiállítás helye (21. mező) | "Budapest" |
| `dateIssued` | Kiállítás dátuma (21. mező) | Aktuális dátum |
| `ownOrderNumber` | Saját rendelési szám | M25-1-001 |
| `customerOrderNumber` | Vevő rendelési száma | Rendelésből |

## Adatforrások

### 1. Rendelés (Order) táblából
- `customer` - Vevő neve
- `orderNumber` - Vevő rendelési száma
- `ownOrderNumber` - Saját rendelési szám
- `productName` - Termék neve
- `designation` - Termék megnevezése
- `boxesCount` - Dobozok száma
- `palletsCount` - Raklapok száma
- `grossWeightKg` - Bruttó súly

### 2. Vevők (Customer) táblából
- `name` - Vevő neve
- `street` - Utca, házszám
- `city` - Város
- `postalCode` - Irányítószám
- `country` - Ország
- `taxNumber` - Adószám

### 3. Termékek (Product) táblából
- `drawingNumber` - Termék rajzszáma
- `productName` - Termék neve

## Használat a Kódban

A `xlsxTemplateExport.ts` fájlban található `buildCmrTemplateValues` függvény készíti el a helyettesítő változókat:

```typescript
const baseValues: Record<string, string | number> = {
  K1: deliveryNoteNumber,
  A6: consigneeName,
  A7: consigneeFullAddress,
  B12: consigneeCity,
  B13: consigneeCountry,
  // ... további változók
}
```

A `generateCmrTemplateWorkbook` függvény használja ezeket a változókat a sablon kitöltésére:

```typescript
workbook.substitute(sheetNumber, buildCmrTemplateValues(rows, settings))
```

## CMR Export Beállítások

A CMR beállítások a következő helyen találhatók:
- **Felület**: CMR beállítások gomb a fő navigációban
- **Tárolás**: `useKV('cmr-layout-settings')`
- **Konfiguráció**: Feladó adatok, kiállítás helye, további mezők

## Export Folyamat

1. Felhasználó kijelöl rendeléseket
2. CMR gomb megnyomása
3. Előnézeti ablak megjelenik az adatokkal
4. Szállítólevél szám generálása vagy kézi megadás
5. Export gombra kattintás
6. CMR sablon (Cmr.xls) betöltése a `/templates/` mappából
7. Adatok helyettesítése a változókkal
8. Excel fájl letöltése: `{sorszám}_{vevő}.xlsx`
9. Szállítólevél mentése a Szállítólevelek fülre

## Hibaelhárítás

Ha a CMR sablon nem megfelelően töltődik ki:

1. **Ellenőrizd a sablon elérhetőségét**: `/public/templates/Cmr.xls`
2. **Nézd meg a konzol hibákat**: F12 > Console
3. **Ellenőrizd a vevő adatait**: Vevők fülön
4. **Ellenőrizd a változó neveket**: A sablonban `${változónév}` formátumban
5. **CMR beállítások**: Feladó adatok kitöltése kötelező

## Jövőbeli Fejlesztések

- [ ] További CMR mezők támogatása (fuvarozó, jármű rendszám)
- [ ] Több nyelv támogatása
- [ ] Egyedi CMR sablonok feltöltése
- [ ] PDF export támogatás
