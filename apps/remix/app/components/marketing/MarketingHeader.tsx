import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@documenso/ui/primitives/sheet';
import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { BrandingLogo } from '~/components/general/branding-logo';

import { scrollToSection } from './scroll-to-section';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
];

export function MarketingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setIsScrolled(window.scrollY > 8);

    updateScrolled();
    window.addEventListener('scroll', updateScrolled, { passive: true });

    return () => window.removeEventListener('scroll', updateScrolled);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
        isScrolled
          ? 'border-border/80 border-b bg-background/90 shadow-sm backdrop-blur-md'
          : 'border-transparent border-b bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        {/* biome-ignore lint/a11y/useValidAnchor: real href for pre-hydration/no-JS fallback; onClick upgrades to a JS scroll to avoid a ScrollRestoration/native-hash-nav race (see scroll-to-section.ts) */}
        <a href="#top" onClick={(event) => scrollToSection(event, 'top')} aria-label="Keep Contracts home">
          <BrandingLogo className="h-7 w-auto" />
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => scrollToSection(event, link.href.slice(1))}
              className="inline-flex h-10 items-center rounded-md px-3.5 font-medium text-foreground/90 text-sm transition-all hover:bg-primary/10 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button asChild variant="outline" className="h-9">
            <Link to="/signin">Log in</Link>
          </Button>
          <Button asChild className="h-9">
            <Link to="/signup">Sign up for free</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="default" className="h-9 w-9 px-0" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent position="right" className="flex w-80 max-w-[85vw] flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center">
                  <BrandingLogo className="h-6 w-auto" />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile main" className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(event) => {
                      setIsMenuOpen(false);
                      scrollToSection(event, link.href.slice(1));
                    }}
                    className="flex h-11 items-center rounded-md px-3 font-medium text-foreground/90 text-sm transition-colors hover:bg-primary/10 hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                <Button asChild variant="outline" className="h-11" onClick={() => setIsMenuOpen(false)}>
                  <Link to="/signin">Log in</Link>
                </Button>
                <Button asChild className="h-11" onClick={() => setIsMenuOpen(false)}>
                  <Link to="/signup">Sign up for free</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
