import { CaretDown, Factory } from '@phosphor-icons/react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar'
import type { UserRole } from '@/lib/auth'
import { type NavGroup, visibleNav } from '@/lib/navigation'

interface AppSidebarProps {
  role: UserRole | null
  lowStockCount: number
  /** Olvasatlan üzenetnél a márkanév pirosan villog (pp-brand-alert). */
  brandAlert: boolean
}

type GroupWithItems = NavGroup & { items: NonNullable<NavGroup['items']> }

/** Almenüs csoport: kibontva Collapsible, összecsukott (icon) módban lebegő DropdownMenu. */
function GroupItem({ group, pathname, lowStockCount, onGo }: {
  group: GroupWithItems
  pathname: string
  lowStockCount: number
  onGo: (path: string) => void
}) {
  const { state, isMobile } = useSidebar()
  const active = group.items.some((i) => i.path === pathname)

  const badge = (path: string) =>
    path === '/keszlet' && lowStockCount > 0 ? (
      <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
        {lowStockCount > 9 ? '9+' : lowStockCount}
      </SidebarMenuBadge>
    ) : null

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={group.label} isActive={active}>
              <group.icon />
              <span>{group.label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            {group.items.map((i) => (
              <DropdownMenuItem key={i.path} onSelect={() => onGo(i.path)}>
                {i.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible asChild defaultOpen={active} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={group.label} isActive={active}>
            <group.icon />
            <span>{group.label}</span>
            <CaretDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((i) => (
              <SidebarMenuSubItem key={i.path}>
                <SidebarMenuSubButton
                  isActive={pathname === i.path}
                  onClick={() => onGo(i.path)}
                  className="cursor-pointer"
                >
                  <span>{i.label}</span>
                </SidebarMenuSubButton>
                {badge(i.path)}
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AppSidebar({ role, lowStockCount, brandAlert }: AppSidebarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()
  const go = (path: string) => {
    navigate(path)
    setOpenMobile(false) // mobilon választás után csukódjon
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Factory className="w-6 h-6 shrink-0 text-primary" weight="duotone" />
          <span
            className={`font-bold truncate group-data-[collapsible=icon]:hidden ${brandAlert ? 'pp-brand-alert' : ''}`}
          >
            ProduktívPro
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {visibleNav(role).map((g) =>
            g.items ? (
              <GroupItem
                key={g.key}
                group={g as GroupWithItems}
                pathname={pathname}
                lowStockCount={lowStockCount}
                onGo={go}
              />
            ) : (
              <SidebarMenuItem key={g.key}>
                <SidebarMenuButton
                  tooltip={g.label}
                  isActive={pathname === g.path}
                  onClick={() => go(g.path!)}
                >
                  <g.icon />
                  <span>{g.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ),
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
