# Címke Sablon Tesztelési Útmutató

## Áttekintés

Ez a dokumentum részletesen leírja a címke sablonok tesztelési folyamatát, különös tekintettel a termék-párosítási hibák azonosítására a konzol logok alapján.

## Termék-Párosítás Logikája

A címke generálás során a rendszer a következő logika alapján párosítja a rendeléseket a termékekkel:

### 1. Vevő Egyezés (KÖTELEZŐ)
```
termék.customer === rendelés.customer
```
- Kis/nagybetű nem számít (toLowerCase)
- Whitespace-ek eltávolítva (trim)

### 2. Termék Azonosítás (VAGY kapcsolat)
A vevő egyezés után a következő két kritérium közül LEGALÁBB EGYNEK teljesülnie kell:

**A) Rajzszám alapú párosítás:**
```
termék.drawingNumber === rendelés.productName
```

**B) Terméknév alapú párosítás:**
```
termék.productName === rendelés.productName
```

## Konzol Log Struktúra

### Címke Generálás (generateLabels)

```
═══════════════════════════════════════════════════════════════
🏷️  CÍMKE GENERÁLÁS - RÉSZLETES TESZT ANALÍZIS
═══════════════════════════════════════════════════════════════
📊 Rendelések száma: X
📦 Termékek száma az adatbázisban: Y
👥 Vevők száma: Z
═══════════════════════════════════════════════════════════════
```

### Rendelés Feldolgozás

```
┌─────────────────────────────────────────────────────────────┐
│ 📝 RENDELÉS #1/X
├─────────────────────────────────────────────────────────────┤
│ Saját rendelési szám:  [order.ownOrderNumber]
│ Vevő rendelési szám:   [order.orderNumber]
│ Vevő neve:             [order.customer]
│ Termék név (productName): [order.productName]
│ Megnevezés (designation): [order.designation]
│ Dobozok száma:         [order.boxesCount]
│ Megjegyzések:          [order.notes]
└─────────────────────────────────────────────────────────────┘
```

### Termék Keresés Részletei

```
🔍 TERMÉK KERESÉS A PRODUCTS TÁBLÁBAN...
   Keresési kritériumok:
   1️⃣ Vevő egyezés: rendelés.customer === termék.customer
   2️⃣ Rajzszám egyezés: rendelés.productName === termék.drawingNumber
   3️⃣ Terméknév egyezés: rendelés.productName === termék.productName

   Összes termék ellenőrzése (Y db):

   ✅ [1] TALÁLAT!
       Termék vevő: "..."
       Termék rajzszám: "..."
       Termék név: "..."
       Vevő egyezés: ✓
       Rajzszám egyezés: ✓
       Terméknév egyezés: ✗
       Doboz/db: XX

   🎯 PÁROSÍTÁS SIKERES! Termék index: 1
```

vagy ha nem találat:

```
   ⚠️  [1] Vevő egyezik, DE termék nem
       Termék vevő: "..."
       Termék rajzszám: "..."
       Termék név: "..."
       Vevő egyezés: ✓
       Rajzszám egyezés: ✗ (termék: "XXX" <=> rendelés: "YYY")
       Terméknév egyezés: ✗ (termék: "AAA" <=> rendelés: "YYY")
       Doboz/db: (nincs megadva)
```

### Hibadiagnózis

Ha nincs találat:

```
❌ NEM TALÁLHATÓ TERMÉK!
⚠️  PROBLÉMA DIAGNÓZIS:

❗ Nincs egyetlen termék sem a "VEVŐ NEVE" vevőhöz
💡 Ellenőrizd: a termékek táblában szerepel-e ez a vevő
```

vagy

```
ℹ️  Van X db termék ehhez a vevőhöz:
   1. Rajzszám: "...", Név: "..."
   2. Rajzszám: "...", Név: "..."

❗ A rendelés productName értéke ("XXX") nem egyezik
   egyik termék rajzszámával vagy nevével sem!

💡 MEGOLDÁS: Ellenőrizd, hogy a rendelésben szereplő
   productName pontosan megegyezik-e egy termék drawingNumber
   vagy productName értékével (kis/nagybetű nem számít)
```

