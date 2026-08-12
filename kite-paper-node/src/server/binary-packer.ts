/**
 * Binary Packet Packer — encodes ticks into the real KiteTicker binary
 * protocol, validated against `kiteconnect/dist/lib/ticker.js` `parseBinary`.
 *
 * Real protocol (all big-endian, prices stored as uint32 = price × divisor):
 *   Message framing: [num-packets:2 BE] then per packet [size:2 BE][packet]
 *   LTP        = 8 bytes:  [token:4][ltp×div:4]
 *   Quote      = 44 bytes: [token][ltp][ltq][atp][vol][tbq][tsq][open][high][low][close]
 *   Full       = 184 bytes: 44 + [last_trade_time:4][oi:4][oi_day_high:4][oi_day_low:4][timestamp:4]
 *                           + depth (10 levels × 12 bytes = [qty:4][price×div:4][orders:2][pad:2],
 *                             first 5 = buy, next 5 = sell)
 *   divisor    = 100 (equities), 10000000 (NseCD), 10000 (BseCD)
 *   segment    = instrument_token & 0xFF
 */

import type { Tick } from '../types';

export type BinaryMode = 'ltp' | 'quote' | 'full';

// Segment constants (last byte of instrument token).
const SEGMENT_INDICES = 1;
const SEGMENT_NSE_CD = 13;
const SEGMENT_BSE_CD = 27;

function divisorFor(token: number): number {
  const segment = token & 0xff;
  if (segment === SEGMENT_NSE_CD) return 10_000_000;
  if (segment === SEGMENT_BSE_CD) return 10_000;
  return 100;
}

function isIndex(token: number): boolean {
  return (token & 0xff) === SEGMENT_INDICES;
}

function writeUInt32BE(buf: Buffer, value: number, offset: number): void {
  buf.writeUInt32BE(value >>> 0, offset);
}

function writePrice(buf: Buffer, price: number, divisor: number, offset: number): void {
  writeUInt32BE(buf, Math.round(price * divisor), offset);
}

export class BinaryPacker {
  /**
   * Encode an array of ticks into a single framed binary message.
   * @param ticks Ticks to encode.
   * @param mode The mode to encode each tick in.
   */
  pack(ticks: Tick[], mode: BinaryMode): Buffer {
    const packets: Buffer[] = ticks.map((t) => this.packPacket(t, mode));
    const total = 2 + packets.reduce((sum, p) => sum + 2 + p.length, 0);
    const msg = Buffer.alloc(total);
    msg.writeUInt16BE(packets.length, 0);
    let o = 2;
    for (const p of packets) {
      msg.writeUInt16BE(p.length, o);
      o += 2;
      p.copy(msg, o);
      o += p.length;
    }
    return msg;
  }

  /** Encode a single tick packet (no framing). */
  packPacket(tick: Tick, mode: BinaryMode): Buffer {
    const divisor = divisorFor(tick.instrument_token);
    switch (mode) {
      case 'ltp':
        return this.packLTP(tick, divisor);
      case 'quote':
        return this.packQuote(tick, divisor);
      case 'full':
      default:
        return this.packFull(tick, divisor);
    }
  }

  private packLTP(tick: Tick, divisor: number): Buffer {
    const buf = Buffer.alloc(8);
    writeUInt32BE(buf, tick.instrument_token, 0);
    writePrice(buf, tick.last_price, divisor, 4);
    return buf;
  }

  private packQuote(tick: Tick, divisor: number): Buffer {
    const buf = Buffer.alloc(44);
    writeUInt32BE(buf, tick.instrument_token, 0);
    writePrice(buf, tick.last_price, divisor, 4);
    writeUInt32BE(buf, tick.last_traded_quantity, 8);
    writePrice(buf, tick.average_traded_price, divisor, 12);
    writeUInt32BE(buf, tick.volume_traded, 16);
    writeUInt32BE(buf, tick.total_buy_quantity, 20);
    writeUInt32BE(buf, tick.total_sell_quantity, 24);
    writePrice(buf, tick.ohlc.open, divisor, 28);
    writePrice(buf, tick.ohlc.high, divisor, 32);
    writePrice(buf, tick.ohlc.low, divisor, 36);
    writePrice(buf, tick.ohlc.close, divisor, 40);
    return buf;
  }

