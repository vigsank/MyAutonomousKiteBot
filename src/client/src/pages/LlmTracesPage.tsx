import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { number, shortDate, timeAgo } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function LlmTracesPage() {
  const traces = useQuery({ queryKey: ['llm-traces'], queryFn: api.llmTraces });
  const [open, setOpen] = useState<number | null>(null);

  const rows = traces.data ?? [];
  const totalTokens =
    rows.reduce((s, t) => s + (t.tokensIn ?? 0) + (t.tokensOut ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Trace Calls" value={number(rows.length)} />
        <SummaryCard
          label="Avg Latency"
          value={
            rows.length
              ? `${(rows.reduce((s, t) => s + t.latencyMs, 0) / rows.length).toFixed(0)} ms`
              : '—'
          }
        />
        <SummaryCard label="Tokens Used" value={number(totalTokens)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" /> LLM Traces
          </CardTitle>
        </CardHeader>
        <CardContent>
          {traces.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No LLM calls recorded yet. Traces are written whenever the bot runs
              sentiment or analyst verdicts.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Purpose</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t, i) => {
                  const isOpen = open === i;
                  const tokens = (t.tokensIn ?? 0) + (t.tokensOut ?? 0);
                  return (
                    <Fragment key={i}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setOpen(isOpen ? null : i)}
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.purpose === 'analyst' ? 'warning' : 'info'}
                          >
                            {t.purpose}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{t.symbol ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {t.model}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            t.latencyMs > 5000 && 'text-down',
                          )}
                        >
                          {t.latencyMs} ms
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {tokens ? number(tokens) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <span className="hidden lg:inline">{shortDate(t.createdAt)}</span>
                          <span className="lg:hidden">{timeAgo(t.createdAt)}</span>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/20">
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="rounded-md border bg-background p-3">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Prompt
                                </p>
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/90">
                                  {t.prompt}
                                </pre>
                              </div>
                              <div className="rounded-md border bg-background p-3">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Response
                                </p>
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/90">
                                  {t.response}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
