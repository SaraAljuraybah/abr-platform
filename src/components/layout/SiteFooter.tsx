import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from './Logo';
import { SectionLinks } from './SectionLinks';

export function SiteFooter({ showSections }: { showSections: boolean }) {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border">
      <div className="container-page flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0">
          <Link to="/" className="inline-block rounded-sm" aria-label={t('app.homeLink')}>
            <Logo />
          </Link>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{t('app.descriptor')}</p>
        </div>
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
