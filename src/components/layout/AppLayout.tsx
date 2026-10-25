import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { AuthActions } from '@/components/AuthActions';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { cn } from '@/lib/utils';
import { BuildNoticeBar } from './BuildNoticeBar';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { SectionLinks } from './SectionLinks';
import { SiteFooter } from './SiteFooter';

/**
 * "/" gets the full header (section links inline from lg, otherwise in the menu).
 * Every other route gets the compact header: logo, language switch, account actions.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const isLanding = useLocation().pathname === '/';

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-4 py-2 font-semibold text-brand shadow-md focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
      >
        {t('app.skipToContent')}
      </a>

      <BuildNoticeBar />

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="relative mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="shrink-0 rounded-sm" aria-label={t('app.homeLink')}>
            <Logo />
          </Link>
          <nav aria-label={t('nav.primary')} className="flex items-center gap-1 sm:gap-2">
            {isLanding && <SectionLinks className="me-2 hidden items-center gap-1 lg:flex" />}
            <LanguageSwitch />
            <AuthActions placement="header" className="hidden sm:flex" />
            <MobileMenu className={isLanding ? 'lg:hidden' : 'sm:hidden'}>
              {isLanding && (
                <SectionLinks
                  className="mb-4 flex flex-col gap-1 border-b border-border pb-4"
                  linkClassName="w-full text-base"
                />
              )}
              <AuthActions placement="menu" className={cn(isLanding && 'sm:hidden')} />
            </MobileMenu>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <SiteFooter showSections={isLanding} />
    </div>
  );
}
