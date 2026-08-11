import { useQuery } from '@tanstack/react-query';
import { Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { currencyPrecise, shortDate, timeAgo } from '@/lib/format';
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

function sentimentTone(score: number | null) {
  if (score == null) return '—';
  return score > 0.2 ? 'bullish' : score < -0.2 ? 'bearish' : 'neutral';
}

export function SignalsPage() {
  const signals = useQuery({ queryKey: ['signals'], queryFn: api.signals });
  const rows = signals.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" /> Signal Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {signals.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No signals generated yet. Run the bot with Kite access to see strategy decisions.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">RSI</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.signalId}>
                  <TableCell className="font-medium">{s.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        s.direction === 'LONG'
                          ? 'success'
                          : s.direction === 'SHORT'
                          ? 'destructive'
                          : 'muted'
                      }
                      className="w-16 justify-center"
                    >
                      {s.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.rsi != null ? s.rsi.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{currencyPrecise(s.price)}</TableCell>
                  <TableCell>
                    {s.sentimentScore != null ? (
                      <span
                        className={cn(
                          'font-medium',
                          sentimentTone(s.sentimentScore) === 'bullish' && 'text-up',
                          sentimentTone(s.sentimentScore) === 'bearish' && 'text-down',
                        )}
                      >
                        {sentimentTone(s.sentimentScore)}
                        <span className="ml-1 text-muted-foreground">({s.sentimentScore.toFixed(2)})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">{s.reason}</TableCell>
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
  );
}