  private packFull(tick: Tick, divisor: number): Buffer {
    const buf = Buffer.alloc(184);
    writeUInt32BE(buf, tick.instrument_token, 0);
    writePrice(buf, tick.last_price, divisor, 4);
    writeUInt32BE(buf, tick.last_traded_quantity, 8);
    writePrice(buf, tick.average_traded_price, divisor, 12);
    writeUInt32BE(buf, tick.volume_traded, 16);
    writeUInt32BE(buf, tick.total_buy_quantity, 20);
    writeUInt32BE(buf, tick.total_sell_quantity, 24);
    writePrice(buf, tick.ohlc.open, divisor, 28);
    writePrice(buf, tick.ohlc.high, divisor, 32);
    writePrice(buf, tick.ohlc.low, divisor, 36);
    writePrice(buf, tick.ohlc.close, divisor, 40);

    // last_trade_time (seconds), oi, oi_day_high, oi_day_low, timestamp.
    writeUInt32BE(buf, Math.floor((tick.last_trade_time?.getTime() ?? 0) / 1000), 44);
    writeUInt32BE(buf, tick.oi ?? 0, 48);
    writeUInt32BE(buf, tick.oi_day_high ?? 0, 52);
    writeUInt32BE(buf, tick.oi_day_low ?? 0, 56);
    writeUInt32BE(buf, Math.floor((tick.exchange_timestamp?.getTime() ?? 0) / 1000), 60);

    // Depth: 10 levels × 12 bytes. First 5 = buy, next 5 = sell.
    // Each level: [qty:4][price×div:4][orders:2][pad:2].
    const buy = tick.depth?.buy ?? [];
    const sell = tick.depth?.sell ?? [];
    let o = 64;
    for (let i = 0; i < 5; i++) {
      const level = buy[i] ?? { quantity: 0, price: 0, orders: 0 };
      writeUInt32BE(buf, level.quantity, o);
      writePrice(buf, level.price, divisor, o + 4);
      buf.writeUInt16BE(level.orders, o + 8);
      o += 12;
    }
    for (let i = 0; i < 5; i++) {
      const level = sell[i] ?? { quantity: 0, price: 0, orders: 0 };
      writeUInt32BE(buf, level.quantity, o);
      writePrice(buf, level.price, divisor, o + 4);
      buf.writeUInt16BE(level.orders, o + 8);
      o += 12;
    }
    return buf;
  }

  /**
   * Decode a framed binary message back into ticks (mirrors the real
   * `parseBinary`). Used for tests and round-trip validation.
   */
  unpack(buf: Buffer): Tick[] {
    const numPackets = buf.readUInt16BE(0);
    const ticks: Tick[] = [];
    let j = 2;
    for (let i = 0; i < numPackets; i++) {
      const size = buf.readUInt16BE(j);
      const packet = buf.subarray(j + 2, j + 2 + size);
      ticks.push(this.unpackPacket(packet));
      j += 2 + size;
    }
    return ticks;
  }

  private unpackPacket(bin: Buffer): Tick {
    const instrument_token = bin.readUInt32BE(0);
    const divisor = divisorFor(instrument_token);
    const tradable = !isIndex(instrument_token);

    if (bin.length === 8) {
      return {
        tradable,
        mode: 'ltp',
        instrument_token,
        last_price: bin.readUInt32BE(4) / divisor,
      } as Tick;
    }

    if (bin.length === 44 || bin.length === 184) {
      const mode: BinaryMode = bin.length === 184 ? 'full' : 'quote';
      const tick: any = {
        tradable,
        mode,
        instrument_token,
        last_price: bin.readUInt32BE(4) / divisor,
        last_traded_quantity: bin.readUInt32BE(8),
        average_traded_price: bin.readUInt32BE(12) / divisor,
        volume_traded: bin.readUInt32BE(16),
        total_buy_quantity: bin.readUInt32BE(20),
        total_sell_quantity: bin.readUInt32BE(24),
        ohlc: {
          open: bin.readUInt32BE(28) / divisor,
          high: bin.readUInt32BE(32) / divisor,
          low: bin.readUInt32BE(36) / divisor,
          close: bin.readUInt32BE(40) / divisor,
        },
        change: 0,
      };
      if (tick.ohlc.close !== 0) {
        tick.change = ((tick.last_price - tick.ohlc.close) * 100) / tick.ohlc.close;
      }
      if (bin.length === 184) {
        const ltt = bin.readUInt32BE(44);
        tick.last_trade_time = ltt ? new Date(ltt * 1000) : null;
        tick.oi = bin.readUInt32BE(48);
        tick.oi_day_high = bin.readUInt32BE(52);
        tick.oi_day_low = bin.readUInt32BE(56);
        const ts = bin.readUInt32BE(60);
        tick.exchange_timestamp = ts ? new Date(ts * 1000) : null;
        tick.depth = { buy: [], sell: [] };
        let s = 0;
        const depth = bin.subarray(64, 184);
        for (let i = 0; i < 10; i++) {
          s = i * 12;
          const level = {
            quantity: depth.readUInt32BE(s),
            price: depth.readUInt32BE(s + 4) / divisor,
            orders: depth.readUInt16BE(s + 8),
          };
          (i < 5 ? tick.depth.buy : tick.depth.sell).push(level);
        }
      }
      return tick as Tick;
    }

    throw new Error(`Unsupported packet size: ${bin.length}`);
  }
}
