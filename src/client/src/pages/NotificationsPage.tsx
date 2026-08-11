import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate, timeAgo } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const FILTERS = ['ALL', 'TRADE', 'WARN', 'ERROR', 'SENTIMENT', 'INFO', 'APPROVAL'] as const;

const severityVariant: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'muted'> = {
  TRADE: 'success',
  WARN: 'warning',
  ERROR: 'destructive',
  SENTIMENT: 'info',
  INFO: 'muted',
  APPROVAL: 'info',
};

export function NotificationsPage() {
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');

  const rows = useMemo(
    () =>
      (notifications.data ?? []).filter((n) => filter === 'ALL' || n.severity === filter),
    [notifications.data, filter],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <BellRing className="h-4 w-4" /> Notifications
        </CardTitle>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as (typeof FILTERS)[number])}>
          <TabsList className="flex-wrap h-auto">
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f} className="text-xs">
                {f}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {notifications.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No notifications.</p>
        ) : (
          <ScrollArea className="h-[540px] pr-4">
            <div className="space-y-3">
              {rows.map((n) => (
                <div
                  key={n.notificationId}
                  className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4"
                >
                  <span
                    className={cn(
                      'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                      n.severity === 'ERROR'
                        ? 'bg-red-400'
                        : n.severity === 'WARN'
                        ? 'bg-amber-400'
                        : n.severity === 'TRADE'
                        ? 'bg-primary'
                        : n.severity === 'SENTIMENT'
                        ? 'bg-sky-400'
                        : 'bg-muted-foreground',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <Badge variant={severityVariant[n.severity] ?? 'muted'} className="shrink-0">
                        {n.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      <span>{timeAgo(n.createdAt)}</span>
                      <span>{shortDate(n.createdAt)}</span>
                      <span className="font-mono uppercase">{n.channel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
