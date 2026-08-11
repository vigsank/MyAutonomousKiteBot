import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  LayoutDashboard,
  ListOrdered,
  Menu,
  Radio,
  ShieldAlert,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/market', label: 'Market', icon: TrendingUp },
  { to: '/positions', label: 'Positions', icon: Wallet },
  { to: '/orders', label: 'Orders', icon: ListOrdered },
  { to: '/trades', label: 'Trades', icon: ArrowLeftRight },
  { to: '/signals', label: 'Signals', icon: Activity },
  { to: '/risk', label: 'Risk', icon: ShieldAlert },
  { to: '/notifications', label: 'Activity', icon: Bell },
];

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/market': 'Market & Charts',
  '/positions': 'Positions',
  '/orders': 'Orders',
  '/trades': 'Trades',
  '/signals': 'Signals & Sentiment',
  '/risk': 'Risk & Audit',
  '/notifications': 'Activity Feed',
};

function Brand() {
  return (
    <div className="flex items-center gap-2 px-4 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <Zap className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Kite Vault</p>
        <p className="text-[11px] text-muted-foreground">Autonomous Paper Bot</p>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/40 backdrop-blur md:flex">
        <Brand />
        <Separator />
        <div className="flex flex-1 flex-col py-4">
          <NavItems />
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <Radio className="h-4 w-4 animate-pulse text-primary" />
            <span className="text-xs text-muted-foreground">Paper trading · live</span>
          </div>
        </div>
      </aside>

      {/* Mobile sheet */}
      <div className="fixed left-4 top-4 z-40 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Brand />
            <Separator />
            <div className="flex flex-1 flex-col py-4">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <div className="flex-1 pl-0 md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
          <div className="ml-12 flex items-center gap-3 md:ml-0">
            <h1 className="text-lg font-semibold tracking-tight">{TITLES[pathname] ?? 'Dashboard'}</h1>
            <Badge variant="success" className="hidden sm:inline-flex">
              PAPER
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </div>
        </header>
        <main className="container max-w-none py-6 px-4 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
