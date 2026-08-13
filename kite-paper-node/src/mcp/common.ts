/**
 * Shared MCP tool helpers — mirror Kite MCP's `common.go`:
 * validateRequired, SafeAssert*, MarshalResponse, WithSession.
 */

import type { MockEngine } from '../mock-engine';
import { KiteError } from '../types';

/** MCP tool result with JSON text content. */
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/** Serialize data to a JSON MCP text result. */
export function marshalResult(data: unknown): any {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/** Build an error result from a message. */
export function errorResult(message: string, errorType?: string): any {
  const body: Record<string, unknown> = { error: message };
  if (errorType) body.error_type = errorType;
  return { content: [{ type: 'text', text: JSON.stringify(body) }], isError: true };
}

/** Ensure all required parameter names are present (and non-empty for strings). */
export function validateRequired(args: Record<string, any>, required: string[]): string | null {
  for (const name of required) {
    const v = args?.[name];
    if (v === undefined || v === null) return `Missing required parameter: ${name}`;
    if (typeof v === 'string' && v.trim() === '') return `Missing required parameter: ${name}`;
  }
  return null;
}

/** Coerce a value to a string with a fallback. */
export function safeString(v: any, fallback: string): string {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return fallback;
  return String(v);
}

/** Coerce a value to a number with a fallback. */
export function safeNumber(v: any, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce a value to a boolean with a fallback. */
export function safeBool(v: any, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null) return fallback;
  return v === true || v === 'true' || v === '1';
}

/** Coerce a value to a string array with a fallback. */
export function safeStringArray(v: any, fallback: string[] = []): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return fallback;
}

/** Coerce a value to a number array with a fallback. */
export function safeNumberArray(v: any, fallback: number[] = []): number[] {
  if (Array.isArray(v)) return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  return fallback;
}

/**
 * Wrap a mock tool call. In the mock, the session is always valid (login is a
 * no-op), but the gate mirrors Kite MCP's "call login first" contract.
 */
export async function withMockSession(
  _engine: MockEngine,
  _toolName: string,
  fn: () => any
): Promise<any> {
  return fn();
}

/** Normalize a KiteError or generic Error into an MCP error result. */
export function toErrorResult(err: unknown): any {
  if (err instanceof KiteError) {
    return errorResult(err.message, err.error_type);
  }
  return errorResult(err instanceof Error ? err.message : 'Unexpected error');
}
