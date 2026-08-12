/**
 * Protocol constants — enums, packet sizes, and ticker modes.
 */

// KiteTicker binary packet sizes (bytes).
export const PACKET_LTP_SIZE = 44;
export const PACKET_QUOTE_SIZE = 184;
export const PACKET_FULL_SIZE = 492;

// Binary packet type identifiers (first byte).
export const PACKET_TYPE_LTP = 1;
export const PACKET_TYPE_QUOTE = 17;
export const PACKET_TYPE_FULL = 33;

// Ticker modes.
export const TICKER_MODE_LTP = 'ltp';
export const TICKER_MODE_QUOTE = 'quote';
export const TICKER_MODE_FULL = 'full';

// WebSocket control message actions.
export const WS_ACTION_SUBSCRIBE = 'subscribe';
export const WS_ACTION_UNSUBSCRIBE = 'unsubscribe';
export const WS_ACTION_MODE = 'mode';

// Order statuses.
export const ORDER_STATUS_OPEN = 'OPEN';
export const ORDER_STATUS_COMPLETE = 'COMPLETE';
export const ORDER_STATUS_CANCELLED = 'CANCELLED';
export const ORDER_STATUS_REJECTED = 'REJECTED';
export const ORDER_STATUS_TRIGGER_PENDING = 'TRIGGER PENDING';
export const ORDER_STATUS_VALIDATING = 'VALIDATING';

// Default instrument master path (bundled JSON).
export const INSTRUMENT_MASTER_PATH = '../data/instruments.json';

// Default tick history buffer size per symbol.
export const DEFAULT_TICK_BUFFER_SIZE = 10_000;

// Circuit limit clamp (fraction of base price).
export const DEFAULT_CIRCUIT_LIMIT = 0.05;
