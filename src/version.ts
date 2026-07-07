/**
 * Az alkalmazás verziószáma — a fejlécben jelenik meg, hogy egy pillantással
 * látszódjon, melyik verzió fut (települt-e a frissítés).
 *
 * MINDEN érdemi kiadásnál ITT léptesd a számot. Ez a fallback: ha a Docker
 * build git-tagből kap verziót (VITE_APP_VERSION), az felülírja; ha nem
 * (pl. sima :latest deploy), akkor ez a szám látszik — tehát tag nélkül is
 * mindig van értelmes verzió a fejlécben.
 */
export const APP_VERSION = 'v1.44.4'
