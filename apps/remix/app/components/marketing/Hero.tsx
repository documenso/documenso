import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Highlight } from './Highlight';
import { fadeUp, stagger } from './motion-variants';
import { SigningPreviewCard } from './SigningPreviewCard';
import { scrollToSection } from './scroll-to-section';

function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_60%,transparent_100%)]" />
      <div className="absolute top-[-12%] left-1/2 h-[480px] w-[800px] max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-6 pt-32 pb-20 text-center">
      <HeroBackground />
      <motion.div className="relative z-10 mx-auto max-w-4xl" variants={stagger} initial="hidden" animate="show">
        <motion.h1
          variants={fadeUp}
          className="mx-auto max-w-3xl text-balance font-bold text-[clamp(36px,5.6vw,60px)] leading-[1.05] tracking-[-0.03em]"
        >
          Get contracts <Highlight>signed</Highlight>, not stuck in someone&apos;s inbox
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground leading-relaxed"
        >
          Fast, secure e-signing for teams and individuals.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            to="/signup"
            className="group inline-flex h-12 items-center gap-2 rounded-md bg-primary px-7 font-semibold text-[15px] text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-all hover:-translate-y-px hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Sign up for free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
          {/* biome-ignore lint/a11y/useValidAnchor: real href for pre-hydration/no-JS fallback; onClick upgrades to a JS scroll to avoid a ScrollRestoration/native-hash-nav race (see scroll-to-section.ts) */}
          <a
            href="#how-it-works"
            onClick={(event) => scrollToSection(event, 'how-it-works')}
            className="inline-flex h-12 items-center rounded-md border-2 border-foreground/15 bg-background/70 px-7 font-semibold text-[15px] text-foreground shadow-sm backdrop-blur transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-background"
          >
            See how it works
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        className="relative z-10 mt-16"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      >
        <SigningPreviewCard />
      </motion.div>
    </section>
  );
}
