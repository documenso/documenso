import { Features } from './Features';
import { FinalCta } from './FinalCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { MarketingFooter } from './MarketingFooter';
import { MarketingHeader } from './MarketingHeader';

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketingHeader />
      <main id="top" className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
