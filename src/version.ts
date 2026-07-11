/**
 * Az alkalmazás verziószáma — a fejlécben jelenik meg, hogy egy pillantással
 * látszódjon, melyik verzió fut (települt-e a frissítés).
 *
 * MINDEN érdemi kiadásnál ITT léptesd a számot. A CI a main-ág buildnél ezt
 * olvassa ki és injektálja (VITE_APP_VERSION); git-tag push esetén a tag írja
 * felül. Így a fejlécben mindig tiszta verziószám van (nem dev-<sha>).
 */
export const APP_VERSION = 'v1.47.0'
