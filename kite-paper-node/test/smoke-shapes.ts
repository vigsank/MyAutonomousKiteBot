import { createMockServer } from '../src/index';

async function main() {
  const server = await createMockServer({
    startingCapital: 500000,
    ticker: { mode: 'random-walk', randomWalk: { seedSymbols: ['RELIANCE'] } },
    server: { port: 4125, host: '127.0.0.1' },
  });

  // Place + fill an order.
  await fetch('http://127.0.0.1:4125/orders/regular', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tradingsymbol: 'RELIANCE', exchange: 'NSE', transaction_type: 'BUY', order_type: 'LIMIT', quantity: 10, price: 2400, product: 'MIS' }),
  });
  server.engine.emitTick({ instrument_token: 738561, last_price: 2400 });

  const pos: any = await (await fetch('http://127.0.0.1:4125/portfolio/positions')).json();
  console.log('positions keys:', Object.keys(pos.data), '| net[0].unrealised:', pos.data.net[0]?.unrealised);

  const hist: any = await (await fetch('http://127.0.0.1:4125/instruments/historical/738561/minute')).json();
  console.log('historical raw:', JSON.stringify(hist).slice(0, 200));

  const quote: any = await (await fetch('http://127.0.0.1:4125/quote?i=NSE:RELIANCE')).json();
  const q = quote.data['NSE:RELIANCE'];
  console.log('quote has net_change:', 'net_change' in q, '| buy_quantity:', q.buy_quantity, '| depth.buy array:', Array.isArray(q.depth.buy));

  const trades: any = await (await fetch('http://127.0.0.1:4125/trades')).json();
  console.log('trades count:', trades.data.length, '| trade has average_price:', 'average_price' in (trades.data[0] ?? {}));

  await server.stop();
  console.log('OK');
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
