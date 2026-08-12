/**
 * kiteconnect compatibility shim.
 *
 * Tries to load the real `kiteconnect` package so that MockKiteConnect and
 * MockKiteTicker can extend the real classes (preserving `instanceof` checks
 * and the prototype chain). When `kiteconnect` is not installed, falls back
 * to minimal base classes so the mock remains usable standalone.
 */

import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-var-requires
let KiteConnectBase: any = null;
// eslint-disable-next-line @typescript-eslint/no-var-requires
let KiteTickerBase: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kiteconnect = require('kiteconnect');
  KiteConnectBase = kiteconnect.KiteConnect;
  KiteTickerBase = kiteconnect.KiteTicker;
} catch {
  KiteConnectBase = null;
  KiteTickerBase = null;
}

/** Base class for MockKiteConnect — real KiteConnect when available. */
export const KiteConnectBaseClass: any =
  KiteConnectBase ??
  class KiteConnectBase {
    api_key: string;
    debug: boolean;
    constructor(params: any) {
      this.api_key = params?.api_key;
      this.debug = params?.debug;
    }
  };

/** Base class for MockKiteTicker — real KiteTicker when available. */
export const KiteTickerBaseClass: any =
  KiteTickerBase ??
  class KiteTickerBase extends EventEmitter {
    api_key: string;
    access_token: string;
    constructor(params: any) {
      super();
      this.api_key = params?.api_key;
      this.access_token = params?.access_token;
    }
  };

/** Whether the real kiteconnect package is available. */
export const hasKiteConnect = KiteConnectBase !== null;
