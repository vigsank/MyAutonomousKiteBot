import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { currencyPrecise } from '@/lib/format';

export function MarketPage() {
  const watchlist = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  const intervals = useQuery({ queryKey: ['candle-intervals'], queryFn: api.candleIntervals });

  const symbols = (watchlist.data ?? []).map((w) => w.symbol);
  const [symbol, setSymbol] = useState<string>(() => symbols[0] ?? '');
  const [interval, setInterval] = useState<string>('5minute');

  const effectiveSymbol = symbol || symbols[0] || '';
  const effectiveInterval = interval || '5minute';

  const candles = useQuery({
    queryKey: ['candles', effectiveSymbol, effectiveInterval],
    queryFn: () => api.candles(effectiveSymbol, effectiveInterval, 500),
    enabled: effectiveSymbol.length > 0,
  });

  const last = candles.data?.at(-1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-sm">
            {effectiveSymbol || 'Select a symbol'}
            {last && (
              <span className="text-xl font-bold tabular-nums">{currencyPrecise(last.close)}</span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={effectiveSymbol}
              onValueChange={(v) => setSymbol(v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={effectiveInterval} onValueChange={(v) => setInterval(v)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Interval" />
              </SelectTrigger>
              <SelectContent>
                {(intervals.data?.length
                  ? intervals.data
                  : ['1minute', '3minute', '5minute', '15minute', 'day']
                ).map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {effectiveSymbol ? (
            candles.isLoading ? (
              <Skeleton className="h-[420px] w-full" />
            ) : candles.data?.length ? (
              <CandlestickChart data={candles.data} height={420} />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
                No candle data for {effectiveSymbol}. Warm up requires Kite access.
              </div>
            )
          ) : (
            <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
              Add symbols to data/watchlist.json to see charts.
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Candlesticks render on TradingView Lightweight Charts. Intervals available depend on the
        data the bot has persisted.
      </p>
    </div>
  );
}
