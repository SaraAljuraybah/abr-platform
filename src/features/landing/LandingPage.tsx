import { BuildNotice } from '@/components/BuildNotice';
import { Faq } from './Faq';
import { FinalCta } from './FinalCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { TrustPrivacy } from './TrustPrivacy';
import { WhoItsFor } from './WhoItsFor';

export function LandingPage() {
  return (
    <>
      <Hero />
      <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
        <BuildNotice />
      </div>
      <HowItWorks />
      <WhoItsFor />
      <TrustPrivacy />
      <Faq />
      <FinalCta />
    </>
  );
}
