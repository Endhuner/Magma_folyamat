# Sablon Változók Dokumentáció

## ⚠️ FONTOS: Egységes Mezőnevek

Ez a dokumentum tartalmazza az **összes elérhető sablon változót** ami használható a CMR, Szállítólevél és Címke sablonokban.

Minden változó neve **egységes** és **ugyanaz** mindenhol!

---

## 📋 Rendelés Adatok (Order)

Minden rendeléshez tartozó adat:

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{id}}` | Rendelés egyedi azonosítója | `"1710234567890"` | string |
| `{{orderNumber}}` | **Saját rendelési szám** (cég belső száma) | `"MG-2024-001"` | string |
| `{{ownOrderNumber}}` | **Vevő rendelési száma** | `"PO-12345"` | string |
| `{{customer}}` | Vevő neve | `"Autóipari Kft"` | string |
| `{{productName}}` | Termék neve / Rajzszám | `"DWG-12345"` | string |
| `{{designation}}` | Termék megnevezése | `"Tartó konzol"` | string |
| `{{material}}` | Anyag megnevezése | `"PA6-GF30"` | string |
| `{{surfaceTreatment}}` | Felületkezelés | `"Feketítés"` | string |
| `{{amountPc}}` | Mennyiség (db) | `1000` | number |
| `{{boxesCount}}` | Dobozok száma | `10` | number |
| `{{palletsCount}}` | Raklapok száma | `2` | number |
| `{{grossWeightKg}}` | Bruttó súly (kg) | `125.5` | string/number |
| `{{requiredMaterialKg}}` | Szükséges anyag (kg) | `100` | string |
| `{{plannedProductionHours}}` | Tervezett gyártási idő | `8` | string |
| `{{orderDate}}` | Rendelés dátuma | `"2024.03.15"` | string |
| `{{requiredDate}}` | Kért szállítási dátum | `"2024.03.20"` | string |
| `{{pickupDate}}` | Átvétel dátuma | `"2024.03.18"` | string |
| `{{invoiced}}` | Számlázva dátum | `"2024.03.25"` | string |
| `{{ready}}` | Készre jelentés dátuma | `"2024.03.19"` | string |
| `{{deliveryNote}}` | Szállítólevél száma | `"SZ-2024-042"` | string |
| `{{cmr}}` | CMR száma | `"CMR-2024-015"` | string |
| `{{status}}` | Rendelés státusza | `"Kiszállítva"` | OrderStatus |
| `{{notes}}` | Megjegyzések | `"Sürgős rendelés"` | string |
| `{{createdAt}}` | Létrehozás időpontja | `"2024-03-15T10:30:00"` | ISO string |
| `{{updatedAt}}` | Módosítás időpontja | `"2024-03-15T14:20:00"` | ISO string |

---

## 👤 Vevő Adatok (Customer)

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{customerName}}` | Vevő neve | `"Autóipari Kft"` | string |
| `{{customerAddress}}` | Teljes cím | `"1234 Budapest, Fő utca 1."` | string |
| `{{customerCity}}` | Város | `"Budapest"` | string |
| `{{customerCountry}}` | Ország | `"Magyarország"` | string |
| `{{customerTaxNumber}}` | Adószám | `"12345678-2-42"` | string |
| `{{customerLanguage}}` | Nyelv | `"HU"` | string |
| `{{customerPostalCode}}` | Irányítószám | `"1234"` | string |
| `{{customerStreet}}` | Utca/házszám | `"Fő utca 1."` | string |

**Megjegyzés:** A `{{recipientName}}`, `{{recipientAddress}}` stb. változók is ugyanazt az értéket kapják mint a `{{customerName}}` és társai.

---

## 📦 Termék Adatok (Product)

