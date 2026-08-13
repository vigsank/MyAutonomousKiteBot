import { useQuery } from '@tanstack/react-query';
import { Bot, Newspaper, Radio } from 'lucide-react';
import { api } from '@/lib/api';
import { shortDate, timeAgo } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function dayBiasVariant(bias: string | null) {
  if (bias === 'bullish') return 'success';
  if (bias === 'bearish') return 'destructive';
  return 'muted';
}

function directionVariant(direction: string) {
  if (direction === 'LONG') return 'success';
  if (direction === 'SHORT') return 'destructive';
  return 'muted';
}

export function FleetPage() {
  const probes = useQuery({ queryKey: ['fleet-probes'], queryFn: api.fleetProbes });
  const news = useQuery({ queryKey: ['fleet-news'], queryFn: api.fleetNews });
  const signals = useQuery({ queryKey: ['fleet-signals'], queryFn: api.fleetSignals });

  const probeRows = probes.data?.probes ?? [];
  const newsRows = news.data?.articles ?? [];
  const signalRows = signals.data?.signals ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4" /> Probe Verdicts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {probes.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : probeRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No probe runs recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run Type</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Day Bias</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {probeRows.map((p) => (
                  <TableRow key={p.runId}>
                    <TableCell>
                      <Badge variant="info">{p.runType}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{p.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={dayBiasVariant(p.dayBias)} className="w-20 justify-center">
                        {p.dayBias ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      {p.verdict ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span className="hidden lg:inline">{shortDate(p.runAt)}</span>
                      <span className="lg:hidden">{timeAgo(p.runAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Newspaper className="h-4 w-4" /> News Articles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {news.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : newsRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No news articles recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Fetched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsRows.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{a.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="muted">{a.source}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      {a.link ? (
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-foreground hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        <span className="text-xs text-foreground">{a.title}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span className="hidden lg:inline">{shortDate(a.fetchedAt)}</span>
                      <span className="lg:hidden">{timeAgo(a.fetchedAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" /> Agent Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signals.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : signalRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No agent signals recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signalRows.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.symbol}</TableCell>
                    <TableCell>
                      <Badge
                        variant={directionVariant(s.direction)}
                        className={cn('w-20 justify-center')}
                      >
                        {s.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      {s.reason}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span className="hidden lg:inline">{shortDate(s.createdAt)}</span>
                      <span className="lg:hidden">{timeAgo(s.createdAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
