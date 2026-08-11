import type { Health } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'muted'> = {
  OK: 'success',
  DEGRADED: 'warning',
  DOWN: 'destructive',
};

/** Latest status per component with a pulse dot for live feel. */
export function HealthStatus({ checks }: { checks: Health[] }) {
  // Keep only the newest check per component.
  const byComponent = new Map<string, Health>();
  for (const c of checks) {
    if (!byComponent.has(c.component)) byComponent.set(c.component, c);
  }

  if (byComponent.size === 0) {
    return <p className="text-sm text-muted-foreground">No health checks recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {[...byComponent.values()].map((c) => (
        <div key={c.component} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'relative flex h-2 w-2',
                c.status === 'OK' && 'text-emerald-400',
                c.status === 'DEGRADED' && 'text-amber-400',
                c.status === 'DOWN' && 'text-red-400',
              )}
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            <span className="font-mono text-sm">{c.component}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{timeAgo(c.checkedAt)}</span>
            <Badge variant={statusVariant[c.status] ?? 'muted'} className="w-20 justify-center">
              {c.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
