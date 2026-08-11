import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { currencyPrecise, shortDate } from '@/lib/format';
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

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'muted'> = {
  FILLED: 'success',
  PENDING: 'warning',
  REJECTED: 'destructive',
  CANCELLED: 'muted',
};

export function OrdersPage() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: api.orders });
  const rows = orders.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Order Book</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.orderId}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{o.orderId}</TableCell>
                  <TableCell className="font-medium">{o.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={o.side === 'BUY' ? 'success' : 'destructive'} className="w-14 justify-center">
                      {o.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{currencyPrecise(o.price)}</TableCell>
                  <TableCell className="text-muted-foreground">{o.orderType}</TableCell>
                  <TableCell className="text-muted-foreground">{o.product}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[o.status] ?? 'muted'} className="w-20 justify-center">
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn('text-right tabular-nums text-muted-foreground')}>{shortDate(o.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
