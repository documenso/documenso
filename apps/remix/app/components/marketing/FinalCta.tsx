import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { scrollToSection } from './scroll-to-section';

export function FinalCta() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative isolate overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_40%,transparent_100%)]"
          />
          <h2 className="mx-auto max-w-xl text-balance font-bold text-[clamp(28px,3.6vw,42px)] leading-[1.1] tracking-[-0.025em]">
            Your next contract could be signed by lunch
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed opacity-85">
            No back-and-forth, no printing or scanning. Send your first document and see how fast getting it signed can
            be.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-background px-7 font-medium text-[15px] text-primary transition-all hover:-translate-y-px hover:shadow-lg"
            >
              Sign up for free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {/* biome-ignore lint/a11y/useValidAnchor: real href for pre-hydration/no-JS fallback; onClick upgrades to a JS scroll to avoid a ScrollRestoration/native-hash-nav race (see scroll-to-section.ts) */}
            <a
              href="#features"
              onClick={(event) => scrollToSection(event, 'features')}
              className="inline-flex h-12 items-center rounded-md border border-primary-foreground/40 px-7 font-medium text-[15px] transition-all hover:bg-primary-foreground/10"
            >
              Explore features
            </a>
          </div>
          <p className="mt-6 text-[13px] opacity-75">Free to start · No credit card required</p>
        </motion.div>
      </div>
    </section>
  );
}
