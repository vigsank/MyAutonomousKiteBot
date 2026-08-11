import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailySummary } from '@/lib/types';
import { signedCurrency } from '@/lib/format';

interface PnLBarsProps {
  data: DailySummary[];
  height?: number;
}

/** Daily realized PnL as green/red bars. */
export function PnLBars({ data, height = 200 }: PnLBarsProps) {
  const points = useMemo(
    () =>
      [...data]
        .reverse()
        .map((d) => ({ date: d.date, pnl: d.realizedPnl })),
    [data],
  );

  if (points.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No realized PnL yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={54}
        />
        <Tooltip
          formatter={(value) => [signedCurrency(Number(value)), 'PnL']}
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          cursor={{ fill: 'rgba(128,128,128,0.08)' }}
        />
        <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
          {points.map((p, i) => (
            <Cell key={i} fill={p.pnl >= 0 ? 'hsl(var(--up))' : 'hsl(var(--down))'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
