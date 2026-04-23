# ProduktívPro – Részletes Termékkövetelmény Dokumentum (PRD)

> **Verzió:** 1.0  
> **Dátum:** 2026-04-23  
> **Projekt:** Termelésirányítási Rendszer – `termels-irnytsi-rend`  
> **Technológia:** React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI, ExcelJS, Recharts  

---

## 1. Termék Áttekintés

### 1.1 Terméknév és Meghatározás

**ProduktívPro** – egy webalapú **Gyártásvégrehajtási Rendszer (Manufacturing Execution System, MES)**, amelyet kifejezetten kis- és középvállalati gyártóüzemek számára terveztek. A rendszer lehetővé teszi a munkarendelések teljes életciklusának kezelését a felvételtől a kiszállításig, valós idejű gyártáskövetéssel, készletgazdálkodással, dokumentumexporttal és részletes analitikával.

### 1.2 Üzleti Célok

| # | Cél | Mérőszám |
|---|-----|----------|
| 1 | Csökkenteni a papíralapú adminisztráció idejét | Adminisztrációs idő ≥ 40%-kal csökken |
| 2 | Valós idejű gyártásláthatóság biztosítása | Minden rendelés aktuális státusza azonnal látható |
| 3 | Kiszállítási dokumentumok automatizálása | Szállítólevél / CMR generálási idő < 30 mp |
| 4 | Készletpontosság javítása | Készletkülönbség ≤ 1% |
| 5 | Gyártási műszakadatok hiánytalanságának biztosítása | Hiányos műszakadatok aránya < 2% |

### 1.3 Célfelhasználók

| Szerepkör | Leírás | Fő tevékenységek |
|-----------|--------|-----------------|
| **Admin** | Gyárvezető, üzemvezető | Felhasználók kezelése, összes adat elérése, riportok, backup |
| **Operátor** | Gyártósori dolgozó | Műszakadatok rögzítése, rendelés státuszának módosítása |
| **Irodai dolgozó** | Rendelésfelvevő, logisztikus | Rendelések, vevők, termékek kezelése, dokumentumexport |

---

## 2. Alkalmazás Architektúra

### 2.1 Technológiai Verem

| Réteg | Technológia | Verzió | Célpont |
|-------|------------|--------|---------|
| Frontend keretrendszer | React | ^19.0.0 | SPA alkalmazás |
| Nyelv | TypeScript | ~5.7.2 | Típusbiztonság |
| Build eszköz | Vite | ^7.2.6 | Gyors fejlesztés és build |
| CSS keretrendszer | Tailwind CSS | ^4.1.11 | Utility-first stílusok |
| UI komponenskönyvtár | Radix UI | Többféle csomag | Akadálymentesített komponensek |
| Adatmegjelenítés | Recharts | ^2.15.1 | Diagramok és grafikonok |
| Excel export | ExcelJS | ^4.4.0 | Professzionális Excel generálás |
| Excel sablon | xlsx-template | ^1.4.7 | Sablonalapú CMR export |
| Excel import | xlsx | ^0.18.5 | Tömeges importálás |
| Animációk | Framer Motion | ^12.6.2 | Átmenetek és animációk |
| Form kezelés | React Hook Form + Zod | ^7.54.2 / ^3.25.76 | Validáció |
| Ikonok | Lucide React + Phosphor | ^0.484.0 / ^2.1.7 | UI ikonkészlet |
| Dátumkezelés | date-fns | ^3.6.0 | Dátum műveletek |
| Értesítések | Sonner | ^2.0.1 | Toast üzenetek |
| Állapotkezelés | `useKV` (GitHub Spark) | — | Perzisztens kulcs-érték tár |
| 3D vizualizáció | Three.js | ^0.175.0 | Opcionális 3D elemek |

### 2.2 Kód Szervezés (Mappastruktúra)

```
src/
├── views/                     # Minden nézet önálló fájlban
│   ├── DashboardView.tsx       # Főoldal / KPI-k
│   ├── ProductionViewTab.tsx   # Gyártáskövetés
│   ├── OrdersView.tsx          # Rendeléskezelés
│   ├── CustomersView.tsx       # Vevőkezelés
│   ├── ProductsView.tsx        # Termékkezelés
│   ├── InventoryView.tsx       # Készletkezelés
│   ├── DocumentsView.tsx       # Dokumentumok (szállítólevél, CMR)
│   ├── LabelTemplatesView.tsx  # Címkesablonok
│   ├── TemplateEditorView.tsx  # Sablon szerkesztő
│   ├── TemplateSavesView.tsx   # Sablon mentések
│   ├── BackupRestoreView.tsx   # Adatmentés / visszaállítás
│   └── index.ts               # Centralizált export
│
├── components/                # Újrafelhasználható UI komponensek
│   ├── ui/                    # shadcn/Radix UI wrapper-ek
│   ├── auth/                  # Bejelentkezés, AuthWrapper
│   ├── users/                 # Felhasználókezelés
│   ├── production/            # Gyártási részletdialógus
│   ├── Dashboard.tsx
│   ├── OrdersTable.tsx
│   ├── CustomersTable.tsx
│   └── ... (dialógusok, táblázatok)
│
├── lib/                       # Üzleti logika és segédeszközök
│   ├── types.ts               # TypeScript típusdefiníciók
│   ├── helpers.ts             # Segédfüggvények
│   ├── auth.ts / authService.ts
│   ├── orderService.ts
│   ├── inventoryService.ts
│   ├── shiftValidation.ts
│   ├── orderValidation.ts
│   ├── exportValidation.ts
│   ├── cmrExcelJSExport.ts
│   ├── deliveryExcelJSExport.ts
│   ├── exceljsTemplateExport.ts
│   ├── productionReportExport.ts
│   └── labelExportFormats.ts
│
├── hooks/                     # Custom React hookok
│   ├── use-mobile.ts
│   └── use-virtual-scroll.ts
│
└── App.tsx                    # Főkoordinátor, állapotkezelés
```

