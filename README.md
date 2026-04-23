# ✨ Welcome to Your Spark Template!
You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?
- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas
  
🧠 What Can You Do?

Right now, this is just a starting point — the perfect place to begin building and testing your Spark applications.

🧹 Just Exploring?
No problem! If you were just checking things out and don’t need to keep this code:

- Simply delete your Spark.
- Everything will be cleaned up — no traces left behind.

📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## CMR Excel Sablon Integrációja

A projekt támogatja a sablon-alapú CMR Excel exportokat az `xlsx-template` könyvtár segítségével.

### Beállítás:

1. Telepítsd a függőségeket:
   ```bash
   npm install
   ```

2. A sablon mappa helye:
   ```
   public/templates/
   ```

3. Helyezd el a CMR sablon fájlt ide:
   ```
   public/templates/Cmr.xls
   ```

### Sablon Placeholder-ek

A CMR sablonban az alábbi placeholder-ek használhatók:

**Kötelező mezők:**
- `${szallitolevel_szama}` - K1 cella - Szállítólevél száma
- `${customer_name}` - A6 cella - Vevő neve
- `${customer_address}` - A7 cella - Vevő címe
- `${customer_city}` - B12 cella - Vevő városa
- `${customer_country}` - B13 cella - Vevő országa

**További elérhető mezők:** Részleteket lásd a `CMR_SABLON_CELLAMAPPING.md` fájlban.

### Dokumentáció

- **CMR_SABLON_CELLAMAPPING.md** - Részletes placeholder leírások és példák
- **CMR_TESZT_UTMUTATO.md** - Lépésről lépésre tesztelési útmutató
- **CMR_SABLON_UTMUTATO.md** - Általános útmutató

### Működés

Az export folyamat először megpróbálja a sablon-alapú generálást. Ha a sablon hiányzik vagy hibás, visszaáll a táblázat-alapú XLSX exportra.
