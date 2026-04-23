# CMR Sablon Cella Mapping Útmutató

## Áttekintés

A CMR generálás az `xlsx-template` könyvtárat használja, amely egy Excel sablonban lévő `${változónév}` formátumú placeholder-eket helyettesít tényleges adatokkal.

## Excel Sablon Létrehozása

### Fájl helye
- `/public/templates/Cmr.xls`

### Szükséges Placeholder-ek a Következő Cellákban

| Cella | Placeholder Szöveg | Leírás | Adatforrás |
|-------|-------------------|--------|------------|
| K1 | `${szallitolevel_szama}` | Szállítólevél száma | Generált szekvenciaszám (pl. CMR-2025-001 vagy SZ-2025-001) |
| A6 | `${customer_name}` | Vevő neve | Rendelésből: Customer mező |
| A7 | `${customer_address}` | Vevő teljes címe | Vevőkből: Utca, házszám, irányítószám, város, ország |
| B12 | `${customer_city}` | Vevő városa | Vevőkből: Város |
| B13 | `${customer_country}` | Vevő országa | Vevőkből: Ország |

### További Elérhető Placeholder-ek (opcionális)

Az alábbi változók szintén elérhetők és bárhova beilleszthetők a sablonba:

#### Feladó adatok
- `${senderName}` - Feladó neve (beállításokból vagy alapértelmezett: "Magma Kft")
- `${senderAddress}` - Feladó címe
- `${senderTaxNumber}` - Feladó adószáma

#### Vevő további adatai
- `${consigneeName}` - Vevő neve (ugyanaz mint customer_name)
- `${consigneeAddress}` - Vevő teljes címe (ugyanaz mint customer_address)
- `${consigneeCity}` - Vevő városa (ugyanaz mint customer_city)
- `${consigneeCountry}` - Vevő országa (ugyanaz mint customer_country)
- `${consigneeTaxNumber}` - Vevő adószáma
- `${consigneePostalCode}` - Vevő irányítószáma

#### Áru adatok
- `${marksAndNumbers}` - Jel és szám (termék rajzszámok)
- `${numberOfPackages}` - Dobozok száma összesen
- `${methodOfPacking}` - Csomagolás módja (pl. "50 doboz, 5 raklap")
- `${natureOfGoods}` - Áru megnevezése
- `${grossWeightKg}` - Össz bruttó súly kg-ban

#### Helyszínek és dátumok
- `${placeOfDelivery}` - Áru átadás helye (város, ország)
- `${placeOfTakingOver}` - Áru átvétel helye (beállításokból)
- `${placeIssued}` - Kiállítás helye
- `${dateIssued}` - Kiállítás dátuma

#### Rendelési számok
- `${ownOrderNumber}` - Saját rendelési szám(ok)
- `${customerOrderNumber}` - Vevő rendelési szám(ok)
- `${deliveryNoteNumber}` - Szállítólevél száma (megegyezik K1-gyel)

#### Összesítő adatok
- `${amountPc}` - Összes mennyiség db-ban
- `${rowCount}` - Rendelések száma

#### CMR Specifikus mezők (beállításokból, ha engedélyezve)
- `${carrier}` - Fuvarozó
- `${successiveCarriers}` - További fuvarozók
- `${documentsAttached}` - Mellékelt okmányok
- `${cashOnDelivery}` - Visszatérítés
- `${senderInstructions}` - Feladó rendelkezései
- `${paymentDirections}` - Fuvardíjfizetési meghagyások
- `${carrierReservations}` - Fuvarozó fenntartásai
- `${specialAgreements}` - Egyedi megállapodások
- `${vehicleRegistration}` - Jármű rendszám
- `${statisticalNumber}` - Statisztikai szám
- `${volumeM3}` - Térfogat m³

#### Részletes adatok (ha engedélyezve a beállításokban)
- `${material}` - Anyag(ok)
- `${surfaceTreatment}` - Felületkezelés
- `${orderNotes}` - Rendelési megjegyzések
- `${productNotes}` - Termék megjegyzések

## Sablon Létrehozása - Lépések

### 1. Nyisd meg az Excel fájlt
- Nyisd meg a `/public/templates/Cmr.xls` fájlt Excel-ben

### 2. Helyezd el a placeholder-eket
- **K1 cellába**: Írd be: `${szallitolevel_szama}`
- **A6 cellába**: Írd be: `${customer_name}`
- **A7 cellába**: Írd be: `${customer_address}`
- **B12 cellába**: Írd be: `${customer_city}`
- **B13 cellába**: Írd be: `${customer_country}`

### 3. Egyéb Cellák (Szabadon formázható)
- A többi cellát formázd és tölts ki CMR űrlap szerint
- Bárhova helyezhetsz további placeholder-eket a fenti listából

### 4. Formázás
- A cellák formázása (betűméret, szín, keretek) megmarad
- A placeholder-ek helyére kerülnek az adatok, de a formázás megmarad

### 5. Mentés
- Mentsd el a fájlt `.xls` vagy `.xlsx` formátumban
- Győződj meg róla, hogy a fájl elérhető a `/public/templates/` mappában

## Példa Sablon Struktúra

```
     A                    B                C
1                                         
2                                         
3    NEMZETKÖZI FUVARLEVÉL
4    CMR
5    
6    ${customer_name}                      
7    ${customer_address}                   
8    
...
11   Város: ${customer_city}
12                          ${customer_city}
13                          ${customer_country}
...
     ...                   J        K
1                                   ${szallitolevel_szama}
```

## Tesztelés

A CMR generálás után:
1. Nyisd meg a letöltött fájlt
2. Ellenőrizd, hogy a placeholder-ek helyére az adatok kerültek
3. Ha `${változónév}` látható továbbra is, akkor:
   - Nincs adat arra a mezőre VAGY
   - Nincs ilyen nevű változó definiálva

## Hibaelhárítás

### A placeholder-ek nem cserélődnek ki
- Ellenőrizd, hogy a placeholder pontosan `${változónév}` formátumú-e
- Ellenőrizd, hogy nincs-e extra szóköz vagy karakter
- Ellenőrizd, hogy a változónév pontosan egyezik a fenti táblázatban szereplővel

### A sablon nem töltődik be
- Ellenőrizd, hogy a fájl elérhető-e: `/public/templates/Cmr.xls`
- Ellenőrizd a fájl formátumát (.xls vagy .xlsx)
- Ellenőrizd a konzolt hibaüzenetekért

### Az export üres vagy hibás
- Ellenőrizd, hogy vannak-e kijelölt rendelések
- Ellenőrizd, hogy a vevő adatok ki vannak-e töltve
- Nézd meg a böngésző konzolt részletes hibaüzenetekért
