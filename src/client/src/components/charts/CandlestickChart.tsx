import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '@/lib/types';

interface CandlestickChartProps {
  data: Candle[];
  height?: number;
}

const UP = '#10b981';
const DOWN = '#ef4444';

/**
 * Interactive price-action chart built on TradingView Lightweight Charts.
 * Candlesticks with a volume histogram pinned to the bottom of the pane.
 */
export function CandlestickChart({ data, height = 420 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Create the chart once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'hsl(222, 15%, 62%)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(128,128,128,0.08)' },
        horzLines: { color: 'rgba(128,128,128,0.08)' },
      },
      rightPriceScale: { borderColor: 'rgba(128,128,128,0.15)' },
      timeScale: { borderColor: 'rgba(128,128,128,0.15)', timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(16,185,129,0.5)', width: 1, style: 3, labelBackgroundColor: 'hsl(158, 84%, 46%)' },
        horzLine: { color: 'rgba(16,185,129,0.5)', width: 1, style: 3, labelBackgroundColor: 'hsl(158, 84%, 46%)' },
      },
      autoSize: true,
    });

    const candles = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [height]);

  // Push data whenever it changes.
  useEffect(() => {
    const candles = candleRef.current;
    const volume = volumeRef.current;
    if (!candles || !volume) return;

    const candlesData = data.map((c) => ({
      time: (Date.parse(c.timestamp) / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volumeData = data.map((c) => ({
      time: (Date.parse(c.timestamp) / 1000) as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
    }));

    candles.setData(candlesData);
    volume.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
