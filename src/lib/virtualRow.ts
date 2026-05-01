/**
 * Soros virtualizáció CSS-alapú megközelítéssel.
 *
 * A Radix `<ScrollArea>` és a HTML `<table>` natív layout-algoritmusa miatt a
 * klasszikus, abszolút-pozícionálással dolgozó virtual list (pl. react-window
 * vagy react-virtual) töri a kolumnák igazítását — minden sor oszlopainak
 * mérete külön kell, hogy egyezzen, ami abszolút pozícionálással nehéz.
 *
 * Helyette `content-visibility: auto` + `contain-intrinsic-size` páros: a
 * modern böngészők (Chrome 85+, Safari 18+, Firefox 125+) ekkor automatikusan
 * **kihagyják az offscreen sorok layout- és festési munkáját**. A
 * `contain-intrinsic-size` egy "fake" magasságot ad a sornak, amíg láthatatlan,
 * így a teljes táblázat scroll-magassága helyes marad.
 *
 * Ennek az előnye:
 *  - Nincs JS futás minden scroll-eseménynél (a böngésző natívan kezeli).
 *  - Nem kell sorhoz height-ot kalibrálni (browser igazítja a tényleges sorhoz
 *    az első kifestés után).
 *  - Nem töri sem a sticky table-headert, sem a horizontális scrollt.
 *
 * Ez a lib-modul mindössze egy közös style-objektumot exportál, hogy ne
 * ismétlődjön a két nagy táblában (OrdersTable, AuditLogView).
 */
import type { CSSProperties } from 'react'

/**
 * Csak a sorra (`<tr>`) kell rátenni — a böngésző automatikusan virtualizál.
 * A `48px` egy konzervatív becslés egyetlen sor magasságára; ha a tényleges
 * sor magasabb, az első festés után újraszámolódik. Ez csak az első kifestés
 * előtti scroll-méret számításához számít, a végső layout pontos.
 */
export const VIRTUAL_ROW_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  // contain-intrinsic-size: <inline> <block>  (cross-axis | block-axis)
  containIntrinsicSize: '0 48px',
}

/**
 * Audit-naplóhoz tartozó variáns — egy bejegyzés `<Collapsible>` lehet, és a
 * fejléc-sor magassága ott picit nagyobb a `Badge` miatt.
 */
export const VIRTUAL_AUDIT_ROW_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '0 56px',
}

/**
 * Pagináció küszöb — ennél több sornál érdemes az OrdersTable-ben "lapozott"
 * megjelenítést adni, hogy az első festés ne kelljen N ezer DOM-csomópontot
 * felépítsen. A user explicit gombbal kérheti az összes sor mutatását.
 */
export const ORDERS_TABLE_PAGE_SIZE = 500