### 2.3 Adattárolás

Az alkalmazás a **GitHub Spark `useKV`** mechanizmusát alkalmazza perzisztens kulcs-érték alapú tároláshoz. Az összes adat a következő kulcsok alatt él:

| Kulcs | Adattípus | Leírás |
|-------|-----------|--------|
| `orders` | `Order[]` | Munkarendelések |
| `customers` | `Customer[]` | Vevők |
| `products` | `Product[]` | Termékek/rajzszámok |
| `inventory` | `InventoryItem[]` | Készletcikkek |
| `inventory-transactions` | `InventoryTransaction[]` | Készletmozgások naplója |
| `delivery-notes` | `DeliveryNote[]` | Szállítólevelek és CMR dokumentumok |
| `users` | `User[]` | Felhasználók |
| `production-shifts` | `ProductionShift[]` | Gyártási műszakadatok |
| `production-logs` | `ProductionLog[]` | Gyártási eseménynapló |
| `customer-sequences` | `CustomerSequenceCounter` | Sorszámozás vevőnként |

---

## 3. Adatmodellek (TypeScript Típusok)

### 3.1 Rendelés (`Order`)

```typescript
export type OrderStatus = 
  | 'Felvéve'          // Új rendelés, gyártás még nem indult
  | 'Előkészítve'      // Gyártásra kész
  | 'Folyamatban'      // Aktív gyártás
  | 'Szünetel'         // Ideiglenesen felfüggesztve
  | 'Csomagolás alatt' // Csomagolási fázis
  | 'Javítás alatt'    // Minőségi probléma, javítás szükséges
  | 'Leállítás'        // Gyártás leállítva
  | 'Kiszállítva'      // Kiszállítva a vevőnek

export interface Order {
  id: string
  customer: string             // Vevő neve
  productName: string          // Terméknév
  designation: string          // Jelölés
  notes: string                // Megjegyzések
  ownOrderNumber: string       // Saját rendelésszám
  material: string             // Anyag
  orderNumber: string          // Vevői rendelésszám
  amountPc: number             // Mennyiség (db)
  orderDate: string            // Rendelés dátuma
  requiredDate: string         // Szükséges szállítási határidő
  pickupDate: string           // Tervezett átvétel
  invoiced: string             // Számlázva
  ready: string                // Készen
  surfaceTreatment: string     // Felületkezelés
  boxesCount: number | null    // Dobozok száma
  palletsCount: number | null  // Raklapok száma
  grossWeightKg: string        // Bruttó tömeg (kg)
  requiredMaterialKg: string   // Szükséges anyag (kg)
  plannedProductionHours: string // Tervezett gyártási órák
  deliveryNote: string         // Szállítólevél hivatkozás
  cmr: string                  // CMR hivatkozás
  status: OrderStatus
  createdAt: string
  updatedAt: string
}
```

### 3.2 Vevő (`Customer`)

```typescript
export interface Customer {
  id: string
  name: string
  language: string              // Kommunikációs nyelv
  city: string
  postalCode: string
  street: string
  country: string
  fullAddress: string           // Összesített cím
  taxNumber: string             // Adószám
  deliveryTemplateId?: string   // Hozzárendelt szállítólevél-sablon
  cmrTemplateId?: string        // Hozzárendelt CMR-sablon
  labelTemplateId?: string      // Hozzárendelt címkesablon
  createdAt: string
  updatedAt: string
}
```

### 3.3 Termék (`Product`)

```typescript
export interface Product {
  id: string
  customer: string
  drawingNumber: string         // Rajzszám
  productName: string
  notes: string
  nestCount: string             // Fészekszám (injektálószerszám)
  weightPerPiece: string        // Darabsúly
  material: string
  surfaceTreatment: string
  cycleTime: string             // Ciklusidő
  postProcessingTime: string    // Utómunka ideje
  postProcessing: string        // Utómunka leírása
  boxSize: string               // Dobozméret
  piecesPerBox: string          // Db/doboz
  boxesPerPallet: string        // Doboz/raklap
  articleNumber: string         // Cikkszám
  warehouse: string             // Raktárhelyiség
  spruWeight: string            // Szórósúly
  trackInventory?: boolean      // Készletkövetés
  autoUpdateInventory?: boolean // Automatikus készletfrissítés
  createdAt: string
  updatedAt: string
}
```

### 3.4 Készletcikk és Tranzakció

```typescript
export interface InventoryItem {
  id: string
  productId: string
  productName: string
  drawingNumber: string
  customer: string
  quantity: number              // Aktuális készlet (db)
  totalShots: number            // Összes lövésszám
  nestCount: string
  location: string              // Raktárhely
  notes: string
  lastUpdated: string
  createdAt: string
}

export interface InventoryTransaction {
  id: string
  inventoryItemId: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  orderId?: string
  notes: string
  userId?: string
  createdAt: string
}
```

### 3.5 Gyártási Műszak és Napló

```typescript
export interface ProductionShift {
  id: string
  orderId: string
  date: string                  // YYYY-MM-DD formátum
  shift: 'de' | 'du'           // Délelőtti / délutáni műszak
  shotsCount: number            // Lövések száma a műszakban
  notes: string
  userId: string                // Rögzítő felhasználó
  createdAt: string
}

export interface ProductionLog {
  id: string
  productId: string
  orderId: string
  action: string                // Esemény leírása
  notes: string
  userId: string
  createdAt: string
}
```

### 3.6 Felhasználó és Szerepkörök

```typescript
export type UserRole = 'admin' | 'user'

export interface User {
  id: string
  username: string
  password: string              // Base64 obfuszkáció (fejlesztői környezetben)
  role: UserRole
  createdAt: string
  updatedAt: string
}
```

---

## 4. Modulok Részletes Specifikációja

---

### 4.1 Modul: Hitelesítés (Authentication)

#### Célja
Csak azonosított felhasználók férhessenek hozzá az alkalmazáshoz. A szerepkör határozza meg az elérhető funkciókat.

