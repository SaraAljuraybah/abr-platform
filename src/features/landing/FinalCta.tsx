import { useTranslation } from 'react-i18next';
import { AuthActions } from '@/components/AuthActions';

/**
 * Deep-gradient band, the same treatment as the hero (mirrored in RTL), with the hero's
 * white-reverse buttons. Deliberate exception to "one gradient per view": the hero and this band
 * are never on screen together (see CHANGELOG for the page-height measurement).
 */
export function FinalCta() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="cta-title"
      className="inset-panel mb-4 bg-hero-gradient text-white sm:mb-6 lg:mb-8"
    >
      <div className="container-page flex flex-col gap-8 py-12 lg:flex-row lg:items-center lg:justify-between lg:py-16">
        <div className="max-w-2xl">
          <h2 id="cta-title">{t('landing.cta.title')}</h2>
          <p className="mt-3 text-lg text-white">{t('landing.cta.subline')}</p>
        </div>
        <AuthActions placement="hero" className="shrink-0" />
      </div>
    </section>
  );
}
