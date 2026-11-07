import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/features/auth/auth-context';
import { useOwnProfile } from '@/features/auth/profile-api';
import { cn } from '@/lib/utils';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { SiteFooter } from './SiteFooter';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold transition-colors',
    isActive
      ? 'bg-primary/10 text-primary underline decoration-2 underline-offset-8'
      : 'text-brand hover:bg-accent hover:text-accent-foreground',
  );

/**
 * Shell for signed-in pages (/app, /app/*, /admin): logo to /app, the Dashboard link (active state
 * by aria-current="page" and an underline, not colour alone), language switch and account menu.
 * Below sm the Dashboard link moves into the same disclosure menu the landing page uses.
 * Rendered inside the auth guards, so a session always exists here.
 */
export function AppShellLayout() {
  const { t } = useTranslation();
  const { session, role } = useAuth();
  const profile = useOwnProfile(session?.user.id);

  // Admins work in /admin (SCRUM-19; /app sends them there); everyone else in /app.
  const dashboard = (className?: string) =>
    role === 'admin' ? (
      <NavLink to="/admin" className={(state) => cn(navLinkClass(state), className)}>
        {t('shell.admin')}
      </NavLink>
    ) : (
      <NavLink to="/app" end className={(state) => cn(navLinkClass(state), className)}>
        {t('shell.dashboard')}
      </NavLink>
    );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-4 py-2 font-semibold text-brand shadow-md focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
      >
        {t('app.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="relative container-page flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link to="/app" className="shrink-0 rounded-sm" aria-label={t('shell.homeLink')}>
              <Logo />
            </Link>
            <nav aria-label={t('shell.nav')} className="hidden sm:block">
              {dashboard()}
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitch />
            <AccountMenu name={profile.data?.fullName ?? null} />
            <MobileMenu className="sm:hidden">
              <nav aria-label={t('shell.nav')}>{dashboard('w-full text-base')}</nav>
            </MobileMenu>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <SiteFooter showSections={false} />
      <Toaster />
    </div>
  );
}
