import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { currencyPrecise, shortDate, signedCurrency } from '@/lib/format';
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

export function TradesPage() {
  const trades = useQuery({ queryKey: ['trades'], queryFn: api.trades });
  const rows = trades.data ?? [];
  const realized = rows.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winners = rows.filter((t) => (t.pnl ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Realized" value={signedCurrency(realized)} tone={realized >= 0 ? 'text-up' : 'text-down'} />
        <SummaryCard label="Trades" value={String(rows.length)} />
        <SummaryCard label="Winners" value={rows.length ? `${winners} (${Math.round((winners / rows.length) * 100)}%)` : '—'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trade Blotter</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No trades yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade ID</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.tradeId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.tradeId}</TableCell>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={t.direction === 'LONG' ? 'success' : 'destructive'} className="w-16 justify-center">
                        {t.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{currencyPrecise(t.price)}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        (t.pnl ?? 0) >= 0 ? 'text-up' : 'text-down',
                      )}
                    >
                      {t.pnl != null ? signedCurrency(t.pnl) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'FILLED' ? 'success' : 'destructive'} className="w-20 justify-center">
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{shortDate(t.createdAt)}</TableCell>
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

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-bold tabular-nums', tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}
