'use client';

import Image from 'next/image';

import { motion } from 'framer-motion';

import { Card, CardContent } from '@documenso/ui/primitives/card';

import signingCelebration from '~/assets/signing-celebration.png';

export type SigningCardProps = {
  name: string;
};

export const SigningCard = ({ name }: SigningCardProps) => {
  return (
    <div className="relative w-full max-w-xs md:max-w-sm">
      <Card
        className="group mx-auto flex aspect-[21/9] w-full items-center justify-center"
        degrees={-145}
        gradient
      >
        <CardContent
          className="font-signature p-6 text-center"
          style={{
            container: 'main',
          }}
        >
          <span
            className="text-muted-foreground/60 group-hover:text-primary/80 break-all font-semibold duration-300"
            style={{
              fontSize: `max(min(4rem, ${(100 / name.length / 2).toFixed(4)}cqw), 1.875rem)`,
            }}
          >
            {name}
          </span>
        </CardContent>
      </Card>

      <motion.div
        className="absolute -inset-32 -z-10 flex items-center justify-center md:-inset-44 xl:-inset-60 2xl:-inset-80"
        initial={{
          opacity: 0,
          scale: 0.8,
        }}
        animate={{
          scale: 1,
          opacity: 0.5,
        }}
        transition={{
          delay: 0.5,
          duration: 0.5,
        }}
      >
        <Image
          src={signingCelebration}
          alt="background pattern"
          className="w-full"
          style={{
            mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 67%)',
            WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 67%)',
          }}
        />
      </motion.div>
    </div>
  );
};
