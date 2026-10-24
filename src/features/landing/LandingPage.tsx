import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Faq } from './Faq';
import { FinalCta } from './FinalCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { TrustPrivacy } from './TrustPrivacy';
import { WhoItsFor } from './WhoItsFor';

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <>
      <Hero />
      <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-md bg-info-bg px-3 py-2 text-sm text-info">
          <Info aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
          {t('landing.buildNotice')}
        </p>
      </div>
      <HowItWorks />
      <WhoItsFor />
      <TrustPrivacy />
      <Faq />
      <FinalCta />
    </>
  );
}