#### Komponensek
- `src/components/auth/LoginForm.tsx` – Bejelentkezési felület
- `src/components/auth/AuthWrapper.tsx` – Globális hitelesítési burkoló
- `src/lib/auth.ts` – Jelszó-kezelés, session logika

#### Folyamat

```
Alkalmazás betöltés
  → AuthWrapper ellenőrzi a sessiont
  → Ha nincs session → LoginForm megjelenik
  → Felhasználónév + Jelszó megadva
  → auth.ts validálja (base64 összehasonlítás)
  → Sikeres → App.tsx betöltődik a felhasználói kontextussal
  → Sikertelen → Hibaüzenet
```

#### Alapértelmezett hitelesítési adatok
- **Felhasználónév:** `admin`  
- **Jelszó:** `admin`  
- *(Éles üzembehelyezés előtt kötelezően módosítandó!)*

#### Biztonsági megjegyzések
- Jelszavak jelenleg base64-ben tárolódnak (obfuszkáció, nem titkosítás)
- Éles környezetben bcrypt vagy hasonló hash algoritmus javasolt
- Session kezelés `useKV` alapú lokális tárolással

#### Jogosultsági mátrix

| Funkció | Admin | Operátor/User |
|---------|-------|---------------|
| Összes rendelés megtekintése | ✅ | ✅ |
| Rendelés létrehozás/szerkesztés | ✅ | ✅ |
| Felhasználókezelés | ✅ | ❌ |
| Készletnapló megtekintése | ✅ | ❌ |
| Backup/Restore | ✅ | ❌ |
| Műszakadatok rögzítése | ✅ | ✅ |

---

### 4.2 Modul: Dashboard (Főoldal)

#### Célja
Átfogó, valós idejű KPI-ok és grafikonok megjelenítése a gyártási teljesítményről.

#### Komponens
- `src/views/DashboardView.tsx`
- `src/components/Dashboard.tsx`

#### Megjelenített KPI kártyák

| KPI | Leírás | Számítás |
|-----|--------|----------|
| **Összes rendelés** | Minden rendelés száma | `orders.length` |
| **Felvett / várakozó** | „Felvéve" státuszú rendelések | Filter by status |
| **Folyamatban** | Aktív gyártás alatt lévők | Filter by „Folyamatban" |
| **Csomagolás alatt** | Csomagolási fázisban | Filter by status |
| **Kiszállítva** | Befejezett szállítások | Filter by „Kiszállítva" |
| **Számlázva** | Számlázott rendelések | `invoiced` mező alapján |

#### Vizualizációk
- **Státusz elosztás** – Tortadiagram (Recharts PieChart)
- **Rendelési trend** – Vonaldiagram az elmúlt időszakra
- **Átfutási idők** – Sávdiagram (tervezett vs. tényleges)

#### Szűrők
- Dátumtartomány szűrő (date-fns alapú kalkuláció)
- Vevő szerinti szűrés

---

### 4.3 Modul: Rendeléskezelés (Orders)

#### Célja
A gyártási munkarendelések teljes életciklusának kezelése: létrehozástól a kiszállításig.

#### Komponensek
- `src/views/OrdersView.tsx`
- `src/components/OrdersTable.tsx`
- `src/components/OrderDialog.tsx`
- `src/components/OrderBulkImportDialog.tsx`
- `src/components/OrderColumnFilterDialog.tsx`
- `src/lib/orderService.ts`
- `src/lib/orderValidation.ts`

#### Rendelés Állapotgép

```
Felvéve
  ↓ Gyártás előkészítése
Előkészítve
  ↓ Gyártás indítása
Folyamatban ←→ Szünetel
  ↓               ↓
  ↓          Javítás alatt
  ↓               ↓
Csomagolás alatt
  ↓ Kiszállítás
Kiszállítva
  (bármely állapotból) → Leállítás
```

#### Rendelés Létrehozás Folyamata

```
Kattintás: „Új rendelés"
  → OrderDialog megnyílik (slide-up, 250ms)
  → Kötelező mezők: Vevő, Terméknév, Mennyiség, Határidő
  → Opcionális mezők: Anyag, Megjegyzés, Felületkezelés, Tömeg
  → Validáció (Zod schema)
    → Hiba: inline hibaüzenetek
    → Siker: Order objektum létrehozva, UUID-vel
  → Mentés → useKV frissítés
  → Sikeres toast értesítés
  → Rendelés megjelenik a listában
```

#### Táblázat Funkciók
- **Keresés** – Valós idejű szűrés terméknév, vevő, rendelésszám alapján
- **Oszlopszűrők** – `ColumnFilterManager` segítségével mentett oszlopkombinációk
- **Rendezés** – Minden oszlopon ascending/descending
- **Tömeges importálás** – Excel (.xlsx) fájlból `OrderBulkImportDialog`
- **Exportálás** – Szállítólevél és CMR dokumentumok generálása
- **Kijelölés** – Checkbox alapú többes kijelölés exporthoz

#### Rendelés Összesítő Lábléc (Order Summary Footer)

Fixált lábléc a viewport alján, amely az aktuálisan szűrt vagy kijelölt rendelések aggregált adatait mutatja:

| Mező | Leírás |
|------|--------|
| Rendelések száma | Kijelölt / összes szűrt |
| Összes darab (db) | `sum(amountPc)` |
| Dobozok száma | `sum(boxesCount)` |
| Raklapok száma | `sum(palletsCount)` |
| Bruttó tömeg (kg) | `sum(grossWeightKg)` |
| Szükséges anyag (kg) | `sum(requiredMaterialKg)` |
| Tervezett gyártási óra | `sum(plannedProductionHours)` |

#### Érvényesítési szabályok (Zod)
- `amountPc` – pozitív egész szám, kötelező
- `requiredDate` – jövőbeli vagy mai dátum, kötelező
- `customer` – nem üres string
- `productName` – nem üres string
- `grossWeightKg` – számszerű string, nem negatív

