/**
 * Navigációs konfiguráció — az egyetlen igazságforrás a menüről, az
 * útvonalakról és a szerepkör-jogosultságokról. A sidebar, a route-őrök
 * és a régi tab-hívók hídja (TAB_TO_PATH) is innen dolgozik.
 */
import type { Icon } from '@phosphor-icons/react'
import {
  ClipboardText, CurrencyEur, Factory, Files, Gear, IdentificationBadge, Package, SquaresFour, Tag, Truck,
} from '@phosphor-icons/react'
import type { UserRole } from '@/lib/auth'

export interface NavItem { path: string; label: string; roles: UserRole[] }
export interface NavGroup {
  key: string; label: string; icon: Icon; roles: UserRole[]
  /** almenü nélküli fő elemnél */
  path?: string
  /** almenüs fő elemnél */
  items?: NavItem[]
}

const ALL: UserRole[] = ['admin', 'operator', 'viewer']
const AO: UserRole[] = ['admin', 'operator']
const AV: UserRole[] = ['admin', 'viewer']
const A: UserRole[] = ['admin']

/** Egyetlen igazságforrás: menü + útvonalak + szerepkörök (spec mátrix). */
export const NAV: NavGroup[] = [
  { key: 'attekintes', label: 'Áttekintés', icon: SquaresFour, roles: AV, path: '/' },
  {
    key: 'gyartas', label: 'Gyártás', icon: Factory, roles: ALL, items: [
      { path: '/gyartas', label: 'Élő gyártás', roles: ALL },
      { path: '/gyartas/tervezes', label: 'Gyártástervezés', roles: ALL },
      { path: '/gyartas/elozmenyek', label: 'Gyártás előzmények', roles: AO },
      { path: '/gyartas/gepek', label: 'Gépek', roles: AO },
      { path: '/gyartas/karbantartas', label: 'Karbantartás', roles: AO },
    ],
  },
  {
    key: 'jelenlet', label: 'Jelenlét', icon: IdentificationBadge, roles: AO, items: [
      { path: '/jelenlet', label: 'Kioszk', roles: AO },
      { path: '/jelenlet/havi-iv', label: 'Havi ív', roles: A },
      { path: '/jelenlet/szabadsagok', label: 'Szabadságok', roles: AO },
    ],
  },
  {
    key: 'rendelesek', label: 'Rendelések', icon: ClipboardText, roles: AV, items: [
      { path: '/rendelesek', label: 'Rendelések', roles: AV },
      { path: '/rendelesek/vevok', label: 'Vevők', roles: A },
      { path: '/rendelesek/termekek', label: 'Termékek', roles: A },
    ],
  },
  {
    key: 'keszlet', label: 'Készlet', icon: Package, roles: ALL, items: [
      { path: '/keszlet', label: 'Készlet', roles: ALL },
      { path: '/keszlet/anyaglista', label: 'Anyaglista', roles: AO },
    ],
  },
  { key: 'szallitas', label: 'Szállítás', icon: Truck, roles: ALL, path: '/szallitas' },
  {
    key: 'dokumentumok', label: 'Dokumentumok', icon: Files, roles: AO, items: [
      { path: '/dokumentumok/szallitolevel', label: 'Szállítólevél / CMR', roles: A },
      { path: '/dokumentumok/etikett', label: 'Etikett', roles: AO },
      { path: '/dokumentumok/urlapok', label: 'Kitöltendő űrlapok', roles: A },
    ],
  },
  {
    key: 'arajanlat', label: 'Árajánlat', icon: CurrencyEur, roles: A, items: [
      { path: '/arajanlat', label: 'Ajánlatok', roles: A },
      { path: '/arajanlat/kalkulator', label: 'Kalkulátor', roles: A },
      { path: '/arajanlat/anyagarak', label: 'Anyagárak', roles: A },
    ],
  },
  { key: 'aktualis-arak', label: 'Aktuális árak', icon: Tag, roles: A, path: '/aktualis-arak' },
  {
    key: 'beallitasok', label: 'Beállítások', icon: Gear, roles: A, items: [
      { path: '/beallitasok/felhasznalok', label: 'Felhasználók', roles: A },
      { path: '/beallitasok/sablonok', label: 'Sablonok', roles: A },
      { path: '/beallitasok/munkanaptar', label: 'Munkanaptár', roles: A },
      { path: '/beallitasok/riportok', label: 'Riportok', roles: A },
      { path: '/beallitasok/mentett', label: 'Mentett fájlok', roles: A },
      { path: '/beallitasok/lomtar', label: 'Lomtár', roles: A },
    ],
  },
]

/** Régi currentTab-érték → új útvonal. A setCurrentTab-hívók hídja. */
export const TAB_TO_PATH: Record<string, string> = {
  dashboard: '/',
  production: '/gyartas',
  planning: '/gyartas/tervezes',
  'production-history': '/gyartas/elozmenyek',
  machines: '/gyartas/gepek',
  maintenance: '/gyartas/karbantartas',
  orders: '/rendelesek',
  customers: '/rendelesek/vevok',
  products: '/rendelesek/termekek',
  inventory: '/keszlet',
  materials: '/keszlet/anyaglista',
  deliveries: '/szallitas',
  documents: '/dokumentumok/szallitolevel',
  saves: '/beallitasok/mentett',
  users: '/beallitasok/felhasznalok',
  'github-editor': '/beallitasok/sablonok?tab=szerkeszto',
  'template-saves': '/beallitasok/sablonok?tab=mentesek',
  'label-templates': '/beallitasok/sablonok?tab=cimkek',
  reports: '/beallitasok/riportok',
  trash: '/beallitasok/lomtar',
}

export function pathForTab(tab: string): string {
  return TAB_TO_PATH[tab] ?? '/'
}

export function tabForPath(pathname: string, search = ''): string | null {
  // Előbb teljes (query-s) egyezés — a három Sablonok-fül csak a ?tab= query-ben tér el.
  const full = pathname + search
  for (const [tab, p] of Object.entries(TAB_TO_PATH)) {
    if (p === full) return tab
  }
  for (const [tab, p] of Object.entries(TAB_TO_PATH)) {
    if (p.split('?')[0] === pathname) return tab
  }
  return null
}

function flatItems(): NavItem[] {
  return NAV.flatMap((g) => g.items ?? [{ path: g.path!, label: g.label, roles: g.roles }])
}

/** null szerep = bypass mód → mindent szabad. Nem-nav útvonalra true (a * route kezeli). */
export function canAccess(role: UserRole | null, pathname: string): boolean {
  if (role === null) return true
  const item = flatItems().find((i) => i.path === pathname)
  if (!item) return true
  return item.roles.includes(role)
}

/** Létezik-e ez az útvonal a NAV-ban (menüből elérhető oldal). */
export function isKnownPath(pathname: string): boolean {
  return flatItems().some((i) => i.path === pathname)
}

export function defaultPathFor(role: UserRole | null): string {
  return role === 'operator' ? '/gyartas' : '/'
}

export function visibleNav(role: UserRole | null): NavGroup[] {
  if (role === null) return NAV
  return NAV
    .filter((g) => g.roles.includes(role))
    .map((g) => (g.items ? { ...g, items: g.items.filter((i) => i.roles.includes(role)) } : g))
}

export function titleForPath(pathname: string): string {
  return flatItems().find((i) => i.path === pathname)?.label ?? ''
}
