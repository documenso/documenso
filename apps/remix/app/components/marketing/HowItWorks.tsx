import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { FileUp, Send, Signature } from 'lucide-react';

import { fadeUp, staggerFast } from './motion-variants';
import { SectionHeading } from './SectionHeading';

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: FileUp,
    title: 'Upload & prepare',
    description: 'Drop in a PDF and add signature, date, and text fields exactly where you need them.',
  },
  {
    icon: Send,
    title: 'Send to recipients',
    description: 'Add signers, set a signing order if it matters, and send. Each person gets a secure link.',
  },
  {
    icon: Signature,
    title: 'Track & get notified',
    description: 'Watch status updates in real time. The signed, certified document lands in your inbox automatically.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={fadeUp}>
        <SectionHeading
          centered
          eyebrow="How it works"
          title="From upload to signed in three steps"
          description="Keep Contracts keeps the workflow frictionless, so getting a document signed takes minutes, not days."
        />
      </motion.div>

      <motion.div
        className="mt-14 grid gap-6 md:grid-cols-3"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerFast}
      >
        {STEPS.map((step, index) => (
          <motion.div key={step.title} variants={fadeUp} className="relative rounded-2xl border p-6 shadow-sm">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <step.icon className="size-5" />
            </div>
            <div className="mt-5 font-semibold text-muted-foreground text-xs uppercase tracking-[0.08em]">
              Step {index + 1}
            </div>
            <div className="mt-1.5 font-semibold text-lg tracking-[-0.01em]">{step.title}</div>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{step.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