Termékadatbázisból származó információk:

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{drawingNumber}}` | Rajzszám | `"DWG-12345-A"` | string |
| `{{articleNumber}}` | Cikkszám | `"ART-98765"` | string |
| `{{piecesPerBox}}` | Darab/doboz | `"100"` | string |
| `{{boxesPerPallet}}` | Doboz/raklap | `"5"` | string |
| `{{weightPerPiece}}` | Darabsúly (kg) | `"0.125"` | string |
| `{{cycleTime}}` | Ciklusidő (s) | `"45"` | string |
| `{{postProcessing}}` | Utómunka | `"Sorjázás"` | string |
| `{{postProcessingTime}}` | Utómunka idő | `"10"` | string |
| `{{nestCount}}` | Fészkek száma | `"4"` | string |
| `{{boxSize}}` | Doboz mérete | `"60x40x30"` | string |
| `{{warehouse}}` | Raktár | `"A-01"` | string |
| `{{spruWeight}}` | Darabló súly | `"0.025"` | string |

**Fontos:** A termék adatok **automatikusan** kikeresésre kerülnek a Termékek táblázatból, ha a rendelés `productName` vagy `drawingNumber` mezője egyezik.

---

## 🏢 Feladó Adatok (CMR Settings)

Ezek a CMR beállításokból jönnek:

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{senderName}}` | Feladó neve | `"Magma Kft"` | string |
| `{{senderAddress}}` | Feladó címe | `"H-1211 Budapest, Déli utca 13."` | string |
| `{{senderCity}}` | Feladó városa | `"Budapest"` | string |
| `{{senderCountry}}` | Feladó országa | `"Magyarország"` | string |
| `{{senderTaxNumber}}` | Feladó adószáma | `"HU10368152-2-43"` | string |
| `{{senderPhone}}` | Feladó telefonszáma | `"+36 1 234 5678"` | string |
| `{{senderEmail}}` | Feladó email címe | `"info@magma.hu"` | string |

---

## 🚚 Szállítás Adatok

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{carrierName}}` | Fuvarozó neve | `"Express Logistic Kft"` | string |
| `{{carrierAddress}}` | Fuvarozó címe | `"1234 Budapest, Raktár utca 5."` | string |
| `{{vehiclePlate}}` | Jármű rendszáma | `"ABC-123"` | string |
| `{{pickupLocation}}` | Átvétel helye | `"Budapest, Hungary"` | string |
| `{{deliveryLocation}}` | Szállítás helye | `"Győr"` | string |

---

## 📄 Dokumentum Adatok

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{sequenceNumber}}` | Dokumentum sorszáma | `"SZ-2024-042"` vagy `"CMR-2024-015"` | string |
| `{{documentNumber}}` | Dokumentum száma (ugyanaz mint sequenceNumber) | `"SZ-2024-042"` | string |
| `{{issueDate}}` | Kiállítás dátuma | `"2024.03.15"` | string |
| `{{deliveryDate}}` | Szállítás dátuma | `"2024.03.20"` | string |

---

## 🔢 Összesítő Adatok (több rendelés esetén)

Amikor több rendelést választunk ki:

| Változó | Leírás | Példa | Típus |
|---------|---------|-------|-------|
| `{{totalQuantity}}` | Összes mennyiség (db) | `5000` | number |
| `{{totalBoxes}}` | Összes doboz | `50` | number |
| `{{totalPallets}}` | Összes raklap | `10` | number |
| `{{totalWeight}}` | Összes bruttó súly (kg) | `625.50` | number |

---

## 🔄 Items Ciklus - Több Rendelés Listázása

Ha **több rendelést** választasz ki, és mindegyiket külön sorban szeretnéd látni a sablonban, használd az `{{#items}}` ciklust:

```html
<table>
  <thead>
    <tr>
      <th>Sor</th>
      <th>Vevő rendelési száma</th>
      <th>Termék</th>
      <th>Mennyiség</th>
      <th>Súly</th>
    </tr>
  </thead>
  <tbody>
    {{#items}}
    <tr>
      <td>{{index}}</td>
      <td>{{ownOrderNumber}}</td>
      <td>{{productName}}</td>
      <td>{{quantity}}</td>
      <td>{{weight}}</td>
    </tr>
    {{/items}}
  </tbody>
</table>
```

### Items Cikluson Belül Elérhető Változók

Ezek **minden egyes rendeléshez** külön-külön kitöltésre kerülnek:

| Változó | Leírás | Forrás |
|---------|---------|---------|
| `{{index}}` | Sorszám (1, 2, 3...) | Generált |
| `{{orderNumber}}` | Saját rendelési szám | order.orderNumber |
| `{{ownOrderNumber}}` | **Vevő rendelési száma** | order.ownOrderNumber |
| `{{referenceNumber}}` | Ugyanaz mint ownOrderNumber | order.ownOrderNumber |
| `{{productName}}` | Termék neve | order.productName |
| `{{designation}}` | Megnevezés | order.designation |
| `{{quantity}}` | Mennyiség (db) | order.amountPc |
| `{{weight}}` | Bruttó súly | order.grossWeightKg |
| `{{boxes}}` | Dobozok száma | order.boxesCount |
| `{{pallets}}` | Raklapok száma | order.palletsCount |
| `{{packaging}}` | Csomagolás típusa | Mindig "Raklap" |

