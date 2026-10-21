import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-4 py-2 font-semibold text-brand shadow-md focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50"
      >
        {t('app.skipToContent')}
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-sm" aria-label={t('app.homeLink')}>
            <Logo />
          </Link>
          <nav aria-label={t('nav.primary')} className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitch />
            <Button asChild variant="ghost" size="sm">
              <Link to="/sign-in">{t('nav.signIn')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/sign-up">{t('nav.signUp')}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1200px] px-4 py-6 text-sm text-muted-foreground sm:px-6">
          {t('app.tagline')}
        </div>
      </footer>
    </div>
  );
}