---

### 4.4 Modul: Gyártáskövetés (Production Tracking)

#### Célja
Valós idejű gyártási műveletek követése műszakonkénti lövésszám rögzítéssel és hiánydetektálással.

#### Komponensek
- `src/views/ProductionViewTab.tsx`
- `src/components/ProductionView.tsx`
- `src/components/production/ProductionDetailDialog.tsx`
- `src/components/QuickShiftEntryDialog.tsx`
- `src/components/ShiftValidationBanner.tsx`
- `src/components/WorkOrderCard.tsx`
- `src/components/WorkOrderDialog.tsx`
- `src/lib/shiftValidation.ts`

#### Műszakrögzítés Folyamata

```
Operátor megnyitja a Gyártás fület
  → Csak „Folyamatban", „Előkészítve", „Szünetel" státuszú rendelések láthatók
  → Kártya kiválasztása → ProductionDetailDialog
  → Műszak adatok megadása:
    - Dátum (előre kitöltve: mai nap)
    - Műszak: de (délelőtt) / du (délután)
    - Lövésszám
    - Megjegyzés (opcionális)
  → Mentés → ProductionShift létrehozva
  → Készlet automatikus frissítése: lövésszám × fészekszám = darabszám
  → ProductionLog bejegyzés
```

#### Hiányos Műszakadatok Detektálása

A `shiftValidation.ts` modul a következő logikát futtatja minden oldalbetöltéskor és adatváltozáskor:

1. Lekéri az összes „Folyamatban" státuszú rendelést
2. Ellenőrzi az elmúlt **7 napot** visszamenőleg
3. Minden napra megnézi, van-e `de` és `du` műszak bejegyezve
4. Azonosítja a hiányzó nap+műszak kombinációkat
5. Ha van hiány → `ShiftValidationBanner` megjelenik

**Kivételek (nem jelez hiányt):**
- Szünetel vagy Kiszállítva státuszú rendelések
- A rendelés indítása előtti napok
- Ma és jövőbeli napok (csak múltbeli napokra érvényes)

#### ShiftValidationBanner

- Sárga háttérű figyelmeztető banner a Gyártás fül tetején
- Listázza a hiányzó nap + műszak kombinációkat kattintható formában
- Kattintásra `QuickShiftEntryDialog` nyílik az előre kitöltött dátummal és műszakkal
- „Elrejt" gomb (állapot localStorage-ban tárolva)
- Slide-down animáció (300ms) megjelenéskor

#### Vizuális Indikátorok
- ⚠️ Warning badge a rendelés kártyáján, ha hiányzó műszakadatok vannak
- Tooltip magyarázattal hover esetén
- ✅ Zöld pipa amikor minden műszakadat megvan

---

### 4.5 Modul: Vevőkezelés (Customers)

#### Célja
Vevők adatainak centralizált kezelése sablonhozzárendeléssel és tömeges importálással.

#### Komponensek
- `src/views/CustomersView.tsx`
- `src/components/CustomersTable.tsx`
- `src/components/CustomerDialog.tsx`
- `src/components/BulkImportDialog.tsx`
- `src/components/EntityHistoryDialog.tsx`

#### CRUD Műveletek

| Művelet | Leírás |
|---------|--------|
| **Létrehozás** | Manuális adatbevitel dialógusban |
| **Szerkesztés** | Meglévő vevő adatainak módosítása |
| **Törlés** | Vevő törlése (ha nincs aktív rendelése) |
| **Tömeges import** | Excel fájlból (.xlsx) – soronkénti validációval |

#### Vevő-Sablon Hozzárendelés
Minden vevőhöz külön sablonok rendelhetők:
- **Szállítólevél sablon** (`deliveryTemplateId`)
- **CMR sablon** (`cmrTemplateId`)
- **Címkesablon** (`labelTemplateId`)

Exportáláskor a rendszer automatikusan a vevőhöz rendelt sablont alkalmazza.

#### Tömeges Import Folyamata

```
Excel fájl kiválasztása (.xlsx)
  → xlsx könyvtár beolvassa
  → Sor-szintű validáció:
    - Hiányzó kötelező mezők
    - Duplikát vevőnév
    - Érvénytelen formátumok
  → Hibajelentés sorszámmal (pl. „3. sor: Hiányzó adószám")
  → Részleges import engedélyezve (hibás sorok kihagyva)
  → Sikeres sorok importálása → toast értesítés
```

---

### 4.6 Modul: Termékkezelés (Products)

#### Célja
A gyártott termékek technológiai adatainak kezelése a rendeléshozzárendeléshez, készletkövetéshez és exporthoz.

#### Komponensek
- `src/views/ProductsView.tsx`
- `src/components/ProductsTable.tsx`
- `src/components/ProductDialog.tsx`
- `src/components/ProductBulkImportDialog.tsx`
- `src/components/ProductHistoryDialog.tsx`

#### Termékkártya Kulcsadatok
- **Rajzszám** – Azonosító
- **Fészekszám** – Szerszámfészek-szám (lövés → darab kalkulációhoz kritikus)
- **Darabsúly** – Bruttó tömeg kalkulációhoz
- **Ciklusidő** – Gyártás tervezéséhez
- **Csomagolási adatok** – Db/doboz, doboz/raklap
- **Raktárhely** – Fizikai helyszín
- **Készletkövetés** – Automatikus frissítés engedélyezése/tiltása

#### Termék Javítási Előzmények (`ProductHistoryDialog`)
- Megjeleníti az adott termékhez kapcsolódó összes `ProductionLog` bejegyzést
- Szűrhető dátum szerint
- Export lehetőség

---

### 4.7 Modul: Készletkezelés (Inventory)

#### Célja
Valós idejű raktárkészlet nyilvántartás automatikus és manuális mozgáskövetéssel.