### Címke Adatok Összeállítása

```
📋 CÍMKE ADATOK ÖSSZEÁLLÍTÁSA:
   productName (címkén):    [érték]
   drawingNumber (címkén):  [érték]
   piecesPerBox (címkén):   [érték vagy ❌ ÜRES]
   ownOrderNumber:          [érték]
   orderNumber:             [érték]
   requiredDate:            [érték]
   customerName:            [érték]
   notes:                   [érték]
   boxesCount:              [érték]

📦 Címkék létrehozása: X db címke ehhez a rendeléshez
✅ Címkék hozzáadva (összesen eddig: Y db)
```

### Összefoglaló

```
═══════════════════════════════════════════════════════════════
📊 ÖSSZEFOGLALÓ
═══════════════════════════════════════════════════════════════
Feldolgozott rendelések: X
Létrehozott címkék: Y
Termékkel párosított: Z db
Termék nélküli: W db
═══════════════════════════════════════════════════════════════
```

## Gyakori Hibák és Megoldások

### 1. Termék nem található a vevőhöz

**Tünet:**
```
❗ Nincs egyetlen termék sem a "VEVŐ NEVE" vevőhöz
```

**Ok:** A termékek táblában nincs egyetlen termék sem, ahol a `customer` mező megegyezik a rendelés vevő nevével.

**Megoldás:**
1. Ellenőrizd, hogy a vevő neve pontosan ugyanaz-e a rendelésben és a termékekben
2. Hozz létre terméket a vevőhöz a Termékek menüben
3. Győződj meg róla, hogy a termék `customer` mezője pontosan egyezik

### 2. Termék rajzszám/név nem egyezik

**Tünet:**
```
❗ A rendelés productName értéke ("XXX") nem egyezik
   egyik termék rajzszámával vagy nevével sem!
```

**Ok:** A rendelés `productName` mezője nem egyezik meg egyik termék `drawingNumber` vagy `productName` mezőjével sem.

**Megoldás:**
1. Ellenőrizd a konzol logban felsorolt termékeket
2. A rendelés productName értékének pontosan egyeznie kell egy termék rajzszámával vagy nevével
3. Módosítsd vagy a rendelés productName mezőjét, vagy a termék rajzszámát/nevét

### 3. Doboz/db érték üres

**Tünet:**
```
piecesPerBox (címkén):   ❌ ÜRES
```

**Ok:** A termék megtalálható, de nincs kitöltve a `piecesPerBox` mező.

**Megoldás:**
1. Lépj a Termékek menübe
2. Szerkeszd a terméket
3. Töltsd ki a "Doboz/db" mezőt

### 4. Pontatlan párosítás

**Tünet:** Több termék is megfelel ugyanannak a vevőnek, de rossz termék van kiválasztva.

**Megoldás:**
1. Pontosítsd a termékek rajzszámait, hogy egyediek legyenek
2. Használj egyértelmű rajzszámokat a rendelésekben
3. Ellenőrizd a termékek elnevezését

## Tesztelési Lépések

### 1. Konzol Megnyitása
1. Nyisd meg a böngésző konzolt (F12 vagy Ctrl+Shift+I)
2. Menj a "Console" fülre

### 2. Címke Generálás Indítása
1. Jelölj ki egy vagy több rendelést
2. Kattints a "Címkék generálása" gombra
3. Figyeld a konzol logokat

### 3. Log Elemzése
1. Olvasd végig a részletes logokat minden rendeléshez
2. Ellenőrizd, hogy minden rendelés megtalálja a megfelelő terméket
3. Ellenőrizd, hogy a piecesPerBox értékek kitöltöttek-e
4. Nézd meg az összefoglalót

