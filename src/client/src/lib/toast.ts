import { create } from 'zustand';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  severity: string;
}

interface ToastState {
  toasts: Toast[];
  add: (t: Omit<Toast, 'id'>) => void;
  remove: (id: number) => void;
}

let nextId = 1;
const TOAST_TTL_MS = 6000;

/** Lightweight toast store — new notifications arrive over the WebSocket. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, TOAST_TTL_MS);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
