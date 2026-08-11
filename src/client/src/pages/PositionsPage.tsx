import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { currency, currencyPrecise, signedCurrency, timeAgo } from '@/lib/format';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
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

export function PositionsPage() {
  const positions = useQuery({ queryKey: ['positions'], queryFn: api.positions });
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });

  const rows = positions.data ?? [];
  const totalUpnl = rows.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {positions.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No open positions.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                    <TableHead className="text-right">Last</TableHead>
                    <TableHead className="text-right">Unrealized PnL</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={`${p.symbol}-${p.direction}`}>
                      <TableCell className="font-medium">{p.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={p.direction === 'LONG' ? 'success' : 'destructive'} className="w-14 justify-center">
                          {p.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{currencyPrecise(p.avgPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.lastPrice != null ? currencyPrecise(p.lastPrice) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold tabular-nums',
                          p.unrealizedPnl >= 0 ? 'text-up' : 'text-down',
                        )}
                      >
                        {signedCurrency(p.unrealizedPnl)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{timeAgo(p.entryTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationDonut positions={rows} available={overview.data?.capital.available ?? 0} />
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Unrealized PnL</span>
                <span className={cn('font-semibold tabular-nums', totalUpnl >= 0 ? 'text-up' : 'text-down')}>
                  {signedCurrency(totalUpnl)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Capital deployed</span>
                <span className="tabular-nums">{currency(overview.data?.capital.used ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
