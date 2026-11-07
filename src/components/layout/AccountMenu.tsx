import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { useSignOut } from '@/features/auth/api';
import { useDirection } from '@/hooks/useDirection';

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground';

/**
 * The signed-in account menu (Radix DropdownMenu): Enter, Space or the arrow keys open it, arrows
 * move, Escape closes it and returns focus to the button. dir follows the language, so it opens
 * at the end side and arrows follow the reading direction. Without a name (provisioned admins), the
 * avatar shows initials from the email address instead of "?". No portal: the menu stays inside the
 * header landmark.
 */
export function AccountMenu({
  name,
  email = null,
}: {
  name: string | null;
  email?: string | null;
}) {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const navigate = useNavigate();
  const signOut = useSignOut();

  return (
    <DropdownMenu.Root dir={direction} modal={false}>
      <DropdownMenu.Trigger
        aria-label={t('shell.accountMenu')}
        className="inline-flex h-10 items-center gap-2 rounded-full ps-1 pe-2 text-sm font-semibold text-foreground hover:bg-accent data-[state=open]:bg-accent"
      >
        <Avatar name={name} email={email} />
        {name && <span className="hidden max-w-40 truncate sm:inline">{name}</span>}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 text-muted-foreground"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        sideOffset={6}
        className="z-50 min-w-48 rounded-md border border-border bg-card p-1 shadow-md"
      >
        <DropdownMenu.Item
          className={itemClass}
          onSelect={() => {
            void navigate('/app/profile');
          }}
        >
          <UserRound aria-hidden="true" strokeWidth={1.75} className="size-4" />
          {t('shell.myProfile')}
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="my-1 h-px bg-border" />
        <DropdownMenu.Item
          className={itemClass}
          onSelect={() => {
            // Leave the guarded page first, or RequireAuth would send the user to /sign-in.
            void Promise.resolve(navigate('/', { replace: true })).then(signOut);
          }}
        >
          <LogOut aria-hidden="true" strokeWidth={1.75} className="size-4 rtl:-scale-x-100" />
          {t('shell.signOut')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
