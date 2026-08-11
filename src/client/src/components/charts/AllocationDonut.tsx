import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Position } from '@/lib/types';
import { currency } from '@/lib/format';

interface AllocationDonutProps {
  positions: Position[];
  available: number;
  height?: number;
}

const PALETTE = ['hsl(var(--primary))', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

/** Capital allocation: available vs. notional locked in each open position. */
export function AllocationDonut({ positions, available, height = 240 }: AllocationDonutProps) {
  const data = [
    { name: 'Available', value: Math.max(0, available), color: 'hsl(var(--muted-foreground))' },
    ...positions.map((p, i) => ({
      name: p.symbol,
      value: Math.abs(p.quantity * p.avgPrice),
      color: PALETTE[(i + 1) % PALETTE.length],
    })),
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? 'hsl(var(--primary))'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${currency(Number(value))}`, name]}
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
