/**
 * Rendelés-státuszok egy helyen.
 *
 * Miért? A státusz-szövegek korábban több fájlban, kézzel beírva szerepeltek
 * (pl. 'Folyamatban'), így egy elgépelés néma hibát okozott. Innentől ezeket
 * a konstansokat használjuk — a TypeScript fordítási hibát ad elgépelésnél.
 */
import type { OrderStatus } from '@/lib/types'

export const ORDER_STATUS = {
  FELVEVE: 'Felvéve',
  SZUNETEL: 'Szünetel',
  KISZALLITVA: 'Kiszállítva',
  KISZALLITVA_SZAMLAZVA: 'Kiszállítva/Számlázva',
  CSOMAGOLAS_ALATT: 'Csomagolás alatt',
  FOLYAMATBAN: 'Folyamatban',
  ELOKESZITVE: 'Előkészítve',
  JAVITAS_ALATT: 'Javítás alatt',
  ELKESZULT: 'Elkészült',
} as const satisfies Record<string, OrderStatus>

/** Az „aktív munka" számláláshoz tartozó státuszok (folyamatban lévő gyártás). */
export const ACTIVE_WORK_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.FOLYAMATBAN,
  ORDER_STATUS.ELOKESZITVE,
  ORDER_STATUS.CSOMAGOLAS_ALATT,
]
