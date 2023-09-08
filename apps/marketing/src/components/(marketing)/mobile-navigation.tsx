'use client';

import Image from 'next/image';
import Link from 'next/link';

import { motion, useReducedMotion } from 'framer-motion';
import { Github, MessagesSquare, Twitter } from 'lucide-react';

import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';

export type MobileNavigationProps = {
  isMenuOpen: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
};

export const MENU_NAVIGATION_LINKS = [
  {
    href: '/blog',
    text: 'Blog',
  },
  {
    href: '/pricing',
    text: 'Pricing',
  },
  {
    href: '/open',
    text: 'Open',
  },
  {
    href: 'https://status.documenso.com',
    text: 'Status',
  },
  {
    href: 'mailto:support@documenso.com',
    text: 'Support',
  },
  {
    href: '/privacy',
    text: 'Privacy',
  },
  {
    href: 'https://app.documenso.com/login',
    text: 'Sign in',
  },
];

export const MobileNavigation = ({ isMenuOpen, onMenuOpenChange }: MobileNavigationProps) => {
  const shouldReduceMotion = useReducedMotion();

  const handleMenuItemClick = () => {
    onMenuOpenChange?.(false);
  };

  return (
    <Sheet open={isMenuOpen} onOpenChange={onMenuOpenChange}>
      <SheetContent className="w-full max-w-[400px]">
        <Link href="/" className="z-10" onClick={handleMenuItemClick}>
          <Image src="/logo.png" alt="Documenso Logo" width={170} height={25} />
        </Link>

        <motion.div
          className="mt-12 flex w-full flex-col items-start gap-y-4"
          initial="initial"
          animate="animate"
          transition={{
            staggerChildren: 0.03,
          }}
        >
          {MENU_NAVIGATION_LINKS.map(({ href, text }) => (
            <motion.div
              key={href}
              variants={{
                initial: {
                  opacity: 0,
                  x: shouldReduceMotion ? 0 : 100,
                },
                animate: {
                  opacity: 1,
                  x: 0,
                  transition: {
                    duration: 0.5,
                    ease: 'backInOut',
                  },
                },
              }}
            >
              <Link
                className="text-2xl font-semibold text-[#8D8D8D] hover:text-[#6D6D6D]"
                href={href}
                onClick={() => handleMenuItemClick()}
              >
                {text}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="mx-auto mt-8 flex w-full flex-wrap items-center gap-x-4 gap-y-4 ">
          <Link
            href="https://twitter.com/documenso"
            target="_blank"
            className="text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            <Twitter className="h-6 w-6" />
          </Link>

          <Link
            href="https://github.com/documenso/documenso"
            target="_blank"
            className="text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            <Github className="h-6 w-6" />
          </Link>

          <Link
            href="https://documen.so/discord"
            target="_blank"
            className="text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            <MessagesSquare className="h-6 w-6" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
};
