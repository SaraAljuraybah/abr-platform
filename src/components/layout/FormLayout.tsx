import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatches } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { BRAND_PANELS, type BrandPanelName, isBrandPanelHandle } from './brand-panels';
import { Logo } from './Logo';

/**
 * Shared shell for sign-in, sign-up, password screens and every form under /forms.
 * From lg: two columns, the brand panel at the start (45%) and the form at the end (55%); logical
 * properties mirror it in RTL. Below lg: logo, language switch and the form in one card.
 * A route picks its panel content with handle: { brandPanel: 'interest' } (default 'auth').
 */
export function FormLayout() {
  const { t } = useTranslation();
  const panel =
    useMatches()
      .map((match) => match.handle)
      .findLast(isBrandPanelHandle)?.brandPanel ?? 'auth';

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:bg-card">
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-4 py-2 font-semibold text-brand shadow-md focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
      >
        {t('app.skipToContent')}
      </a>

      <BrandPanel name={panel} />

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:h-20 lg:px-10">
          <Link to="/" className="shrink-0 rounded-sm lg:hidden" aria-label={t('app.homeLink')}>
            <Logo />
          </Link>
          <Link
            to="/"
            className="hidden items-center gap-2 rounded-sm text-sm font-semibold text-brand hover:underline lg:inline-flex"
          >
            {/* Direction arrow: mirrored in RTL (unlike the logo). */}
            <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4 rtl:-scale-x-100" />
            {t('auth.backHome')}
          </Link>
          <LanguageSwitch />
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="flex flex-1 flex-col px-4 pt-4 pb-16 outline-none sm:px-6 sm:pt-10 lg:px-10 lg:py-12"
        >
          {/* Auto margins centre the form vertically without clipping a long one. */}
          <div className="mx-auto w-full max-w-[560px] lg:my-auto lg:max-w-[480px]">
            <div className="rounded-lg border border-border bg-card p-6 shadow-md sm:p-10 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Inset hero-gradient panel, sticky at full height while a long form scrolls. All text sits in the
 * upper start area, away from the light bottom-end corner of the gradient. The statement is a
 * paragraph: the form title stays the page's only h1.
 */
function BrandPanel({ name }: { name: BrandPanelName }) {
  const { t } = useTranslation();
  const { statement, points } = BRAND_PANELS[name];

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-0 h-dvh py-6">
        {/* inset-panel gives the 28px corners and overflow; margins are 24px to the viewport edge
            and none towards the form column. */}
        <div className="relative inset-panel ms-6! me-0! flex h-full flex-col bg-hero-gradient p-10 text-white xl:p-14">
          <Link to="/" className="self-start rounded-sm" aria-label={t('app.homeLink')}>
            <img
              src="/brand/abr-logo-reverse.svg"
              alt="ABR"
              width={428}
              height={158}
              className="w-[140px] max-w-none"
            />
          </Link>

          <p className="mt-16 max-w-[16ch] text-4xl leading-tight font-bold xl:text-5xl">
            {t(statement)}
          </p>

          {points.length > 0 && (
            <ul className="mt-10 flex flex-col gap-4">
              {points.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-center gap-3 text-lg font-semibold">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10"
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          )}

          {/* Watermark: the logo's A, white and faint, off the bottom-end corner. Its position
              mirrors in RTL; the shape is never flipped. */}
          <img
            src="/brand/abr-symbol.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -end-28 -bottom-28 w-[480px] max-w-none opacity-[0.07] brightness-0 invert select-none"
          />
        </div>
      </div>
    </aside>
  );
}
