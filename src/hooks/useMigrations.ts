import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { runMigrationIfNeeded } from '@/lib/db/migrate'
import { isMigrationDone, markMigrationDone, migrateLocalDataToServer } from '@/lib/db/migrateToServer'
import type { Order, Product } from '@/lib/types'

interface UseMigrationsParams {
  orders: Order[] | undefined
  products: Product[] | undefined
  setOrders: (updater: Order[] | ((prev: Order[] | undefined) => Order[])) => void
  reloadAll: () => void
}

export function useMigrations({ orders, products, setOrders, reloadAll }: UseMigrationsParams) {
  // 1. localStorage → IndexedDB
  useEffect(() => {
    let cancelled = false
    runMigrationIfNeeded()
      .then((result) => {
        if (cancelled) return
        if (result.alreadyDone) return
        const total = Object.values(result.migrated).reduce((a, b) => a + (b ?? 0), 0)
        if (total > 0) {
          toast.success(
            `Adatbázis migráció kész — ${total} rekord IndexedDB-be mozgatva.`,
            { duration: 6000 }
          )
        }
        if (result.errors.length > 0) {
          console.error('[migrate] hibák:', result.errors)
          toast.warning(
            `Migráció figyelmeztetések: ${result.errors.length} kulcs nem költözött át. Részletek a konzolon.`,
            { duration: 8000 }
          )
        }
      })
      .catch((err) => {
        console.error('[migrate] kritikus hiba:', err)
      })
    return () => { cancelled = true }
  }, [])

  // 2. IndexedDB → szerver SQLite (csak egyszer, első indítás után)
  useEffect(() => {
    if (isMigrationDone()) return
    const timer = setTimeout(async () => {
      try {
        const result = await migrateLocalDataToServer()
        markMigrationDone()
        if (result.migrated > 0) {
          toast.success(
            `Helyi adatok szerverre migrálva: ${result.migrated} tétel.`,
            { duration: 8000 }
          )
          reloadAll()
        } else {
          markMigrationDone()
        }
        if (result.errors > 0) {
          console.warn(`[migration] ${result.errors} tétel migrálása sikertelen`)
        }
      } catch (err) {
        console.error('[migration] kritikus hiba:', err)
      }
    }, 2000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3. productId backfill (régi rendelések összekapcsolása termékekkel)
  const productIdBackfillDone = useRef(false)
  useEffect(() => {
    if (productIdBackfillDone.current) return
    if (!Array.isArray(orders) || !Array.isArray(products)) return
    if (orders.length === 0 || products.length === 0) return
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem('orders-productid-backfill-v1') === 'done') {
          productIdBackfillDone.current = true
          return
        }
      } catch {
        /* private browsing */
      }
    }
    const candidates = orders.filter((o) => !o.productId)
    if (candidates.length === 0) {
      productIdBackfillDone.current = true
      try { window.localStorage.setItem('orders-productid-backfill-v1', 'done') } catch { /* ignore */ }
      return
    }

    // order.productName = rajzszám, order.designation = terméknév
    // product.drawingNumber = rajzszám, product.productName = terméknév
    const matchByLegacy = (order: Order): Product | undefined =>
      products.find(
        (p) =>
          p.customer === order.customer &&
          (
            (order.productName && p.drawingNumber === order.productName) ||
            (order.designation && p.productName === order.designation)
          )
      )

    let updatedCount = 0
    const updatedOrders = orders.map((o) => {
      if (o.productId) return o
      const matched = matchByLegacy(o)
      if (!matched) return o
      updatedCount += 1
      return { ...o, productId: matched.id, updatedAt: new Date().toISOString() }
    })

    productIdBackfillDone.current = true
    try { window.localStorage.setItem('orders-productid-backfill-v1', 'done') } catch { /* ignore */ }
    if (updatedCount > 0) {
      setOrders(() => updatedOrders)
      console.log(`[backfill] ${updatedCount} rendelésnél kitöltöttük a productId-t.`)
    }
  }, [orders, products, setOrders])

  // 4. localStorage kvóta figyelmeztetések
  useEffect(() => {
    const onWarning = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { ratio?: number; bytes?: number; entries?: number }
        | undefined
      const pct = Math.round(((detail?.ratio ?? 0) * 100))
      toast.warning(
        `A helyi tárhely ~${pct}%-ban megtelt. Készíts biztonsági mentést és ürítsd a régi adatokat.`,
        { duration: 8000 }
      )
    }
    const onExceeded = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined
      toast.error(
        `Nem sikerült menteni: a böngésző helyi tárhelye megtelt${
          detail?.key ? ` (kulcs: ${detail.key})` : ''
        }. Készíts biztonsági mentést, majd töröld a régi adatokat.`,
        { duration: 12000 }
      )
    }
    window.addEventListener('kv:quota-warning', onWarning as EventListener)
    window.addEventListener('kv:quota-exceeded', onExceeded as EventListener)
    return () => {
      window.removeEventListener('kv:quota-warning', onWarning as EventListener)
      window.removeEventListener('kv:quota-exceeded', onExceeded as EventListener)
    }
  }, [])
}
