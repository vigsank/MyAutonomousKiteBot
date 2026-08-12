import { createMockServer } from '../src/index';

async function main() {
  const server = await createMockServer({
    startingCapital: 500000,
    ticker: { mode: 'random-walk', randomWalk: { seedSymbols: ['RELIANCE', 'NIFTY50'] } },
    server: { port: 4123, host: '127.0.0.1' },
  });

  const place = await fetch('http://127.0.0.1:4123/orders/regular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tradingsymbol: 'RELIANCE', exchange: 'NSE', transaction_type: 'BUY',
      order_type: 'LIMIT', quantity: 10, price: 2400, product: 'MIS',
    }),
  });
  const placed: any = await place.json();
  console.log('placeOrder:', JSON.stringify(placed));

  server.engine.emitTick({ instrument_token: 738561, last_price: 2400 });

  const orders: any = await (await fetch('http://127.0.0.1:4123/orders')).json();
  console.log('orders[0].status:', orders.data[0].status);

  const quote: any = await (await fetch('http://127.0.0.1:4123/quote?i=NSE:RELIANCE')).json();
  console.log('quote last_price:', quote.data['NSE:RELIANCE'].last_price);

  const profile: any = await (await fetch('http://127.0.0.1:4123/user/profile')).json();
  console.log('profile user:', profile.data.user_id);

  await server.stop();
  console.log('server stopped OK');
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
