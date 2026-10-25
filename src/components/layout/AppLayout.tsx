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
 * "/" gets the full header. From xl it is a three-part grid (1fr auto 1fr): logo at the start,
 * section links truly centred whatever the side widths, actions at the end. The nav spans the
 * last two columns as a subgrid, so it stays one landmark. Below xl the links move into the menu.
 *
 * From xl the header row is 1280px wide (1200px usable), wider than the 1120px content: the
 * widest end group (Arabic, signed out: 313px) needs 1136px for the links to stay centred.
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
        <div
          className={cn(
            'relative container-page flex h-16 items-center justify-between gap-3',
            isLanding && 'xl:grid xl:max-w-[1280px] xl:grid-cols-[1fr_auto_1fr]',
          )}
        >
          <Link
            to="/"
            className="shrink-0 justify-self-start rounded-sm"
            aria-label={t('app.homeLink')}
          >
            <Logo />
          </Link>
          <nav
            aria-label={t('nav.primary')}
            className={cn(
              'flex items-center gap-1 sm:gap-2',
              isLanding && 'xl:col-span-2 xl:grid xl:grid-cols-subgrid xl:gap-3',
            )}
          >
            {isLanding && <SectionLinks className="hidden items-center gap-1 xl:flex" />}
            <div className="flex items-center gap-1 justify-self-end sm:gap-2">
              <LanguageSwitch />
              <AuthActions placement="header" className="hidden sm:flex" />
              <MobileMenu className={isLanding ? 'xl:hidden' : 'sm:hidden'}>
                {isLanding && (
                  <SectionLinks
                    className="mb-4 flex flex-col gap-1 border-b border-border pb-4"
                    linkClassName="w-full text-base"
                  />
                )}
                <AuthActions placement="menu" className={cn(isLanding && 'sm:hidden')} />
              </MobileMenu>
            </div>
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
