# CMR Sablon Mezők Tesztelési Útmutató

## Áttekintés

Ez az útmutató részletesen bemutatja, hogyan tesztelheted a CMR sablon mezőinek helyes működését rendelés exportálásával.

## Előfeltételek

### 1. CMR Sablon Fájl Ellenőrzése

A CMR sablon fájlnak tartalmaznia kell a következő placeholder-eket:

**Fájl helye:** `/public/templates/Cmr.xls`

**Kötelező placeholder-ek:**

| Cella | Placeholder | Elvárt érték példa |
|-------|-------------|-------------------|
| K1 | `${szallitolevel_szama}` | CMR-2025-001 |
| A6 | `${customer_name}` | Test Vevő Kft |
| A7 | `${customer_address}` | Test utca 10, 1234 Budapest, Hungary |
| B12 | `${customer_city}` | Budapest |
| B13 | `${customer_country}` | Hungary |

**Opcionális placeholder-ek (tetszőleges cellákban):**
- `${senderName}` - Feladó neve
- `${senderAddress}` - Feladó címe
- `${senderTaxNumber}` - Feladó adószáma
- `${marksAndNumbers}` - Rajzszámok
- `${numberOfPackages}` - Dobozok száma
- `${grossWeightKg}` - Bruttó súly
- `${ownOrderNumber}` - Saját rendelési szám
- `${customerOrderNumber}` - Vevő rendelési száma

## Tesztelési Lépések

### Lépés 1: Vevő Létrehozása

1. Kattints a **"Vevők"** fülre
2. Kattints az **"Új Vevő"** gombra
3. Töltsd ki a következő mezőket:

```
Vevő név: Test Vevő Kft
Szállító nyelve: Magyar
Város: Budapest
Irányítószám: 1234
Utca, házszám: Test utca 10
Ország: Hungary
Adószám: 12345678-1-23
```

4. Kattints a **"Mentés"** gombra

### Lépés 2: Termék Létrehozása

1. Kattints a **"Termékek"** fülre
2. Kattints az **"Új Termék"** gombra
3. Töltsd ki a következő mezőket:

```
Ügyfél: Test Vevő Kft
Termék rajzszáma: TEST-001
Termék megnevezés: Teszt termék
Anyag: Acél
Súly/db: 100
Doboz/db: 50
Doboz/Raklap: 10
```

4. Kattints a **"Mentés"** gombra

### Lépés 3: Rendelés Létrehozása

1. Kattints a **"Rendelések"** fülre
2. Kattints az **"Új rendelés"** gombra
3. Töltsd ki a következő mezőket:

```
Customer: Test Vevő Kft (válaszd ki a listából)
Termék: TEST-001 (válaszd ki a listából)
Anyag: (automatikusan kitöltődik)
Megnevezése: (automatikusan kitöltődik)
Vevő rendelési száma: VEVO-2025-001
Amount/pc: 500
Order date: (mai dátum)
Required delivery date: (jövő heti dátum)
```

4. Kattints a **"Mentés"** gombra

### Lépés 4: CMR Beállítások Ellenőrzése

1. A fejlécben kattints a **"CMR beállítások"** gombra
2. Ellenőrizd a feladó adatokat:

```
Feladó neve: Magma Kft (vagy saját cégnév)
Feladó címe: H-1211 Budapest, Déli utca 13. (vagy saját cím)
Feladó adószáma: HU10368152-2-43 (vagy saját adószám)
Áru átvételének helye: Budapest, Hungary
Kiállítás helye: Budapest
```

3. Kattints a **"Mentés"** gombra

### Lépés 5: Rendelés Exportálása CMR-ként

1. A **"Rendelések"** fülön jelöld ki az előbb létrehozott rendelést (checkbox)
2. Kattints a **"CMR"** gombra
3. A megjelenő előnézeti ablakban ellenőrizd:
   - Az összes oszlop megjelenik-e
   - A vevő adatai helyesek-e
   - A termék adatok helyesek-e

4. Opcionálisan add meg a szállítólevél számát (pl. `TEST-2025-001`)
5. Kattints az **"Excel letöltés"** gombra

### Lépés 6: Letöltött Fájl Ellenőrzése

1. Nyisd meg a letöltött `.xlsx` fájlt Excel-ben vagy LibreOffice Calc-ban
2. Ellenőrizd a következő cellákat:

**K1 cella:** 
- ✅ Helyes: `CMR-2025-001` (vagy a megadott szállítólevél szám)
- ❌ Hibás: `${szallitolevel_szama}` vagy üres

**A6 cella:**
- ✅ Helyes: `Test Vevő Kft`
- ❌ Hibás: `${customer_name}` vagy üres

