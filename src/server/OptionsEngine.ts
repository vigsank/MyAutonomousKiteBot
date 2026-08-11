import { AppConfig } from './AppConfig';
import { OptionType, SignalDirection } from './types';

/**
 * OptionsEngine — safe, switchable options layer.
 *
 * Options are inherently risky (leverage + theta decay). This engine keeps them
 * SAFE by:
 *  - Buying only (defined risk = premium paid; max loss is the premium).
 *  - Enforcing a per-trade premium cap and a total-exposure cap.
 *  - Selecting ATM/OTM strikes with a configurable offset.
 *  - Pricing via Black-Scholes (realistic premium, not a guess).
 *
 * The layer is fully switchable via OPTIONS_ENABLED (default OFF).
 */

/** A selected option contract to trade. */
export interface OptionContract {
  symbol: string;          // underlying symbol
  type: 'CE' | 'PE';
  strike: number;
  premium: number;         // per-share premium
  lotSize: number;
  daysToExpiry: number;
  expiry: Date;
}

/** A paper option position. */
export interface OptionPosition {
  contract: OptionContract;
  quantity: number;        // number of lots
  entryTime: Date;
  entryPremium: number;    // total premium paid (per-share * lot * qty)
}

/** Result of opening/closing an option. */
export interface OptionFill {
  symbol: string;
  type: 'CE' | 'PE';
  strike: number;
  quantity: number;
  premium: number;         // per-share premium at fill
  totalPremium: number;    // premium * lot * qty
  pnl: number;             // 0 on open, realized on close
  reason: string;
  timestamp: Date;
}

// --- Black-Scholes helpers ---------------------------------------------------
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

function bsCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, S - K);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

function bsPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, K - S);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

export class OptionsEngine {
  private readonly SIGMA = 0.3;
  private readonly RATE = 0.06;

  constructor(private readonly config: AppConfig) {}

  /**
   * Estimate annualized volatility from ATR (per-bar) and spot price, so option
   * premiums reflect the underlying's actual volatility instead of a flat 30%.
   */
  static estimateSigmaFromAtr(atr: number, spot: number): number {
    if (atr <= 0 || spot <= 0) return 0.3;
    const sigma = (atr / spot) * 8;
    return Math.max(0.05, Math.min(1.5, sigma));
  }

  get enabled(): boolean {
    return this.config.options.enabled;
  }

  /**
   * Select a strike for a direction. Uses an ATM strike offset by
   * strikeOffsetPct toward OTM (cheaper, needs a bigger move).
   */
  selectStrike(spot: number, direction: SignalDirection): number {
    const offset = this.config.options.strikeOffsetPct / 100;
    // Round to nearest 50 (typical NSE stock option strike interval).
    const step = 50;
    if (direction === 'LONG') {
      // Upside breakout -> buy a CALL slightly OTM (strike above spot).
      return Math.round((spot * (1 + offset)) / step) * step;
    }
    // Downside -> buy a PUT slightly OTM (strike below spot).
    return Math.round((spot * (1 - offset)) / step) * step;
  }

  /** Price an option via Black-Scholes. */
  premium(
    spot: number,
    strike: number,
    type: 'CE' | 'PE',
    daysToExpiry: number,
    sigma = this.SIGMA,
  ): number {
    // Guard against zero/negative volatility (division by zero in Black-Scholes).
    const vol = sigma > 0 ? sigma : this.SIGMA;
    const T = Math.max(0.001, daysToExpiry / 365);
    const p = type === 'CE'
      ? bsCall(spot, strike, T, this.RATE, vol)
      : bsPut(spot, strike, T, this.RATE, vol);
    return Number(p.toFixed(2));
  }

  /** Build a contract for a direction. */
  buildContract(
    symbol: string,
    direction: SignalDirection,
    spot: number,
    now: Date = new Date(),
    sigma = this.SIGMA,
  ): OptionContract | null {
    if (direction === 'NEUTRAL') return null;
    const type: 'CE' | 'PE' = direction === 'LONG' ? 'CE' : 'PE';
    const strike = this.selectStrike(spot, direction);
    const daysToExpiry = this.config.options.expiryDays;
    const expiry = new Date(now.getTime() + daysToExpiry * 24 * 60 * 60 * 1000);
    const premium = this.premium(spot, strike, type, daysToExpiry, sigma);
    return {
      symbol,
      type,
      strike,
      premium,
      lotSize: 50,
      daysToExpiry,
      expiry,
    };
  }

  /** Total premium for a contract at a given lot count. */
  totalPremium(contract: OptionContract, lots: number): number {
    return contract.premium * contract.lotSize * lots;
  }

  /**
   * Risk check: is this option trade within the safety caps?
   * Returns the reason it's blocked, or null if allowed.
   */
  riskCheck(contract: OptionContract, lots: number, currentExposure: number): string | null {
    const total = this.totalPremium(contract, lots);
    if (total <= 0) return 'Option premium is zero/negative.';
    if (total > this.config.options.maxPremiumPerTrade) {
      return `Premium ${total.toFixed(0)} exceeds per-trade cap ${this.config.options.maxPremiumPerTrade}.`;
    }
    if (currentExposure + total > this.config.options.maxOptionsExposure) {
      return `Options exposure ${(currentExposure + total).toFixed(0)} exceeds cap ${this.config.options.maxOptionsExposure}.`;
    }
    return null;
  }
}
