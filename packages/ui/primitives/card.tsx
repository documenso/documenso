'use client';

import * as React from 'react';

import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

import { cn } from '../lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  spotlight?: boolean;
  gradient?: boolean;
  degrees?: number;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, gradient = false, spotlight = false, degrees = 120, ...props }, ref) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = ({ currentTarget, clientX, clientY }: React.MouseEvent) => {
      const { left, top } = currentTarget.getBoundingClientRect();

      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    };

    return (
      <div
        ref={ref}
        style={
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          {
            '--card-gradient-degrees': `${degrees}deg`,
          } as React.CSSProperties
        }
        className={cn(
          'bg-background text-foreground group relative rounded-lg border-2 backdrop-blur-[2px]',
          {
            'gradient-border-mask before:pointer-events-none before:absolute before:-inset-[2px] before:rounded-lg before:p-[2px] before:[background:linear-gradient(var(--card-gradient-degrees),theme(colors.documenso.DEFAULT/50%)_5%,theme(colors.border/80%)_30%)]':
              gradient,
            'dark:gradient-border-mask before:pointer-events-none before:absolute before:-inset-[2px] before:rounded-lg before:p-[2px] before:[background:linear-gradient(var(--card-gradient-degrees),theme(colors.documenso.DEFAULT/70%)_5%,theme(colors.border/80%)_30%)]':
              gradient,
            'shadow-[0_0_0_4px_theme(colors.gray.100/70%),0_0_0_1px_theme(colors.gray.100/70%),0_0_0_0.5px_theme(colors.primary.DEFAULT/70%)]':
              true,
            'dark:shadow-[0]': true,
          },
          className,
        )}
        onMouseMove={handleMouseMove}
        {...props}
      >
        {spotlight && (
          <motion.div
            className="pointer-events-none absolute -inset-[2px] rounded-lg opacity-0 transition duration-300 group-hover:opacity-100"
            style={{
              background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              hsl(var(--primary) / 7%),
              transparent 80%
            )
          `,
            }}
          />
        )}
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);

CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
);

CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-muted-foreground text-sm', className)} {...props} />
));

CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);

CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
