import { CircleCheck, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { toastStore } from './toast-store';

/**
 * Success toasts from toastStore. Radix Toast announces each one politely (role="status"), pauses
 * on hover and focus, and closes with Escape or the close button. Placed at the bottom end
 * (logical), above the content. Swipe follows the reading direction.
 */
export function Toaster() {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get);

  return (
    <Toast.Provider
      duration={6000}
      swipeDirection={direction === 'rtl' ? 'left' : 'right'}
      label={t('toast.region')}
    >
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          type="foreground"
          onOpenChange={(open) => {
            if (!open) toastStore.dismiss(toast.id);
          }}
          className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground shadow-md"
        >
          <CircleCheck
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-0.5 size-4 shrink-0 text-success"
          />
          <Toast.Description className="min-w-0 flex-1 font-semibold">
            {toast.text}
          </Toast.Description>
          <Toast.Close
            aria-label={t('toast.close')}
            className="-m-1 rounded-sm p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed end-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}
