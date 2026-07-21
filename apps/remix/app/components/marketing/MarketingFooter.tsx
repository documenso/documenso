import { BrandingLogo } from '~/components/general/branding-logo';

import { scrollToSection } from './scroll-to-section';

const PRODUCT_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
];

export function MarketingFooter() {
  return (
    <footer id="about" className="scroll-mt-20 border-t bg-muted">
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10">
          <div className="max-w-[280px]">
            <BrandingLogo className="h-6 w-auto" />
            <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
              Send, sign, and manage contracts with ease, all in one place.
            </p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2.5">
            <div className="font-semibold text-[13px] text-foreground">Product</div>
            {PRODUCT_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(event) => scrollToSection(event, link.href.slice(1))}
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-3 border-t pt-5 text-muted-foreground text-xs">
          <span>© {new Date().getFullYear()} DataThink. All rights reserved.</span>
          <span>Keep Contracts — secure document signing</span>
        </div>
      </div>
    </footer>
  );
}