#### Komponensek
- `src/views/InventoryView.tsx`
- `src/components/InventoryTable.tsx`
- `src/components/InventoryDialog.tsx`
- `src/components/InventoryAdjustDialog.tsx`
- `src/components/InventoryDeductionDialog.tsx`
- `src/components/InventoryHistoryDialog.tsx`
- `src/components/InventoryWarningBanner.tsx`
- `src/components/WarehouseAddDialog.tsx`
- `src/lib/inventoryService.ts`

#### Készletmozgás Típusok

| Típus | Leírás | Triggerelő esemény |
|-------|--------|-------------------|
| `in` | Bevét | Műszakadatok rögzítésekor (lövésszám × fészekszám) |
| `out` | Kivét / kiszállítás | Szállítólevél exportjakor |
| `adjustment` | Korrekció | Manuális leltári kiigazítás |

#### Automatikus Készletfrissítés
Ha a termékhez `autoUpdateInventory = true`:
```
Műszak rögzítve (shotsCount = 50, nestCount = 4)
  → producedQuantity = 50 × 4 = 200 db
  → InventoryTransaction létrehozva (type: 'in', quantity: 200)
  → InventoryItem.quantity += 200
```

#### Készlet Figyelmeztetések (`InventoryWarningBanner`)
- Kritikus alacsony készlet jelzése banner formában
- Készlet nulla alá csökkent cikkek kiemelése
- Konfiguálható küszöbértékek termékenkénti szinten

#### Szállítólevél Készletellenőrzés
Export előtt a rendszer ellenőrzi:
```
Kiválasztott rendelések
  → Minden rendeléshez megkeresi az InventoryItem-et
  → Ha nincs elegendő készlet (quantity < amountPc):
    → Figyelmeztetés megjelenítése az export előtt
  → Felhasználó megerősíthet vagy megszakíthat
```

---

### 4.8 Modul: Dokumentumexport (Documents)

#### Célja
Professzionális kiszállítási dokumentumok (szállítólevél, CMR) automatizált generálása ExcelJS segítségével.

#### Komponensek
- `src/views/DocumentsView.tsx`
- `src/components/DeliveryNotesTable.tsx`
- `src/components/ExportPreviewDialog.tsx`
- `src/components/ExportEditDialog.tsx`
- `src/components/DeliverySettingsDialog.tsx`
- `src/components/CmrSettingsDialog.tsx`
- `src/components/DocumentFilterDialog.tsx`
- `src/lib/cmrExcelJSExport.ts`
- `src/lib/deliveryExcelJSExport.ts`
- `src/lib/exceljsTemplateExport.ts`
- `src/lib/exportValidation.ts`

#### 4.8.1 Szállítólevél Export (Szállítólevél / Delivery Note)

**Triggerelés:** Rendelés kijelölése → „Szállító (ExcelJS)" gomb

**Generált tartalom:**
| Mező | Forrás |
|------|--------|
| Vevő neve | `order.customer` |
| Vevő cím | `customer.fullAddress` |
| Terméknév | `order.productName` |
| Rajzszám | `product.drawingNumber` |
| Mennyiség (db) | `order.amountPc` |
| Csomagolás | `order.boxesCount`, `order.palletsCount` |
| Tömeg (kg) | `order.grossWeightKg` |
| Dátum | Exportálás napja |
| Sorszám | `DeliveryNote.sequenceNumber` (vevőnkénti sorszámozás) |

**Fájlnév formátum:** `{sorszam}-{vevo_neve}-szallitolevel.xlsx`

**ExcelJS formázás:**
- Cella összevonások (`mergeCells`)
- Fejléc keretezés (`border`)
- Betűtípusok, igazítások, kitöltési színek
- Teljes dokumentumstruktúra kódból generálva (nincs sablonfájl szükség)

#### 4.8.2 CMR Export (Nemzetközi Fuvarlevél)

**Triggerelés:** Rendelés kijelölése → „CMR (ExcelJS)" gomb

**CMR Mezők:**
| Mező | Cella (sablon) | Forrás |
|------|---------------|--------|
| Szállítólevél száma | K1 | `DeliveryNote.sequenceNumber` |
| Küldő neve | A1 | Cégadatok |
| Fogadó neve | A6 | `customer.name` |
| Fogadó cím | A7 | `customer.fullAddress` |
| Fogadó városa | B12 | `customer.city` |
| Fogadó országa | B13 | `customer.country` |
| Áru leírása | — | `order.productName`, `order.amountPc` |
| Fuvarozó adatok | — | CMR beállítások |

**Sablonalapú / Programozott generálás:**
- Elsőként a `xlsx-template` könyvtárral próbál sablonalapú generálást (`public/templates/Cmr.xls`)
- Ha sablon hiányzik → ExcelJS programozott generálásra vált vissza
- Automatikus fallback garantálja a folyamatos működést

#### 4.8.3 Dokumentumok Előzmények

A `DeliveryNotes` táblázatban megőrzött export metaadatok:

| Mező | Leírás |
|------|--------|
| `sequenceNumber` | Sorszám (vevőnkénti inkrementális) |
| `type` | `'delivery'` vagy `'cmr'` |
| `customer` | Vevő neve |
| `orderIds` | Exportált rendelések ID-i |
| `fileName` | Letöltött fájl neve |
| `exportDate` | Export időpontja |
| `exportData` | Exportált adatok snapshot-ja |

---

### 4.9 Modul: ExcelJS Szerkesztő (Template Editor)

#### Célja
Technikai felhasználók számára vizuális editor az ExcelJS-alapú dokumentumgenerálás testreszabásához forráskód módosítás nélkül.

#### Komponensek
- `src/views/TemplateEditorView.tsx`
- `src/components/ExcelJSEditor.tsx`
- `src/components/GithubStyleTemplateEditor.tsx`
- `src/components/HtmlTemplateEditor.tsx`
- `src/components/ExportTemplateEditor.tsx`
- `src/components/CmrVisualEditor.tsx`

