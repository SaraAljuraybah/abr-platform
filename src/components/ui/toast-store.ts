/**
 * A tiny store for success toasts, so a screen can queue one right before it navigates away and
 * the Toaster on the next screen shows it. No React context: callers outside the tree work too.
 */
export interface ToastMessage {
  id: number;
  text: string;
}

let queue: ToastMessage[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

export const toastStore = {
  get: () => queue,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  show: (text: string) => {
    queue = [...queue, { id: nextId++, text }];
    emit();
  },
  dismiss: (id: number) => {
    queue = queue.filter((toast) => toast.id !== id);
    emit();
  },
};
