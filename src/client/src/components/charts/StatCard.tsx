import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  sub?: string;
  /** positive/negative/neutral tints the value + accent. */
  tone?: 'up' | 'down' | 'neutral' | 'accent';
  iconClass?: string;
}

export function StatCard({ label, value, icon: Icon, sub, tone = 'neutral', iconClass }: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden">
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums tracking-tight',
              tone === 'up' && 'text-up',
              tone === 'down' && 'text-down',
              tone === 'accent' && 'text-primary',
            )}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={cn(
            'rounded-lg bg-muted/60 p-2 text-muted-foreground transition-colors group-hover:text-foreground',
            iconClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