---

## 🏷️ Címke Sablonok - Speciális Változók

Címkéken használható minden változó:

| Változó | Leírás | Forrás |
|---------|---------|---------|
| `{{productName}}` | Termék neve | Product táblából vagy order.designation |
| `{{drawingNumber}}` | Rajzszám | Product.drawingNumber |
| `{{ownOrderNumber}}` | Vevő rendelési száma | order.ownOrderNumber |
| `{{orderNumber}}` | Saját rendelési szám | order.orderNumber |
| `{{requiredDate}}` | Kért szállítási dátum | order.requiredDate |
| `{{piecesPerBox}}` | Darab/doboz | Product.piecesPerBox |
| `{{boxesCount}}` | Dobozok száma | order.boxesCount |
| `{{customerName}}` | Vevő neve | Customer.name |
| `{{notes}}` | Megjegyzések | order.notes |

### Címke Generálás Szabályok

1. **Annyi címke generálódik, ahány doboz van** a rendelésben (`boxesCount`)
2. Minimum **1 teljes oldal** (40 címke) generálódik
3. Az üres helyek **üres címkékkel** töltődnek ki
4. A címkék automatikusan **40 címke/oldalra** vannak tördelve

---

## 📊 Példa Használat - CMR Sablon

```html
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>CMR - {{sequenceNumber}}</title>
</head>
<body>
  <h1>NEMZETKÖZI FUVARLEVÉL</h1>
  <p>Dokumentum száma: <strong>{{sequenceNumber}}</strong></p>
  
  <h2>1. Feladó</h2>
  <p>
    <strong>{{senderName}}</strong><br>
    {{senderAddress}}<br>
    {{senderCity}}, {{senderCountry}}<br>
    Adószám: {{senderTaxNumber}}
  </p>
  
  <h2>2. Átvevő</h2>
  <p>
    <strong>{{customerName}}</strong><br>
    {{customerAddress}}<br>
    {{customerCity}}, {{customerCountry}}<br>
    Adószám: {{customerTaxNumber}}
  </p>
  
  <h2>Szállítmány tételek</h2>
  <table>
    <thead>
      <tr>
        <th>Sor</th>
        <th>Vevő rendelési száma</th>
        <th>Termék</th>
        <th>Mennyiség</th>
        <th>Súly (kg)</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{index}}</td>
        <td>{{ownOrderNumber}}</td>
        <td>{{productName}}<br><small>{{designation}}</small></td>
        <td>{{quantity}} db</td>
        <td>{{weight}}</td>
      </tr>
      {{/items}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3"><strong>Összesen</strong></td>
        <td><strong>{{totalQuantity}} db</strong></td>
        <td><strong>{{totalWeight}} kg</strong></td>
      </tr>
    </tfoot>
  </table>
  
  <p>Raklapok száma: <strong>{{totalPallets}}</strong></p>
  <p>Kiállítás dátuma: {{issueDate}}</p>
  <p>Jármű rendszáma: {{vehiclePlate}}</p>
</body>
</html>
```

---

## 📊 Példa Használat - Szállítólevél

```html
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Szállítólevél - {{sequenceNumber}}</title>
</head>
<body>
  <h1>SZÁLLÍTÓLEVÉL</h1>
  <p>Szám: <strong>{{sequenceNumber}}</strong></p>
  <p>Dátum: {{deliveryDate}}</p>
  
  <div class="addresses">
    <div>
      <h3>Feladó:</h3>
      <p>{{senderName}}<br>{{senderAddress}}</p>
    </div>
    <div>
      <h3>Címzett:</h3>
      <p>{{customerName}}<br>{{customerAddress}}</p>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Sor</th>
        <th>Megnevezés</th>
        <th>Rajzszám</th>
        <th>Mennyiség</th>
        <th>Doboz</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{index}}</td>
        <td>{{designation}}</td>
        <td>{{productName}}</td>
        <td>{{quantity}} db</td>
        <td>{{boxes}} db</td>
      </tr>
      {{/items}}
    </tbody>
  </table>
  
  <p>Összesen: {{totalQuantity}} db, {{totalBoxes}} doboz, {{totalPallets}} raklap</p>
</body>
</html>
```

---

## 🏷️ Példa Használat - Címke Sablon

