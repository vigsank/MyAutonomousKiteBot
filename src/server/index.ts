import { loadConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { RiskEngine } from './RiskEngine';
import { PaperTrader } from './PaperTrader';
import { NewsSentimentEngine } from './NewsSentimentEngine';
import { TelegramHITL } from './TelegramHITL';
import { LlmManager } from './LlmManager';
import { OptionsEngine } from './OptionsEngine';
import { OptionsTrader } from './OptionsTrader';
import { MarketAgent } from './MarketAgent';
import { NotificationService } from './NotificationService';
import { createLiveProvider } from './providers/factory';
import { startUiServer } from './api/server';
import { logger } from './Logger';
import { Tick } from './types';

const NEWS_LOOP_MS = 10 * 60 * 1000;

/**
 * Main entrypoint. Wires all components together and starts the two loops.
 *
 * The bot is safe to run even without any credentials: it boots in a degraded
 * mode, logs its status, and only fully engages when Kite + Telegram are
 * configured. It NEVER places real orders - everything is paper-traded.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  logger.info('==================================================');
  logger.info('  My Autonomous Kite Vault - Paper Trading Bot');
  logger.info('==================================================');
  logger.info({ watchlist: config.watchlist.length }, 'Watchlist loaded');
  logger.info({ capital: config.risk.availableCapital }, 'Virtual capital');
  logger.info({ telegram: config.telegram.enabled }, 'Telegram');
  logger.info({ kite: config.kite.apiKey.length > 0 }, 'Kite configured');
  logger.info(
    { provider: config.llm.provider, model: config.llm.activeModel },
    'LLM',
  );
  logger.info('Mode: PAPER (no real orders)');
  logger.info('==================================================');

  // --- Persistence + migrations -------------------------------------------
  const ledger = new Ledger(config.dataDir);
  logger.info({ dir: config.dataDir }, 'Running database migrations...');
  ledger.runMigrations();
  logger.info('Migrations complete.');

  // --- UI server (dashboard REST + WebSocket) -----------------------------
  const ui = await startUiServer(config, ledger);
  logger.info('Dashboard UI available at the configured UI_PORT.');

  // --- Session ------------------------------------------------------------
  const sessionId = ledger.startSession('PAPER');
  logger.info({ sessionId }, 'Session started');

  // --- Notification service (DB-first, Telegram optional) ------------------
  const notify = new NotificationService(ledger.raw(), config);
  logger.info(
    { telegram: config.telegram.enabled },
    'Notification service ready',
  );

  // --- Kite connectivity ---------------------------------------------------
  // LIVE provider: real-time ticks (and warmup history). Default Zerodha Kite.
  const streamer = createLiveProvider(config);

  // --- LLM ----------------------------------------------------------------
  const llm = new LlmManager(config.llm);

  // --- Domain engines ------------------------------------------------------
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm);
  const options = new OptionsEngine(config);
  const optionsTrader = new OptionsTrader(config, options);

  // --- Strategy brain ------------------------------------------------------
  const agent = new MarketAgent(
    config,
    streamer,
    ledger,
    risk,
    trader,
    telegram,
    news,
    notify,
    optionsTrader,
  );

  // --- Warmup RSI from historical data (needs Kite configured) -------------
  if (streamer.isConfigured) {
    try {
      // Load NSE equity (watchlist) + NFO derivatives (options) so instrument
      // lookups for both succeed. loadInstruments merges across exchanges.
      await streamer.loadInstruments('NSE');
      await streamer.loadInstruments('NFO');
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      for (const sym of config.watchlist.filter((s) => s.enabled)) {
        const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');
        if (!inst) {
          logger.warn({ symbol: sym.tradingsymbol }, 'Instrument not found');
          continue;
        }
        // Persist instrument to the normalized table.
        ledger.upsertInstrument(inst);

        const candles = await streamer.getHistoricalData(
          inst.instrument_token,
          '5minute',
          from,
          to,
        );
        const ind = await agent.warmup(sym.tradingsymbol, candles);
        logger.info(
          { symbol: sym.tradingsymbol, rsi: ind.rsi?.toFixed(2) ?? 'n/a', adx: ind.adx?.toFixed(2) ?? 'n/a', atr: ind.atr?.toFixed(2) ?? 'n/a' },
          'Indicator warmup',
        );
      }
      notify.info('RSI warmup complete', 'All symbols warmed up from 30 days of 5-min candles.');
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Warmup skipped');
      notify.warn('RSI warmup skipped', err?.message ?? 'Unknown error');
    }
  } else {
    logger.warn('Kite not configured — skipping warmup and live ticks.');
    notify.warn('Kite not configured', 'Skipping warmup and live ticks. Set KITE_API_KEY and KITE_ACCESS_TOKEN.');
  }

  // --- Live tick loop (3s coalescing) --------------------------------------
  const activeTokens = config.watchlist
    .filter((s) => s.enabled)
    .map((s) => streamer.findInstrument(s.tradingsymbol, 'NSE'))
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .map((i) => i.instrument_token);

  if (streamer.isConfigured && activeTokens.length > 0) {
    streamer.startTicker(activeTokens, (ticks: Tick[]) => {
      agent.onTicks(ticks);
    });
    logger.info({ tokens: activeTokens.length }, 'Live ticker started');
  } else {
    logger.warn('No live ticks — running simulation/watch mode only.');
  }

  // --- Health check heartbeat (every 5 min) --------------------------------
  const healthTimer = setInterval(() => {
    ledger.recordHealthCheck('KITE_STREAMER', streamer.isConfigured ? 'OK' : 'DOWN');
    ledger.recordHealthCheck('LLM', llm.configured ? 'OK' : 'DEGRADED');
    ledger.recordHealthCheck('TELEGRAM', telegram.enabled ? 'OK' : 'DEGRADED');
  }, 5 * 60 * 1000);

  // --- News/AI sentiment loop (10 min) -------------------------------------
  const newsTimer = setInterval(() => {
    agent.runNewsLoop().catch((err) => {
      logger.error({ err: err?.message }, 'News loop error');
    });
  }, NEWS_LOOP_MS);

  // Kick off the first news pass after a short delay.
  setTimeout(() => agent.runNewsLoop().catch(() => undefined), 30_000);

  // --- Tavily detail loop (5 min) ------------------------------------------
  const TAVILY_LOOP_MS = 5 * 60 * 1000;
  const tavilyTimer = setInterval(() => {
    agent.runTavilyDetailLoop().catch((err) => {
      logger.error({ err: err?.message }, 'Tavily loop error');
    });
  }, TAVILY_LOOP_MS);

  // --- Shutdown handling ---------------------------------------------------
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down...');

    clearInterval(healthTimer);
    clearInterval(newsTimer);
    clearInterval(tavilyTimer);

    // Compute and persist the daily summary.
    try {
      ledger.computeDailySummary(config.risk.availableCapital);
      logger.info('Daily summary computed.');
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to compute daily summary');
    }

    streamer.stopTicker();
    telegram.stopPolling();
    await ui.close();
    ledger.endSession(sessionId, 'COMPLETED');
    notify.info('Bot shut down', 'Clean shutdown complete.');
    ledger.close();

    logger.info('Shutdown complete. Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  notify.info('Bot started', `Session ${sessionId} — paper trading mode.`);
  logger.info({ sessionId }, 'Bot running. Press Ctrl+C to stop.');
}

main().catch((err) => {
  logger.fatal({ err: err?.message, stack: err?.stack }, 'Fatal error');
  process.exit(1);
});