**A7 cella:**
- ✅ Helyes: `Test utca 10, 1234 Budapest, Hungary`
- ❌ Hibás: `${customer_address}` vagy üres

**B12 cella:**
- ✅ Helyes: `Budapest`
- ❌ Hibás: `${customer_city}` vagy üres

**B13 cella:**
- ✅ Helyes: `Hungary`
- ❌ Hibás: `${customer_country}` vagy üres

### Lépés 7: További Mezők Tesztelése

Ha a sablonban további placeholder-eket helyeztél el, ellenőrizd azokat is:

- **Feladó adatok:** Jelenjenek meg a beállításokban megadott értékek
- **Rajzszámok:** `TEST-001`
- **Dobozok száma:** `10` (500 db / 50 db/doboz = 10)
- **Raklapok száma:** `1` (10 doboz / 10 doboz/raklap = 1)
- **Bruttó súly:** `~70 kg` (50 kg termék + 20 kg raklap)

## Gyakori Problémák és Megoldások

### Probléma 1: A placeholder-ek nem cserélődnek ki

**Tünet:** A letöltött fájlban látható: `${customer_name}` helyett az értéke

**Megoldás:**
1. Ellenőrizd, hogy a sablon fájl helyes helyen van: `/public/templates/Cmr.xls`
2. Ellenőrizd, hogy a placeholder pontosan `${változónév}` formátumú (nincs extra szóköz)
3. Próbáld újra menteni a sablon fájlt Excel-ben

### Probléma 2: Üres cellák a letöltött fájlban

**Tünet:** A cellák üresek, nem tartalmazzák se a placeholder-t, se az értéket

**Okok és megoldások:**
- **Vevő adatok hiányoznak:** Ellenőrizd, hogy a vevőnél ki vannak-e töltve a város, ország, cím mezők
- **Termék adatok hiányoznak:** Ellenőrizd, hogy a termék ki van-e töltve a rendelésben
- **Sablon hiba:** A placeholder lehet, hogy rosszul van formázva

### Probléma 3: A fájl nem töltődik le

**Tünet:** A "CMR" gombra kattintva nem történik semmi

**Megoldás:**
1. Nyisd meg a böngésző konzolt (F12)
2. Keresd a hibaüzeneteket
3. Ellenőrizd, hogy van-e kijelölt rendelés
4. Próbáld meg csak egy rendelést kijelölni

### Probléma 4: Hibás számítások (dobozok, raklapok)

**Tünet:** A dobozok vagy raklapok száma nem helyes

**Megoldás:**
1. Ellenőrizd a termék adatlapon:
   - Doboz/db értéke helyes-e
   - Doboz/Raklap értéke helyes-e
2. A számítás mindig felfelé kerekít (ceil)
3. Üres vagy 0 érték esetén nem számol

## Tesztelési Checklist

Használd ezt a checklistet a teljes körű teszteléshez:

- [ ] Vevő létrehozva minden kötelező adattal
- [ ] Termék létrehozva a vevőhöz
- [ ] Rendelés létrehozva 500 db mennyiséggel
- [ ] CMR beállítások ellenőrizve
- [ ] Rendelés kijelölve
- [ ] CMR gomb kattintva
- [ ] Előnézet megjelent
- [ ] Szállítólevél szám megadva
- [ ] Excel letöltve
- [ ] K1 cella helyesen kitöltve
- [ ] A6 cella helyesen kitöltve
- [ ] A7 cella helyesen kitöltve
- [ ] B12 cella helyesen kitöltve
- [ ] B13 cella helyesen kitöltve
- [ ] Dobozok száma helyesen számolva (10)
- [ ] Raklapok száma helyesen számolva (1)
- [ ] Bruttó súly helyesen számolva (~70 kg)
- [ ] Szállítólevél a rendeléshez csatolva

## Következő Lépések

Ha minden teszt sikeres volt:

1. ✅ A CMR sablon helyesen működik
2. ✅ Tovább tudod használni éles rendelésekkel
3. ✅ Testre tudod szabni a sablon kinézetét Excel-ben

Ha voltak hibák:

1. Kövesd a "Gyakori Problémák és Megoldások" részt
2. Ellenőrizd a CMR_SABLON_CELLAMAPPING.md fájlt
3. Ha szükséges, kérd segítségemet

## Sablon Testreszabása

Ha minden működik, most már testreszabhatod a sablont:

1. Nyisd meg a `/public/templates/Cmr.xls` fájlt
2. Formázd a cellákat (betűméret, szín, keretek)
3. Helyezz el további placeholder-eket a fenti listából
4. Mentsd el a fájlt
5. Teszteld újra az exportot

A placeholder-ek helyére mindig az aktuális adatok kerülnek, de a formázás megmarad!
