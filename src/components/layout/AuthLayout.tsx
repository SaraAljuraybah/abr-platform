import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { BuildNotice } from '@/components/BuildNotice';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from './Logo';

/** Compact shell for sign-in, sign-up and password screens: logo, language switch, one card. */
export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-4 py-2 font-semibold text-brand shadow-md focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
      >
        {t('app.skipToContent')}
      </a>

      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="shrink-0 rounded-sm" aria-label={t('app.homeLink')}>
          <Logo />
        </Link>
        <LanguageSwitch />
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 px-4 pt-4 pb-16 outline-none sm:px-6 sm:pt-10"
      >
        <div className="mx-auto w-full max-w-md">
          <BuildNotice className="mb-4" />
          <div className="rounded-lg border border-border bg-card p-6 shadow-md sm:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
