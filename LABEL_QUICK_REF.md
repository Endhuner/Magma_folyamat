# Címke Hibakeresés - Gyors Referencia

## Termék-Párosítás Folyamat

```
Rendelés → Vevő Egyezés? → Rajzszám VAGY Név Egyezés? → ✅ PÁROSÍTVA
                ↓ NEM                    ↓ NEM
            ❌ HIBA                   ❌ HIBA
```

## Konzol Jelek Gyors Értelmezése

| Jel | Jelentés | Státusz |
|-----|----------|---------|
| ✅ | TALÁLAT! Párosítás sikeres | OK |
| ⚠️ | Vevő egyezik, DE termék nem | HIBA - Ellenőrizd rajzszámot |
| ❌ | NEM TALÁLHATÓ | HIBA - Ellenőrizd vevőt |
| ✓ | Egyezés | OK |
| ✗ | Nem egyezik | Nem OK |
| 🎯 | Párosítás sikeres | OK |
| 💡 | Megoldási javaslat | Olvasd el |
| ❗ | Figyelmeztetés | Cselekedj |

## Gyakori Hibák Gyors Fix

### ❌ "Nincs egyetlen termék sem a vevőhöz"
**FIX:** Termékek menü → Új Termék → Vevő mező = rendelés vevője

### ❌ "productName nem egyezik egyik termék rajzszámával sem"
**FIX:** 
- Rendelés: productName = termék rajzszáma VAGY
- Termék: drawingNumber = rendelés productName

### ❌ "piecesPerBox: ÜRES"
**FIX:** Termékek menü → Szerkesztés → Doboz/db kitöltése

## Konzol Megnyitás

**Windows/Linux:** `Ctrl + Shift + I` → Console fül  
**Mac:** `Cmd + Option + I` → Console fül  
**Firefox:** `Ctrl + Shift + K`

## Tesztelési Checklist

- [ ] Konzol nyitva
- [ ] Rendelés kiválasztva
- [ ] Címkék generálása gomb
- [ ] Log végignézése
- [ ] Minden rendelés megtalált terméket? (✅)
- [ ] Minden piecesPerBox kitöltött?
- [ ] Összefoglaló ellenőrzése

## Diagnosztikai Parancsok (Konzolban)

```javascript
// Összes termék listázása
await spark.kv.get('products')

// Összes rendelés listázása
await spark.kv.get('orders')

// Összes vevő listázása
await spark.kv.get('customers')

// Címke sablonok
await spark.kv.get('label-templates')
```

## Párosítási Szabályok (Kód Szinten)

```javascript
// 1. Vevő egyezés (KÖTELEZŐ)
p.customer.trim().toLowerCase() === order.customer.trim().toLowerCase()

// 2A. Rajzszám egyezés (VAGY)
p.drawingNumber.trim().toLowerCase() === order.productName.trim().toLowerCase()

// 2B. Terméknév egyezés (VAGY)
p.productName.trim().toLowerCase() === order.productName.trim().toLowerCase()
```

## Konzol Log Szekciók

1. **Fejléc** - Általános info (rendelések, termékek száma)
2. **Rendelés Adatok** - Egy rendelés minden adata
3. **Termék Keresés** - Párosítási kísérletek
4. **Hibadiagnózis** - Ha nincs találat
5. **Címke Adatok** - Mit fog tartalmazni a címke
6. **Összefoglaló** - Statisztikák

## Mikor NEM Szükséges Termék-Párosítás

A címke mindig generálódik, de termék nélkül:
- ❌ `piecesPerBox` üres marad
- ⚠️ `drawingNumber` = `order.productName` lesz

## Támogatás

Részletes útmutató: `LABEL_TESTING_GUIDE.md`

## Példa Sikeres Log

```
┌─────────────────────────────────────────────────────────────┐
│ 📝 RENDELÉS #1/3
│ Saját rendelési szám:  R2025-001
│ Vevő neve:             ABC Kft
│ Termék név:            PART-123
└─────────────────────────────────────────────────────────────┘

🔍 TERMÉK KERESÉS...
   ✅ [1] TALÁLAT!
       Vevő egyezés: ✓
       Rajzszám egyezés: ✓
       Doboz/db: 50

   🎯 PÁROSÍTÁS SIKERES!

📋 CÍMKE ADATOK:
   drawingNumber (címkén):  PART-123
   piecesPerBox (címkén):   50
   
✅ Címkék hozzáadva
```

## Példa Hibás Log

```
┌─────────────────────────────────────────────────────────────┐
│ 📝 RENDELÉS #2/3
│ Termék név:            WRONG-NAME
└─────────────────────────────────────────────────────────────┘

🔍 TERMÉK KERESÉS...
   ⚠️  [1] Vevő egyezik, DE termék nem
       Rajzszám egyezés: ✗ (termék: "PART-123" <=> rendelés: "WRONG-NAME")

❌ NEM TALÁLHATÓ TERMÉK!
💡 MEGOLDÁS: Rendelés productName = "PART-123"
```
