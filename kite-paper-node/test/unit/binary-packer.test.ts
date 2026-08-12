import { MockEngine } from '../../src/mock-engine';
import { BinaryPacker } from '../../src/server/binary-packer';
import { PACKET_LTP_SIZE, PACKET_QUOTE_SIZE, PACKET_FULL_SIZE } from '../../src/protocol/constants';

describe('Binary Packer', () => {
  const packer = new BinaryPacker();

  const tick = {
    mode: 'full' as const,
    instrument_token: 738561,
    last_price: 2450.5,
    last_traded_quantity: 100,
    average_traded_price: 2450.0,
    volume_traded: 10000,
    total_buy_quantity: 5000,
    total_sell_quantity: 5000,
    ohlc: { open: 2440, high: 2460, low: 2435, close: 2450.5 },
    change: 10.5,
    last_trade_time: new Date(),
    exchange_timestamp: new Date(),
    bid: 2450.0,
    ask: 2451.0,
    bid_quantity: 1500,
    ask_quantity: 1200,
    depth: [],
  };

  it('produces LTP packets of the documented size', () => {
    const buf = packer.pack(tick, 'ltp');
    expect(buf.length).toBe(PACKET_LTP_SIZE);
  });

  it('produces Quote packets of the documented size', () => {
    const buf = packer.pack(tick, 'quote');
    expect(buf.length).toBe(PACKET_QUOTE_SIZE);
  });

  it('produces Full packets of the documented size', () => {
    const buf = packer.pack(tick, 'full');
    expect(buf.length).toBe(PACKET_FULL_SIZE);
  });

  it('round-trips token and price through unpack', () => {
    const buf = packer.pack(tick, 'ltp');
    const decoded = packer.unpack(buf);
    expect(decoded.instrument_token).toBe(738561);
    expect(decoded.last_price).toBeCloseTo(2450.5, 1);
    expect(decoded.mode).toBe('ltp');
  });
});