#### Funkciók
- Szintaxiskiemeléses kód megjelenítő/szerkesztő
- Élő előnézet valós rendelési adatokkal
- Módosítások mentése és verziókezelés
- Sablon tesztelése kijelölt rendelésekkel

---

### 4.10 Modul: Címkesablonok (Label Templates)

#### Célja
Termék- és szállítási cimkék sablonjainak létrehozása, szerkesztése és nyomtatása.

#### Komponensek
- `src/views/LabelTemplatesView.tsx`
- `src/components/LabelTemplateDialog.tsx`
- `src/components/LabelPrintSettingsDialog.tsx`
- `src/lib/labelTemplate.ts`
- `src/lib/labelExportFormats.ts`

#### Sablonok Tárolása
- Sablonok szöveges formátumban tárolva `useKV`-ban
- Vevőhöz rendelhető (`customer.labelTemplateId`)
- Placeholder változók a `SABLON_VALTOZOK.md` dokumentumban részletezve

---

### 4.11 Modul: Biztonsági Mentés és Visszaállítás (Backup & Restore)

#### Célja
Az összes alkalmazásadat biztonságos mentése és visszaállítása JSON formátumban.

#### Komponensek
- `src/views/BackupRestoreView.tsx`
- `src/components/BackupRestore.tsx`
- `src/components/TemplateBackupRestore.tsx`

#### Backup Tartalom

A mentési fájl a következő adatokat tartalmazza:

| Adattípus | Kulcs | Leírás |
|-----------|-------|--------|
| Rendelések | `orders` | Összes munkarendelés |
| Vevők | `customers` | Vevőadatok |
| Termékek | `products` | Termék/rajzszám adatok |
| Szállítólevelek | `delivery-notes` | Export előzmények |
| CMR beállítások | `cmr-settings` | CMR konfigurációk |
| Vevői sorszámok | `customer-sequences` | Sorszámozási állapot |
| Felhasználók | `users` | Felhasználói fiókok |
| Gyártási műszakok | `production-shifts` | Műszakadatok |

#### Backup Fájl Formátum
```json
{
  "version": "1.0",
  "timestamp": "2026-04-23T07:29:18.970Z",
  "data": {
    "orders": [...],
    "customers": [...],
    "products": [...],
    ...
  },
  "metadata": {
    "orderCount": 142,
    "customerCount": 28,
    "productCount": 67
  }
}
```

**Fájlnév:** `produktivpro-backup-YYYY-MM-DD-HHmm.json`

#### Export Folyamat

```
Kattintás: „Biztonsági mentés létrehozása"
  → Összes useKV adat összegyűjtve
  → JSON fájl összerakva metadata-val
  → Letöltés indul (Blob API)
  → Mentés meta-adata tárolva a rendszerben
  → Toast: „Mentés sikeres – X rendelés, Y vevő, Z termék"
```

#### Import Folyamat

```
Kattintás: „Importálás fájlból"
  → Fájlválasztó megnyílik
  → JSON fájl beolvasva és parse-olva
  → Validáció: helyes struktúra?
    → Hibás → Hibaüzenet
    → Helyes → Megerősítő dialógus
  → Dialógus mutatja: „X rendelés, Y vevő lesz visszaállítva"
  → Felhasználó megerősít
  → Összes jelenlegi adat felülírva a backup-ból
  → Toast: „Visszaállítás sikeres"
```

#### Mentett Backup Lista
- Visszaállítható a rendszerből egy kattintással
- Letölthető JSON-ként (újbóli archívum)
- Metadata: időpont, rekordszámok, fájlméret

---

### 4.12 Modul: Felhasználókezelés (User Management)

#### Célja
Rendszerfelhasználók (admin / user) létrehozása, módosítása és törlése.

#### Komponensek
- `src/components/users/UserManagement.tsx`
- `src/components/users/UserDialog.tsx`

#### Felhasználókezelési Funkcionalitás
- **Csak adminoknak** érhető el (rejtett tab nem-admin felhasználóknál)
- Felhasználó létrehozása: felhasználónév, jelszó, szerepkör megadása
- Jelszó módosítása
- Saját fiók nem törölhető
- Lista: felhasználónév, szerepkör, létrehozás dátuma

---

## 5. UX/UI Specifikáció

### 5.1 Tervezési Irányelvek

| Elv | Leírás |
|-----|--------|
| **Hatékonyság** | Minimalizált kattintásszám, gyors adatbevitel gyártósori operátoroknak |
| **Áttekinthetőség** | Valós idejű státuszjelzők, intuitív vizuális hierarchia |
| **Megbízhatóság** | Perzisztens tárolás, adatvesztés elleni védelem |

### 5.2 Színpaletta

| Szín neve | OKLCH érték | Hex közelítés | Felhasználás |
|-----------|-------------|---------------|--------------|
| Deep Industrial Blue | `oklch(0.35 0.08 250)` | #1e3a5f | Elsődleges szín, navigáció |
| Slate Gray | `oklch(0.50 0.02 250)` | #6b7280 | Másodlagos elemek |
| Steel Blue | `oklch(0.65 0.06 250)` | #4a7fb5 | Interaktív elemek, keretek |
| Electric Orange | `oklch(0.68 0.18 45)` | #ea7028 | Akcentus, kritikus CTA-k |
| Success Green | `oklch(0.65 0.15 145)` | #22c55e | Befejezett állapot |
| Warning Amber | `oklch(0.75 0.15 75)` | #f59e0b | Figyelmeztetések, folyamatban |
| Error Red | `oklch(0.60 0.22 25)` | #dc2626 | Hibák, leállított gyártás |
| Background Light | `oklch(0.97 0.005 250)` | #f8fafc | Oldal háttér |

**Kontrasztarányok (WCAG 2.1 AA megfelelőség):**
- Deep Blue + fehér szöveg: **8.2:1** ✓
- Electric Orange + sötét szöveg: **7.1:1** ✓
- Background + sötét szöveg: **12.5:1** ✓
- Success Green + fehér szöveg: **5.2:1** ✓
- Slate Gray + fehér szöveg: **4.8:1** ✓

