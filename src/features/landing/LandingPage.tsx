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
      <HowItWorks />
      <WhoItsFor />
      <TrustPrivacy />
      <Faq />
      <FinalCta />
    </>
  );
}
