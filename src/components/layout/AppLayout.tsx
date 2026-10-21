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

      {/* bg-background matches the raster logo's own background (#FAF9FC) exactly. */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0 rounded-sm" aria-label={t('app.homeLink')}>
            <Logo />
          </Link>
          <nav aria-label={t('nav.primary')} className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitch />
            {/* Below sm the home page's own sign-in action covers this; keeps the logo at full size. */}
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
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
    </div>
  );
}