### 5.3 Tipográfia

| Stílus | Betűtípus | Méret | Vastagság | Tracking |
|--------|-----------|-------|-----------|---------|
| Oldal cím (H1) | IBM Plex Sans | 32px | Bold | -0.02em |
| Szekció cím (H2) | IBM Plex Sans | 24px | SemiBold | -0.01em |
| Kártya cím (H3) | IBM Plex Sans | 18px | Medium | normal |
| Törzs szöveg | IBM Plex Sans | 15px | Regular | — |
| Számok / ID-k | JetBrains Mono | 14px | Medium | tabular |
| Cimkék | IBM Plex Sans | 13px | Medium | 0.05em (uppercase) |
| Metadata | IBM Plex Sans | 13px | Regular | — |

### 5.4 Animációk

| Animáció | Időtartam | Easing | Leírás |
|----------|-----------|--------|--------|
| Státusz átmenet | 200ms | ease-in-out | Rendelés státuszának színváltása |
| Adatfrissítés | 300ms | pulse | Mennyiség vagy metrika frissülése |
| Modal belépés | 250ms | ease-out | Slide-up + backdrop blur |
| Kártya hover | 100ms | ease-in | Enyhe emelkedés |
| Progress bar | 400ms | cubic-bezier(0.4, 0, 0.2, 1) | Kitöltési animáció |
| Tab váltás | 150ms | ease | Tartalom fade-in |
| Banner belépés | 300ms | ease-out | Slide-down (ShiftValidationBanner) |

### 5.5 Komponens Állapotok

#### Gombok
- **Default:** Stabil megjelenés
- **Hover:** Enyhe emelkedés + keret fényesítés
- **Active:** Lenyomott hatás
- **Disabled:** 50% opacitás

#### Kártyák (rendelések, termékek)
- **Default:** Alap árnyék
- **Hover:** Emelt árnyék, minimális nagyítás (scale: 1.01)
- **Selected:** Elsődleges keret + háttér tint
- **In-progress:** Pulzáló badge animáció

#### Beviteli mezők
- **Default:** Szürke keret
- **Focus:** Elsődleges keret ring + cimke szín változása
- **Error:** Piros keret + helper szöveg

### 5.6 Navigáció

Az alkalmazás **fül-alapú (tab) navigációt** alkalmaz:

| Tab neve | Értéke | Láthatóság |
|----------|--------|-----------|
| Dashboard | `dashboard` | Mindenki |
| Gyártás | `production` | Mindenki |
| Rendelések | `orders` | Mindenki |
| Vevők | `customers` | Mindenki |
| Termékek | `products` | Mindenki |
| Készlet | `inventory` | Mindenki |
| Dokumentumok (dropdown) | — | Mindenki |
| → Szállítólevelek | `documents` | Mindenki |
| → ExcelJS Szerkesztő | `template-editor` | Mindenki |
| → Mentések (sablon) | `template-saves` | Mindenki |
| → Biztonsági mentés | `backup-restore` | Admin |
| Felhasználók | `users` | Csak admin |

### 5.7 Reszponzív Viselkedés

| Elem | Asztali | Mobil |
|------|---------|-------|
| Főnavigáció | Vízszintes tab-sor | Alsó sheet navigáció |
| Dashboard KPI-k | `grid-cols-4` | `grid-cols-1` teljes szélességgel |
| Rendelés kártyák | Kibontott nézet | Összecsukott + bővíthető fiók |
| Dialógusok | Modal overlay | Teljes képernyős |
| Táblázatok | Hagyományos tábla | Kártyaalapú nézet kulcs adatokkal |
| Elsődleges gombok | Helyhez kötött | FAB (lebegő akciógomb) |

---

## 6. Szélsőséges Esetek és Hibakezelés

### 6.1 Üres Állapotok (Empty States)
- Rendelések listája üres: Onboarding üzenet „Hozzon létre első rendelést" gombbal
- Vevők listája üres: Importálási javaslat
- Készletlista üres: Termék hozzáadási javaslat

### 6.2 Beviteli Validáció
| Helyzet | Kezelés |
|---------|---------|
| Negatív mennyiség | Inline hibaüzenet, mentés blokkolva |
| Nem numerikus bevitel | Azonnali validáció React Hook Form segítségével |
| Üres kötelező mező | Piros keret, hibaüzenet mentési kísérletkor |
| Múltbeli határidő | Figyelmeztetés, de engedélyezett |

### 6.3 Importálási Hibák
| Helyzet | Kezelés |
|---------|---------|
| Nem Excel formátum | „Csak .xlsx fájl fogadható el" hibaüzenet |
| Hibás sor az Excelben | Sorszámmal megjelölt hibajelentés |
| Duplikát vevő | Figyelmeztetés, felhasználó dönt az overwrite-ról |
| Részleges import | Hibás sorok kihagyva, sikeresek importálva |
| Üres fájl | „A fájl nem tartalmaz adatot" hibaüzenet |

### 6.4 Export Hibák
| Helyzet | Kezelés |
|---------|---------|
| Nincs kijelölt rendelés | „Legalább egy rendelést válasszon ki" toast |
| Hiányzó vevői adatok | Figyelmeztetés az exportálás előtt |
| Elégtelen készlet | Figyelmeztető dialógus megerősítési lehetőséggel |
| ExcelJS generálási hiba | Hiba toast, konzol log, fallback kísérlet |
| Hiányzó CMR sablon | Automatikus fallback programozott generálásra |

### 6.5 Adatvédelem és Adatvesztés Elleni Védelem
- `useKV` automatikus perzisztencia (nincs explicit mentés gomb szükség)
- Törlési műveletek megerősítő dialógussal
- Backup rendszer teljes adatveszteség esetén
- Navigáció közben nincs adat elveszítve

