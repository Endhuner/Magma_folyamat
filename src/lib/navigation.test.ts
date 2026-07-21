import { describe, expect, it } from 'vitest'
import {
  NAV, TAB_TO_PATH, canAccess, defaultPathFor, isKnownPath, pathForTab, tabForPath, titleForPath, visibleNav,
} from './navigation'

const navPaths = () =>
  NAV.flatMap((g) => (g.items ? g.items.map((i) => i.path) : [g.path!]))

describe('navigation: tab↔path híd', () => {
  it('minden régi tab-értékhez van útvonal és vissza', () => {
    for (const [tab, path] of Object.entries(TAB_TO_PATH)) {
      expect(pathForTab(tab)).toBe(path)
      const [pathname, query] = path.split('?')
      expect(tabForPath(pathname, query ? `?${query}` : '')).toBe(tab)
    }
  })
  it('query nélkül a sablonok-útvonal az első (szerkesztő) fülre esik', () => {
    expect(tabForPath('/beallitasok/sablonok')).toBe('github-editor')
  })
  it('a szerepkör alapértelmezett oldala mindig elérhető a szerepkörnek', () => {
    for (const r of ['admin', 'operator', 'viewer'] as const) {
      expect(canAccess(r, defaultPathFor(r)), r).toBe(true)
    }
  })
  it('minden TAB_TO_PATH útvonal létezik a NAV-ban', () => {
    const paths = navPaths()
    for (const p of Object.values(TAB_TO_PATH)) {
      expect(paths).toContain(p.split('?')[0])
    }
  })
  it('ismeretlen tab a gyökérre esik, ismeretlen útvonal null', () => {
    expect(pathForTab('nincs-ilyen')).toBe('/')
    expect(tabForPath('/nincs-ilyen')).toBeNull()
  })
})

describe('navigation: jogosultság-mátrix (spec szerint)', () => {
  it('operátor: tiltott oldalak', () => {
    for (const p of ['/', '/rendelesek', '/rendelesek/vevok', '/rendelesek/termekek',
      '/dokumentumok/szallitolevel', '/dokumentumok/urlapok',
      '/arajanlat', '/aktualis-arak',
      '/beallitasok/felhasznalok', '/beallitasok/sablonok', '/beallitasok/munkanaptar',
      '/beallitasok/riportok', '/beallitasok/mentett', '/beallitasok/lomtar']) {
      expect(canAccess('operator', p), p).toBe(false)
    }
  })
  it('operátor: engedélyezett oldalak', () => {
    for (const p of ['/gyartas', '/gyartas/tervezes', '/gyartas/elozmenyek', '/gyartas/gepek',
      '/gyartas/karbantartas', '/keszlet', '/keszlet/anyaglista', '/keszlet/eszkozlista', '/szallitas',
      '/dokumentumok/etikett']) {
      expect(canAccess('operator', p), p).toBe(true)
    }
  })
  it('megfigyelő: engedélyezett és tiltott oldalak', () => {
    for (const p of ['/', '/gyartas', '/gyartas/tervezes', '/rendelesek', '/keszlet', '/szallitas']) {
      expect(canAccess('viewer', p), p).toBe(true)
    }
    for (const p of ['/gyartas/elozmenyek', '/gyartas/gepek', '/gyartas/karbantartas',
      '/keszlet/anyaglista', '/keszlet/eszkozlista', '/rendelesek/vevok', '/rendelesek/termekek',
      '/dokumentumok/szallitolevel', '/arajanlat', '/aktualis-arak',
      '/beallitasok/felhasznalok', '/beallitasok/sablonok', '/beallitasok/munkanaptar',
      '/beallitasok/riportok', '/beallitasok/lomtar']) {
      expect(canAccess('viewer', p), p).toBe(false)
    }
  })
  it('admin mindent lát, bypass (null) mindent lát', () => {
    for (const p of navPaths()) {
      expect(canAccess('admin', p), p).toBe(true)
      expect(canAccess(null, p), p).toBe(true)
    }
  })
  it('alapértelmezett oldalak', () => {
    expect(defaultPathFor('operator')).toBe('/gyartas')
    expect(defaultPathFor('admin')).toBe('/')
    expect(defaultPathFor('viewer')).toBe('/')
    expect(defaultPathFor(null)).toBe('/')
  })
})

