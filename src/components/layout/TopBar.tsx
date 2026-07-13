import { MagnifyingGlass, SignOut } from '@phosphor-icons/react'
import { useLocation } from 'react-router-dom'
import { MessageCenter } from '@/components/MessageCenter'
import { SkinSelect } from '@/components/SkinSelect'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { useAuth } from '@/lib/auth'
import { titleForPath } from '@/lib/navigation'
import type { Order } from '@/lib/types'
import { APP_VERSION } from '@/version'

interface TopBarProps {
  auth: ReturnType<typeof useAuth>
  messagesApi: Parameters<typeof MessageCenter>[0]['messagesApi']
  orders: Order[]
  onOpenSearch: () => void
  // Állapot-csempék értékei és kattintás-céljai
  activeWorkCount: number
  inProductionOrders: number
  readyForDeliveryOrders: number
  lowStockCount: number
  onTileProduction: () => void
  onTileInProduction: () => void
  onTileDeliveries: () => void
  onTileInventory: () => void
}

export function TopBar(props: TopBarProps) {
  const { pathname } = useLocation()
  const title = titleForPath(pathname) || 'ProduktívPro'
  const isOperator = props.auth.user?.role === 'operator'
  const roleLabel =
    props.auth.user?.role === 'admin' ? 'Adminisztrátor'
    : props.auth.user?.role === 'operator' ? 'Operátor' : 'Megfigyelő'

  return (
    <header className="sticky top-0 z-20 border-b bg-card">
      <div className="flex h-14 items-center gap-2 px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hidden sm:flex"
            onClick={props.onOpenSearch}
            title="Gyorskereső (Ctrl+K)"
          >
            <MagnifyingGlass className="w-4 h-4" />
            <span className="hidden md:inline">Keresés</span>
            <kbd className="hidden md:inline pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
          </Button>
          <MessageCenter
            messagesApi={props.messagesApi}
            currentUser={props.auth.user ? { id: props.auth.user.id, name: props.auth.user.name } : null}
            orders={props.orders}
          />
          <SkinSelect />
          <ThemeToggle />
          {props.auth.user && (
            <div className="flex items-center gap-2 border-l pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{props.auth.user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{roleLabel}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => props.auth.logout()} title="Kijelentkezés">
                <SignOut className="w-4 h-4" weight="bold" />
              </Button>
            </div>
          )}
          <span className="hidden lg:inline text-xs font-mono text-muted-foreground">
            {import.meta.env.VITE_APP_VERSION || APP_VERSION}
          </span>
        </div>
      </div>

      {/* Állapot-csík — egy pillantásra a műhely legfontosabb mutatói.
          Minden csempe a megfelelő szűrt nézetre ugrik. md alatt rejtve,
          hogy telefonon ne foglalja a helyet (az Áttekintés oldalon minden
          mutató elérhető). Operátornak elrejtve: olyan nézetekre ugrana,
          amelyekhez nincs jogosultsága. */}
      {!isOperator && (
      <div className="hidden md:grid grid-cols-4 gap-2 px-4 pb-2">
        <button
          type="button"
          onClick={props.onTileProduction}
          className="text-left rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors px-3 py-2"
        >
          <div className="text-[11px] uppercase tracking-wide text-accent/80">Aktív munka</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-accent">{props.activeWorkCount}</div>
        </button>
        <button
          type="button"
          onClick={props.onTileInProduction}
          className="text-left rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors px-3 py-2"
        >
          <div className="text-[11px] uppercase tracking-wide text-warning/80">Gyártás alatt</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-warning">{props.inProductionOrders}</div>
        </button>
        <button
          type="button"
          onClick={props.onTileDeliveries}
          className="text-left rounded-lg bg-success/10 hover:bg-success/20 transition-colors px-3 py-2"
        >
          <div className="text-[11px] uppercase tracking-wide text-success/80">Szállításra kész</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-success">{props.readyForDeliveryOrders}</div>
        </button>
        <button
          type="button"
          onClick={props.onTileInventory}
          className={`text-left rounded-lg transition-colors px-3 py-2 ${props.lowStockCount > 0 ? 'bg-destructive/10 hover:bg-destructive/20 ring-1 ring-destructive/30' : 'bg-muted hover:bg-muted/70'}`}
        >
          <div className={`text-[11px] uppercase tracking-wide ${props.lowStockCount > 0 ? 'text-destructive/80' : 'text-muted-foreground'}`}>Alacsony készlet</div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${props.lowStockCount > 0 ? 'text-destructive' : ''}`}>{props.lowStockCount}</div>
        </button>
      </div>
      )}
    </header>
  )
}
