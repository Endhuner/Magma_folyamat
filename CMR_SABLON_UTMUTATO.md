# CMR Dokumentum Generálás ExcelJS-sel

## Áttekintés

A CMR dokumentumok mostantól **ExcelJS segítségével dinamikusan generálódnak** a kódból, sablon fájlok használata nélkül. Ez teljes kontrollt biztosít a formázás, elrendezés és tartalom felett.

## Hogyan működik

### 1. Dinamikus generálás

A `cmrDirectExport.ts` fájl tisztán ExcelJS API-t használva hozza létre a CMR dokumentumokat:
- Új munkafüzet létrehozása
- Cellák formázása (betűtípus, méret, igazítás, színek)
- Táblázatok és keretek rajzolása
- Összegzések és számítások
- Professional Excel fájl exportálás

### 2. Adatbeillesztés

A rendszer automatikusan kitölti az alábbi adatokat:


**Feladó adatok (CMR Beállításokból):**
- Feladó neve (pl. "Magma Kft")
- Feladó címe
- Feladó város és ország
- Feladó adószáma
- Feladó telefon és email (ha megadva)

**Címzett adatok (Vevők adatbázisból):**
- Címzett neve
- Címzett teljes címe
- Címzett város
- Címzett ország
- Címzett adószáma

**Szállítási információk:**
- Áru átvételének helye és dátuma
- Áru kiszállításának helye
- Fuvarozó adatai (ha megadva a beállításokban)
- Jármű rendszáma (ha megadva)

**Termék és csomagolási információk (minden rendelt termék):**
- Termék név
- Megnevezés
- Csomagolás módja
- Mennyiség (db)
- Dobozok száma
- Raklapok száma
- Bruttó súly (kg)

**Dokumentum információk:**
- Szállítólevél sorszáma (automatikusan generált)
- Kiállítás helye és dátuma

### 3. Formázás és stílus

Az ExcelJS lehetővé teszi:
- **Betűtípus formázás**: méret, vastagság, szín, aláhúzás
- **Cellamezők**: háttérszín, keretek, igazítás
- **Cellák egyesítése**: fejlécekhez és címekhez
- **Oszlopszélességek**: automatikus beállítás olvashatósághoz
- **Sorok magassága**: extra hely a címekhez

### 4. Testreszabás

A CMR dokumentum megjelenését a `cmrDirectExport.ts` fájlban lehet módosítani:

```typescript
// Például a fejléc színének módosítása
cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0066CC' }  // Kék háttér
}

// Betűtípus módosítása
cell.font = { 
  bold: true, 
  size: 12, 
  color: { argb: 'FFFFFFFF' }  // Fehér szöveg
}
```

## CMR Beállítások

A felhasználók testreszabhatják a feladó és fuvarozó információkat a **CMR Beállítások** dialógusban:

- Feladó neve
- Feladó címe, város, ország
- Feladó adószáma
- Feladó telefon és email
- Áru átvételének helye
- Kiállítás helye
- Fuvarozó neve és címe
- Jármű rendszáma

Ezek az adatok automatikusan bekerülnek a generált CMR dokumentumokba.

## Fájlnév és mentés

A generált CMR fájlok neve:
```
CMR-ÉÉÉÉHHNN-0001_VevoNev.xlsx
```

Ahol:
- Automatikus sorszámozás (CMR-specific)
- Vevő neve (első szó, biztonságos formázással)
- .xlsx kiterjesztés

A dokumentumok automatikusan:
- Letöltésre kerülnek a böngészőben
- Elmentődnek a Dokumentumok fülen
- Összekapcsolódnak a kapcsolódó rendelésekkel
- A rendelésekbe beíródik a szállítólevél száma

## Előnyök az új rendszerben

1. **Nincs sablon fájl függőség** - Minden a kódban van
2. **Teljes kontroll** - Bármilyen formázás lehetséges
3. **Egyszerűbb karbantartás** - Egy helyen minden
4. **Dinamikus tartalom** - Feltételes formázás és logika
5. **Megbízható működés** - Nincs sablon betöltési hiba
6. **Professional kimenet** - Excel natív formázás
- `${amountPc}` - Összes mennyiség darabban

**Dokumentum információk:**
- `${placeIssued}` - Kiállítás helye (alapértelmezett: "Budapest")
- `${dateIssued}` - Kiállítás dátuma
- `${deliveryNoteNumber}` - Szállítólevél száma
- `${ownOrderNumber}` - Saját rendelési szám(ok)
- `${customerOrderNumber}` - Vevő rendelési szám(ok)
- `${rowCount}` - Rendelések száma összesen

### 4. Mentés

Mentsd el a fájlt `Cmr.xltx` néven (Excel Template formátum) a következő helyre:
```
/public/templates/Cmr.xltx
```

## Példa Sablon Struktúra

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CMR - FUVARLEVÉL                                │
├─────────────────────────────────────────────────────────────────────────┤
│ Szállítólevél száma: ${szallitolevel_szama}                      (K1)  │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. FELADÓ                                                               │
│    Név:     ${senderName}                                               │
│    Cím:     ${senderAddress}                                            │
│    Adószám: ${senderTaxNumber}                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. CÍMZETT                                                              │
│    Név:     ${customer_name}                                      (A6)  │
│    Cím:     ${customer_address}                                   (A7)  │
│    Város:   ${customer_city}                                      (B12) │
│    Ország:  ${customer_country}                                   (B13) │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. ÁTVÉTEL HELYE                                                        │
│    ${placeOfDelivery}                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. ÁRU ÁTVÉTELE                                                         │
│    ${placeOfTakingOver}                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. JEL ÉS SZÁM        │ 7. CSOMAGOK      │ 9. ÁRU MEGNEVEZÉSE          │
│    ${marksAndNumbers} │    ${numberOfPackages}    │ ${natureOfGoods}   │
├───────────────────────┼──────────────────┼─────────────────────────────┤
│ 11. BRUTTÓ SÚLY (kg)  │                  │                             │
│     ${grossWeightKg}  │                  │                             │
├─────────────────────────────────────────────────────────────────────────┤
│ 21. KIÁLLÍTÁS                                                           │
│     Hely:   ${placeIssued}                                              │
│     Dátum:  ${dateIssued}                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Használat

1. Töltsd fel a `Cmr.xltx` fájlt a `/public/templates/` mappába
2. A rendszer automatikusan felismeri és használja ezt a sablont
3. CMR gomb megnyomásakor:
   - Betölti a sablont
   - Kitölti az aktuális rendelési adatokkal
   - Elmenti és letölti a kitöltött dokumentumot
   - Menti a szállítólevelek közé

## Hibaelhárítás

Ha a `Cmr.xltx` fájl nem található:
- A rendszer automatikusan visszaáll a `Cmr.xls` fájlra
- Ellenőrizd, hogy a fájl a `/public/templates/` mappában van-e
- Ellenőrizd a fájl nevét és kiterjesztését (kis/nagybetű érzékeny lehet)