### 4. Hibakeresés
1. Ha van "❌ NEM TALÁLHATÓ TERMÉK!" üzenet, kövesd a diagnózist
2. Javítsd a hibát az adatokban
3. Generáld újra a címkéket
4. Ellenőrizd a javítást a logokban

## Előnézet Mód

Az előnézet mód hasonló logokat ad, de rövidebb formában:

```
═══════════════════════════════════════════════════════════════
👁️  CÍMKE ELŐNÉZET - TESZT MÓD
═══════════════════════════════════════════════════════════════
Rendelések száma: X (max 3 címke/rendelés)
═══════════════════════════════════════════════════════════════

🔍 ELŐNÉZET RENDELÉS #1: [ownOrderNumber]
✅ Termék megtalálva: [drawingNumber] - [productName]

vagy

❌ Termék nem található a products táblában

📊 ELŐNÉZET ÖSSZESEN: X címke
```

## Vevőnkénti Generálás

```
═══════════════════════════════════════════════════════════════
📂 CÍMKE GENERÁLÁS VEVŐNKÉNT (KÜLÖN FÁJLOK)
═══════════════════════════════════════════════════════════════
Rendelések száma: X
Termékek száma: Y
═══════════════════════════════════════════════════════════════

📊 Vevők csoportosítva: Z vevő

   VEVŐ 1: X rendelés
   VEVŐ 2: Y rendelés
   ...

┌─────────────────────────────────────────────────────────────┐
│ 🏢 VEVŐ: [customerName]
│ Rendelések: X db
└─────────────────────────────────────────────────────────────┘
✅ Egyedi sablon: "[templateName]"

vagy

ℹ️  Nincs egyedi sablon, alapértelmezett használata

   ✓ [ownOrderNumber]: [drawingNumber] → X címke
   ✗ [ownOrderNumber]: Termék nem található → Y címke

📄 Fájl létrehozása: Z címke (W oldal)

═══════════════════════════════════════════════════════════════
✅ VEVŐNKÉNTI CÍMKE GENERÁLÁS BEFEJEZVE
═══════════════════════════════════════════════════════════════
Összes címke: X
Vevők száma: Y
Egyedi sablonnal: Z
Alapértelmezett sablonnal: W
═══════════════════════════════════════════════════════════════
```

## Javaslatok

### Adatok Konzisztenciája
- Használj egyértelmű, egyedi rajzszámokat minden termékhez
- Tartsd konzisztensen a vevők neveit a rendelésekben és a termékekben
- Ellenőrizd rendszeresen a termékek piecesPerBox értékeit

### Tesztelési Folyamat
1. Először tesztelj kis mintával (1-2 rendelés)
2. Ellenőrizd a konzol logokat
3. Javítsd a talált hibákat
4. Skálázd fel nagyobb mintára
5. Végső ellenőrzés az összefoglalóval

### Hibajelentés
Ha hibát találsz a címke generálás logikájában:
1. Mentsd el a teljes konzol logot
2. Jelöld meg a problémás rendelés adatait
3. Készíts képernyőképet a termékek táblából az érintett termékről
4. Mellékeld a generált címkék tartalmát

## Támogatott Funkciók

- ✅ Részletes termék-párosítási logolás
- ✅ Hibadiagnózis automatikus generálása
- ✅ Összefoglaló statisztikák
- ✅ Vevőnkénti külön fájl generálás logolása
- ✅ Előnézet mód leegyszerűsített logolással
- ✅ Egyedi sablon használat követése

## Korlátok

- A logolás csak a konzolban jelenik meg
- Nagyon nagy mennyiségű rendelésnél (100+) a konzol telhet
- A logok nem kerülnek mentésre automatikusan

## Verziótörténet

**v2.0 (Jelenlegi)**
- Részletes, strukturált logolás minden párosítási lépésnél
- Automatikus hibadiagnózis
- Termék-szintű ellenőrzések minden vevőnél
- Összefoglaló statisztikák

**v1.0 (Korábbi)**
- Alapvető logolás termék találatról/nem találatról
- Minimális részletek
