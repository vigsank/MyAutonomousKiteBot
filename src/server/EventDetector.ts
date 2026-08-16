/**
 * EventDetector — detects major breaking events from news headlines (C4).
 *
 * Flags high-impact events (RBI/Fed decisions, budget, regulatory, earnings
 * surprises, etc.) that should trigger an unscheduled LLM re-evaluation or a
 * risk-off posture. Pure, deterministic keyword matching.
 */
import { NewsArticle } from './types';

export interface DetectedEvent {
  category: string;
  headline: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** Category → keywords that indicate a major event. */
const EVENT_KEYWORDS: Array<{ category: string; severity: DetectedEvent['severity']; words: string[] }> = [
  { category: 'RBI', severity: 'HIGH', words: ['rbi', 'repo rate', 'monetary policy', 'reserve bank'] },
  { category: 'FED', severity: 'HIGH', words: ['fed', 'federal reserve', 'rate hike', 'rate cut', 'fomc'] },
  { category: 'BUDGET', severity: 'HIGH', words: ['budget', 'union budget', 'fiscal'] },
  { category: 'REGULATORY', severity: 'HIGH', words: ['sebi', 'regulator', 'ban', 'probe', 'investigation', 'crackdown'] },
  { category: 'EARNINGS', severity: 'MEDIUM', words: ['earnings', 'results', 'q1', 'q2', 'q3', 'q4', 'guidance', 'profit warning'] },
  { category: 'MACRO', severity: 'MEDIUM', words: ['cpi', 'inflation', 'gdp', 'trade deficit', 'current account'] },
  { category: 'GEOPOLITICAL', severity: 'HIGH', words: ['war', 'sanction', 'conflict', 'attack', 'crisis'] },
  { category: 'CORPORATE', severity: 'MEDIUM', words: ['fraud', 'default', 'bankruptcy', 'restructuring', 'delisting'] },
];

/** Detect major events from a set of headlines. */
export function detectEvents(articles: NewsArticle[]): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const seen = new Set<string>();
  for (const a of articles) {
    const text = `${a.title} ${a.summary ?? ''}`.toLowerCase();
    for (const rule of EVENT_KEYWORDS) {
      if (rule.words.some((w) => text.includes(w))) {
        const key = `${rule.category}:${a.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({ category: rule.category, headline: a.title, severity: rule.severity });
      }
    }
  }
  return events;
}

/** True when any HIGH-severity event is present (triggers risk-off / re-eval). */
export function hasHighSeverityEvent(events: DetectedEvent[]): boolean {
  return events.some((e) => e.severity === 'HIGH');
}
