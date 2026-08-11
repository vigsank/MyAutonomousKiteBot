import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api';
import { currency, timeAgo } from '@/lib/format';
import { HealthStatus } from '@/components/charts/HealthStatus';
import { StatCard } from '@/components/charts/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export function RiskPage() {
  const riskEvents = useQuery({ queryKey: ['risk-events'], queryFn: api.riskEvents });
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });

  const events = riskEvents.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Max Drawdown"
          value={overview.data?.drawdown ? currency(overview.data.drawdown) : '—'}
          icon={TrendingDown}
          tone="down"
        />
        <StatCard label="Risk Events" value={String(events.length)} icon={ShieldAlert} tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Risk Gate Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskEvents.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : events.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No risk events recorded yet.
              </p>
            ) : (
              <ScrollArea className="h-80 pr-4">
                <div className="space-y-2">
                  {events.map((e) => (
                    <div
                      key={e.riskEventId}
                      className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                    >
                      <Badge variant="warning" className="mt-0.5 shrink-0">
                        {e.eventType}
                      </Badge>
                      <div className="min-w-0">
                        {e.symbol && <p className="text-sm font-medium">{e.symbol}</p>}
                        <p className="text-xs text-muted-foreground">{e.details}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          {timeAgo(e.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Component Health</CardTitle>
          </CardHeader>
          <CardContent>
            {health.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <HealthStatus checks={health.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
