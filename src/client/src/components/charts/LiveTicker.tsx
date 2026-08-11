import type { WatchItem } from '@/lib/types';
import { currencyPrecise } from '@/lib/format';

/** Horizontal auto-scrolling strip of live watchlist prices. */
export function LiveTicker({ items }: { items: WatchItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex h-10 items-center px-4 text-xs text-muted-foreground">
        Watchlist empty — add symbols to data/watchlist.json
      </div>
    );
  }

  const doubled = [...items, ...items];
  return (
    <div className="relative flex h-10 items-center overflow-hidden border-b bg-card">
      <div className="flex min-w-full shrink-0 animate-ticker gap-8 px-4">
        {doubled.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-xs">
            <span className="font-semibold text-foreground">{item.symbol}</span>
            <span className="tabular-nums text-muted-foreground">
              {item.lastPrice != null ? currencyPrecise(item.lastPrice) : '—'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