### 6.6 Teljesítmény Hosszú Listáknál
- 20+ elem esetén keresés és szűrés elengedhetetlen
- `use-virtual-scroll.ts` hook a nagy listák virtualizálásához
- Táblázat oszlopszűrők a releváns adatok gyors megtalálásához

### 6.7 Erőforrás Konfliktusok
- Erőforrás dupla kiosztás vizuális figyelmeztetéssel jelezve
- Automatikus ellenőrzés hozzárendeléskor

---

## 7. Biztonsági Követelmények

| Követelmény | Jelenlegi állapot | Javasolt javítás |
|-------------|-------------------|-----------------|
| Jelszó tárolás | Base64 obfuszkáció | bcrypt hash éles környezetben |
| Session kezelés | useKV lokális tárolás | Szerver-oldali session éles ézetben |
| Felhasználói adatok | Lokális tárolás | Titkosított tároló éles ézetben |
| Hozzáférés-vezérlés | Kliens-oldali szerepkör | Szerver-oldali ellenőrzés éles üzemben |
| Érzékeny adatok | Nem titkosítottak | TLS + at-rest titkosítás |

> ⚠️ **Fontos:** A jelenlegi implementáció fejlesztői/prototípus környezetre tervezett. Éles gyártási üzembe helyezés előtt kötelező a biztonsági architektúra felülvizsgálata.

---

## 8. Integrációk

### 8.1 GitHub Spark Platform
- `@github/spark` SDK (>=0.43.1 <1)
- `useKV` hook – perzisztens kulcs-érték tár
- Spark meta konfiguráció: `spark.meta.json`

### 8.2 Excel Ekoszisztéma
| Könyvtár | Verzió | Felhasználás |
|----------|--------|--------------|
| ExcelJS | ^4.4.0 | Szállítólevél és CMR programozott generálása |
| xlsx | ^0.18.5 | Tömeges importálás (vevők, termékek) |
| xlsx-template | ^1.4.7 | Sablonalapú CMR export |

### 8.3 Adatvizualizáció
- **Recharts** – Dashboard diagramok (PieChart, LineChart, BarChart)
- **D3.js** – Haladó vizualizációk (v7.9.0)

---

## 9. Elfogadási Kritériumok Összefoglalója

### 9.1 Funkcionális Kritériumok

| Modul | Kritérium |
|-------|-----------|
| Rendeléskezelés | Rendelések perzisztensek maradnak oldal-frissítés után; státuszok valós időben frissülnek |
| Gyártáskövetés | Timestamps pontosan rögzítve; lövésszám × fészekszám = darabszám helyesen |
| Készlet | Automatikus frissítés hibátlanul műszakrögzítéskor; exportáláskor elégtelen készlet jelzett |
| Dokumentumexport | Szállítólevél és CMR generálás < 5 mp; fájlnév sorszámmal; ExcelJS formázás korrekt |
| Biztonsági mentés | JSON teljes adathalmazt tartalmaz; visszaállítás megerősítéssel; fájlnév konvenciót követi |
| Műszak validáció | Hiány detektálás 7 napra visszamenőleg; banner csak valós hiánynál jelenik meg |
| Hitelesítés | Admin látja a Felhasználók tabot; user nem látja; munkamenet oldalfrissítés után megmarad |

### 9.2 Nem-Funkcionális Kritériumok

| Kritérium | Elvárás |
|-----------|---------|
| **Teljesítmény** | 500 rendelés betöltési ideje < 2 másodperc |
| **Reszponzivitás** | Teljesen működőképes 320px szélességtől |
| **Akadálymentesség** | WCAG 2.1 AA kontrasztarányok |
| **Böngészőtámogatás** | Chrome 120+, Firefox 121+, Safari 17+ |
| **Offline működés** | Lokális adatok elérhetők hálózat nélkül is |

---

## 10. Jövőbeli Fejlesztési Irányok

| Prioritás | Funkció | Leírás |
|-----------|---------|--------|
| 🔴 Magas | Szerver-oldali hitelesítés | Valós bcrypt jelszó hash, JWT tokenek |
| 🔴 Magas | Valós adatbázis backend | Felhőalapú perzisztencia több felhasználóhoz |
| 🟡 Közepes | E-mail értesítések | Határidő közeledés, hiányzó műszakadatok |
| 🟡 Közepes | Mobil alkalmazás (PWA) | Progressive Web App wrapper |
| 🟡 Közepes | Vonalkód / QR kód olvasás | Termék azonosítás gyártósoron |
| 🟢 Alacsony | Többnyelvű UI | Magyar + angol + román felület |
| 🟢 Alacsony | API integráció | ERP rendszerekkel való kapcsolat (SAP, stb.) |
| 🟢 Alacsony | Fejlett analitika | Gépi tanuláson alapuló termelési előrejelzés |

---

## 11. Glosszárium

| Fogalom | Definíció |
|---------|-----------|
| **MES** | Manufacturing Execution System – Gyártásvégrehajtási rendszer |
| **CMR** | Convention relative au contrat de transport international de Marchandises par Route – Nemzetközi közúti árufuvarozási szerződés |
| **Szállítólevél** | Hazai kiszállítási dokumentum a termékek átadásakor |
| **Fészekszám** | Az injektálószerszám fészkeinek száma (egy lövés = N db termék) |
| **Lövésszám** | Az injektáló gép lövetszáma egy műszakban |
| **useKV** | GitHub Spark perzisztens kulcs-érték tár hook |
| **ExcelJS** | Node.js/browser alapú Excel generáló könyvtár |
| **KPI** | Key Performance Indicator – Kulcsteljesítmény-mutató |
| **CRUD** | Create, Read, Update, Delete – alap adatkezelési műveletek |
| **Zod** | TypeScript-first schema validációs könyvtár |
| **Radix UI** | Akadálymentesített, stílus-semleges React komponens primitívek |
| **de / du** | Délelőtti / Délutáni műszak rövidítése |

---

*Dokumentum vége – ProduktívPro PRD v1.0*
