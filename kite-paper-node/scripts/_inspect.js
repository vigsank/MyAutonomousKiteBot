const fs = require('fs');
for (const c of ['case1', 'case2']) {
  const r = JSON.parse(fs.readFileSync('test/backtest/results/run3/' + c + '.json', 'utf-8'));
  console.log('===', c, '===');
  console.log('roundTrips:', r.roundTrips, 'symbols:', r.symbols.length);
  console.log('topTrades:', JSON.stringify(r.topTrades, null, 1));
  console.log('perSymbol:', r.perSymbol.map((s) => s.symbol + ':' + Math.round(s.pnl)).join(' '));
}