```html
<div class="label">
  <div class="label-header">
    <strong>{{drawingNumber}}</strong>
  </div>
  <div class="label-product">
    {{productName}}
  </div>
  <div class="label-info">
    <p>Vevő rendelés: {{ownOrderNumber}}</p>
    <p>Szállítási dátum: {{requiredDate}}</p>
    <p>Mennyiség: {{piecesPerBox}} db/doboz</p>
  </div>
  <div class="label-footer">
    <small>From: MAGMA</small>
    <small>To: {{customerName}}</small>
  </div>
  <div class="label-notes">
    {{notes}}
  </div>
</div>
```

---

## ⚠️ FONTOS TUDNIVALÓK

### 1. Termék Adatok Automatikus Kikeresése

A termék adatok (rajzszám, cikkszám, doboz/db stb.) **automatikusan** kikeresésre kerülnek a **Termékek táblázatból**, ha:
- A rendelés `productName` mezője **egyezik** a termék `drawingNumber` vagy `productName` mezőjével
- A rendelés `customer` mezője **egyezik** a termék `customer` mezőjével

Ha nincs találat, a rendelésben megadott adatok használódnak.

### 2. Több Rendelés Kezelése

- **Statikus változók** (pl. `{{orderNumber}}`, `{{ownOrderNumber}}`) mindig **csak az ELSŐ rendelés** értékét tartalmazzák
- Ha minden rendelést külön sorban akarsz látni, használd az `{{#items}}` ciklust
- Az `{{#items}}` cikluson belül **minden rendeléshez egyedi** értékek jelennek meg

### 3. Címkék Generálása

- Címkék száma = `boxesCount` (dobozok száma)
- Minimum 1 teljes oldal (40 címke) generálódik
- Üres helyek üres címkékkel töltődnek
- 40 címke/oldal az alapértelmezett, de a címke sablonban módosítható

### 4. Vevő-Specifikus Sablonok

A Vevők táblázatban minden vevőhöz hozzá lehet rendelni:
- **CMR sablont** (`cmrTemplateId`)
- **Szállítólevél sablont** (`deliveryTemplateId`)
- **Címke sablont** (`labelTemplateId`)

Ha van vevő-specifikus sablon, azt használja a rendszer az aktív sablon helyett.

---

## 🔍 Hibaelhárítás

### Probléma: A változó nem helyettesítődik be

**Megoldás:**
1. Ellenőrizd a változó nevét - **pontos egyezés** kell (kis/nagybetű számít)
2. Biztosítsd, hogy `{{` és `}}` közé van írva
3. Nézd meg, hogy a mező ki van-e töltve a rendelésben

### Probléma: Csak az első rendelés adatai jelennek meg

**Megoldás:**
- Használd az `{{#items}}` ciklust, ha több rendelést választottál ki
- A cikluson kívüli statikus változók mindig az első rendelés adatait tartalmazzák

### Probléma: Termék adatok (rajzszám, doboz/db) nem jelennek meg

**Megoldás:**
1. Ellenőrizd, hogy a termék létezik-e a **Termékek** táblázatban
2. A termék `customer` mezőjének egyeznie kell a rendelés `customer` mezőjével
3. A termék `drawingNumber` vagy `productName` mezőjének egyeznie kell a rendelés `productName` mezőjével

---

## 📝 Összefoglalás - Leggyakrabban Használt Változók

### Minden sablonban:
- `{{sequenceNumber}}` - Dokumentum száma
- `{{issueDate}}` - Mai dátum
- `{{senderName}}` - Feladó neve
- `{{customerName}}` - Vevő neve
- `{{customerAddress}}` - Vevő címe
- `{{customerCity}}` - Vevő városa
- `{{customerCountry}}` - Vevő országa

### Items cikluson belül:
- `{{index}}` - Sorszám
- `{{ownOrderNumber}}` - **Vevő rendelési száma**
- `{{orderNumber}}` - Saját rendelési szám
- `{{productName}}` - Termék neve
- `{{designation}}` - Megnevezés
- `{{quantity}}` - Mennyiség
- `{{weight}}` - Súly
- `{{boxes}}` - Dobozok száma
- `{{pallets}}` - Raklapok száma

### Összesítések:
- `{{totalQuantity}}` - Összes mennyiség
- `{{totalBoxes}}` - Összes doboz
- `{{totalPallets}}` - Összes raklap
- `{{totalWeight}}` - Összes súly

---

**Készítve:** 2024  
**Verzió:** 1.0  
**Utolsó frissítés:** 2024.03.15
