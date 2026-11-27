import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '../api';

/** Header link to /app/notifications with the unread count (text, not a colour-only dot). */
export function NotificationBell({ userId, className }: { userId?: string; className?: string }) {
  const { t } = useTranslation();
  const unread = useUnreadCount(userId);
  const count = unread.data ?? 0;
  const shown = count > 9 ? '9+' : String(count);
  return (
    <Link
      to="/app/notifications"
      aria-label={
        count > 0
          ? t('connections.notifications.bellUnread', { count })
          : t('connections.notifications.bell')
      }
      className={cn(
        'relative inline-flex size-10 items-center justify-center rounded-md text-brand transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      <Bell aria-hidden="true" strokeWidth={1.75} className="size-5" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -end-0.5 -top-0.5 min-w-5 rounded-full bg-primary px-1 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums"
        >
          {shown}
        </span>
      )}
    </Link>
  );
}
