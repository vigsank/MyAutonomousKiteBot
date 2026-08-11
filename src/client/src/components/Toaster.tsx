import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useToastStore } from '@/lib/toast';
import { cn } from '@/lib/utils';

const severityAccent: Record<string, string> = {
  ERROR: 'border-l-red-500',
  WARN: 'border-l-amber-500',
  TRADE: 'border-l-emerald-500',
  SENTIMENT: 'border-l-sky-500',
  APPROVAL: 'border-l-sky-500',
  INFO: 'border-l-muted-foreground',
};

/** Fixed bottom-right stack of live notification toasts. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => remove(t.id)}
            className={cn(
              'pointer-events-auto cursor-pointer rounded-lg border border-l-4 bg-card p-3 shadow-xl',
              severityAccent[t.severity] ?? 'border-l-muted-foreground',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-tight">{t.title}</p>
              <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>
            {t.body && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
