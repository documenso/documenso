import { cn } from '@documenso/ui/lib/utils';
import type { ReactNode } from 'react';

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, centered = false, className }: SectionHeadingProps) {
  return (
    <div className={cn(centered ? 'mx-auto max-w-xl text-center' : 'max-w-xl', className)}>
      <div className="font-semibold text-[13px] text-primary uppercase tracking-[0.08em]">{eyebrow}</div>
      <h2 className="mt-2.5 text-balance font-bold text-[clamp(28px,3.5vw,38px)] leading-[1.15] tracking-[-0.02em]">
        {title}
      </h2>
      {description && (
        <p className="mt-3.5 text-pretty text-base text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  );
}
