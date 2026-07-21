import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Building2, Code2, Copy, PenTool, ShieldCheck, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';

import { fadeUp, staggerFast } from './motion-variants';
import { SectionHeading } from './SectionHeading';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
}

const FEATURES: Feature[] = [
  {
    icon: PenTool,
    title: 'Legally binding e-signatures',
    body: 'Send a document, get it signed. Every signature is timestamped and certified with a full audit trail attached to the final PDF.',
  },
  {
    icon: Copy,
    title: 'Reusable templates',
    body: 'Build a document once (contract, NDA, agreement) then send it to as many recipients as you need without starting over.',
  },
  {
    icon: Workflow,
    title: 'Multi-recipient signing order',
    body: 'Route a document to multiple signers and approvers in order, and track exactly where it is in the process at any moment.',
  },
  {
    icon: Building2,
    title: 'Teams, organizations & SSO',
    body: 'Invite your team with role-based permissions, shared templates, and an organization workspace that keeps everything in one place.',
  },
  {
    icon: Code2,
    title: 'Embed, API & webhooks',
    body: 'Embed signing directly inside your own product, automate document creation through the API, or trigger workflows off webhook events.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit trail & certificates',
    body: 'Every open, view, and signature is logged, with a certificate of completion attached to the final PDF so you always have a record.',
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm dark:border-white/10 dark:bg-card/80"
    >
      <div className="flex size-11 items-center justify-center rounded-xl border bg-secondary/40 text-primary shadow-sm">
        <feature.icon className="size-5" />
      </div>
      <div className="mt-5 font-semibold text-lg tracking-[-0.01em]">{feature.title}</div>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
    </motion.div>
  );
}

export function Features() {
  return (
    <section
      id="features"
      className="relative scroll-mt-20 overflow-hidden border-y bg-gradient-to-b from-background via-muted/40 to-background"
    >
      <div className="relative mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          className="mx-auto max-w-2xl"
        >
          <SectionHeading
            centered
            eyebrow="Features"
            title="Everything you need to get documents signed"
            description="From the first upload to the final signature — Keep Contracts covers the whole workflow without getting in your way."
          />
        </motion.div>
        <motion.div
          className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerFast}
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
