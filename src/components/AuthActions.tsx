import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';

type Placement = 'header' | 'menu' | 'hero' | 'band';

const layout: Record<Placement, string> = {
  header: 'flex items-center gap-1 sm:gap-2',
  menu: 'flex flex-col gap-2',
  hero: 'flex flex-col gap-3 sm:flex-row',
  band: 'flex flex-col gap-3 sm:flex-row',
};

/**
 * Account actions. Signed out: "Sign in" + "Create an account". Signed in (a session exists):
 * one "Go to dashboard" action. While the session is still loading, the signed-out pair shows.
 * UX only; it reveals nothing the server would not.
 */
export function AuthActions({
  placement,
  className,
}: {
  placement: Placement;
  className?: string;
}) {
  const { t } = useTranslation();
  const { session } = useAuth();

  const onDark = placement === 'hero';
  const size = placement === 'hero' || placement === 'band' ? 'lg' : 'sm';
  const block = placement === 'menu' ? 'w-full' : undefined;
  const primary = onDark ? 'inverse' : 'default';

  if (session) {
    return (
      <div className={cn(layout[placement], className)}>
        <Button asChild variant={primary} size={size} className={block}>
          <Link to="/app">{t('nav.goToDashboard')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(layout[placement], className)}>
      {placement === 'hero' || placement === 'band' ? (
        <>
          <Button asChild variant={primary} size={size}>
            <Link to="/sign-up">{t('nav.createAccount')}</Link>
          </Button>
          <Button asChild variant={onDark ? 'outlineInverse' : 'outline'} size={size}>
            <Link to="/sign-in">{t('nav.signIn')}</Link>
          </Button>
        </>
      ) : (
        <>
          <Button
            asChild
            variant={placement === 'menu' ? 'outline' : 'ghost'}
            size={size}
            className={block}
          >
            <Link to="/sign-in">{t('nav.signIn')}</Link>
          </Button>
          <Button asChild size={size} className={block}>
            <Link to="/sign-up">{t('nav.createAccount')}</Link>
          </Button>
        </>
      )}
    </div>
  );
}
