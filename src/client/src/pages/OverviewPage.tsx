import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  Gauge,
  Landmark,
  PieChart,
  ShieldAlert,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { currency, percent, signedCurrency, timeAgo } from '@/lib/format';
import { StatCard } from '@/components/charts/StatCard';
import { EquityChart } from '@/components/charts/EquityChart';
import { PnLBars } from '@/components/charts/PnLBars';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { LiveTicker } from '@/components/charts/LiveTicker';
import { HealthStatus } from '@/components/charts/HealthStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export function OverviewPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const daily = useQuery({ queryKey: ['daily-summary'], queryFn: api.dailySummary });
  const positions = useQuery({ queryKey: ['positions'], queryFn: api.positions });
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const signals = useQuery({ queryKey: ['signals'], queryFn: api.signals });

  const o = overview.data;
  const todayDaily = o?.daily;

  return (
    <div className="space-y-6">
      {/* Live ticker */}
      <LiveTicker items={watchlist.data ?? []} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Available Capital"
          value={o ? currency(o.capital.available) : '—'}
          icon={Landmark}
          tone="accent"
          sub={o ? `of ${currency(o.capital.total)} total` : undefined}
        />
        <StatCard
          label="Today's Realized PnL"
          value={todayDaily ? signedCurrency(todayDaily.realizedPnl) : '—'}
          icon={Target}
          tone={todayDaily && todayDaily.realizedPnl < 0 ? 'down' : 'up'}
          sub={o?.counts.tradesToday ? `${o.counts.tradesToday} trades today` : 'no trades yet'}
        />
        <StatCard
          label="Win Rate"
          value={todayDaily?.winRate != null ? percent(todayDaily.winRate, 1) : '—'}
          icon={PieChart}
          sub={
            todayDaily
              ? `${todayDaily.winningTrades}W / ${todayDaily.losingTrades}L`
              : 'no sessions'
          }
        />
        <StatCard
          label="Max Drawdown"
          value={o?.drawdown ? currency(o.drawdown) : '—'}
          icon={TrendingDown}
          tone="down"
          sub="session low"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Equity Curve</CardTitle>
            <Badge variant="muted">{o?.strategyMode ?? '…'}</Badge>
          </CardHeader>
          <CardContent>
            {daily.isLoading ? <Skeleton className="h-[260px] w-full" /> : <EquityChart data={daily.data ?? []} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Capital Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {positions.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <AllocationDonut positions={positions.data ?? []} available={o?.capital.available ?? 0} />
            )}
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3 w-3" /> {o ? `${o.counts.openPositions} open` : ''}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary charts + side panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Realized PnL by Day</CardTitle>
          </CardHeader>
          <CardContent>
            {daily.isLoading ? <Skeleton className="h-[200px] w-full" /> : <PnLBars data={daily.data ?? []} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health.isLoading ? <Skeleton className="h-24 w-full" /> : <HealthStatus checks={health.data ?? []} />}
          </CardContent>
        </Card>
      </div>

      {/* Activity + signals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-3 overflow-auto">
            {(notifications.data ?? []).slice(0, 8).map((n) => (
              <div key={n.notificationId} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                <SeverityDot severity={n.severity} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
            {notifications.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Latest Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-3 overflow-auto">
            {(signals.data ?? []).slice(0, 8).map((s) => (
              <div key={s.signalId} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                <DirectionBadge direction={s.direction} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.symbol}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{s.reason}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {s.rsi != null && <p>RSI {s.rsi.toFixed(1)}</p>}
                  <p>{timeAgo(s.createdAt)}</p>
                </div>
              </div>
            ))}
            {signals.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No signals generated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3 w-3" />
        {o?.mode ?? ''} mode — all orders are simulated. Data updates live from the bot.
      </p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const cls =
    severity === 'ERROR'
      ? 'bg-red-400'
      : severity === 'WARN'
      ? 'bg-amber-400'
      : severity === 'TRADE'
      ? 'bg-primary'
      : severity === 'SENTIMENT'
      ? 'bg-sky-400'
      : 'bg-muted-foreground';
  return <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function DirectionBadge({ direction }: { direction: string }) {
  const variant =
    direction === 'LONG' ? 'success' : direction === 'SHORT' ? 'destructive' : 'muted';
  return (
    <Badge variant={variant} className="w-16 justify-center">
      {direction}
    </Badge>
  );
}
