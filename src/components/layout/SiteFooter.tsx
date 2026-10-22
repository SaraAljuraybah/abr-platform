import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from './Logo';
import { SectionLinks } from './SectionLinks';

export function SiteFooter({ showSections }: { showSections: boolean }) {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link to="/" className="shrink-0 self-start rounded-sm" aria-label={t('app.homeLink')}>
          <Logo />
        </Link>
        {showSections && (
          <nav aria-label={t('nav.footer')}>
            <SectionLinks className="-mx-3 flex flex-wrap gap-x-2 gap-y-1" />
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <LanguageSwitch />
          <p className="text-sm text-muted-foreground">{t('landing.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