describe('navigation: visibleNav', () => {
  it('operátor: nincs Áttekintés/Rendelések/Dokumentumok/Árajánlat/Beállítások', () => {
    const keys = visibleNav('operator').map((g) => g.key)
    expect(keys).toEqual(['gyartas', 'jelenlet', 'keszlet', 'szallitas', 'dokumentumok'])
  })
  it('megfigyelő: Gyártás csak 2 almenüvel, Készlet Anyaglista nélkül', () => {
    const nav = visibleNav('viewer')
    expect(nav.find((g) => g.key === 'gyartas')?.items?.map((i) => i.path))
      .toEqual(['/gyartas', '/gyartas/tervezes'])
    expect(nav.find((g) => g.key === 'keszlet')?.items?.map((i) => i.path)).toEqual(['/keszlet'])
    expect(nav.find((g) => g.key === 'rendelesek')?.items?.map((i) => i.path)).toEqual(['/rendelesek'])
  })
  it('admin: mind a 10 fő elem', () => {
    expect(visibleNav('admin').length).toBe(10)
  })
})

describe('navigation: isKnownPath', () => {
  it('nav-oldalak igen, ismeretlen nem — a tab nélküli új oldalak is ismertek', () => {
    expect(isKnownPath('/arajanlat')).toBe(true)
    expect(isKnownPath('/beallitasok/munkanaptar')).toBe(true)
    expect(isKnownPath('/xyz')).toBe(false)
  })
})

describe('navigation: jelenlét almenük', () => {
  it('kioszk + szabadságok admin és operátor, havi ív + dolgozók csak admin', () => {
    for (const p of ['/jelenlet', '/jelenlet/szabadsagok']) {
      expect(canAccess('admin', p), p).toBe(true)
      expect(canAccess('operator', p), p).toBe(true)
      expect(canAccess('viewer', p), p).toBe(false)
    }
    for (const p of ['/jelenlet/havi-iv']) {
      expect(canAccess('admin', p), p).toBe(true)
      expect(canAccess('operator', p), p).toBe(false)
      expect(canAccess('viewer', p), p).toBe(false)
    }
  })
  it('operátor menüjében a Jelenlét 2 almenüvel szerepel', () => {
    const g = visibleNav('operator').find((x) => x.key === 'jelenlet')
    expect(g?.items?.map((i) => i.path)).toEqual(['/jelenlet', '/jelenlet/szabadsagok'])
  })
})

describe('navigation: árajánlat almenük', () => {
  it('mindhárom útvonal csak adminnak', () => {
    for (const p of ['/arajanlat', '/arajanlat/kalkulator', '/arajanlat/anyagarak']) {
      expect(canAccess('admin', p), p).toBe(true)
      expect(canAccess('operator', p), p).toBe(false)
      expect(canAccess('viewer', p), p).toBe(false)
    }
  })
  it('admin menüjében az Árajánlat 3 almenüvel szerepel', () => {
    const g = visibleNav('admin').find((x) => x.key === 'arajanlat')
    expect(g?.items?.map((i) => i.path)).toEqual(
      ['/arajanlat', '/arajanlat/kalkulator', '/arajanlat/anyagarak'],
    )
  })
})

describe('navigation: titleForPath', () => {
  it('ismert útvonal címe, ismeretlené üres', () => {
    expect(titleForPath('/gyartas')).toBe('Élő gyártás')
    expect(titleForPath('/')).toBe('Áttekintés')
    expect(titleForPath('/xyz')).toBe('')
  })
})
