'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Variants, motion, useReducedMotion } from 'framer-motion';
import { Github, Slack, Twitter } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

import backgroundPattern from '~/assets/background-pattern.png';

export type MobileNavigationProps = {
  isMenuOpen: boolean;
  menuToggle: () => void;
};

export interface MenuNavigationLinksProps {
  href: string;
  text: string;
}

export const MenuNavigationLinks = [
  {
    href: '/blog',
    text: 'Blog',
  },
  {
    href: '/pricing',
    text: 'Pricing',
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

export const MobileNavigation = ({ isMenuOpen, menuToggle }: MobileNavigationProps) => {
  const shouldReduceMotion = useReducedMotion();

  const handleMenuItemClick = () => {
    menuToggle();
  };

  const itemVariants: Variants = {
    open: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
    closed: { opacity: 0, y: 0, x: shouldReduceMotion ? 0 : 60, transition: { duration: 0.2 } },
    exit: {
      opacity: 0,
      y: 0,
      x: shouldReduceMotion ? 0 : 60,
      transition: { duration: 0.2 },
    },
  };

  // used for testing alternate animations
  // const vertical = `${!isMenuOpen ? '-translate-y-full' : 'translate-y-0'}`;
  const horizontal = `${!isMenuOpen ? 'translate-x-full' : 'translate-x-0'}`;

  return (
    <motion.div
      animate={isMenuOpen ? 'open' : 'closed'}
      className={cn(
        horizontal,
        'bg-secondary fixed left-0 right-0 top-16 z-10 flex h-[94dvh] w-full transform flex-col items-center justify-start gap-4 shadow-md backdrop-blur-lg transition duration-500 ease-in-out md:hidden',
      )}
      variants={{
        open: {
          transition: {
            type: 'spring',
            bounce: 0,
            duration: shouldReduceMotion ? 0 : 0.7,
            delayChildren: shouldReduceMotion ? 0 : 0.3,
            staggerChildren: shouldReduceMotion ? 0 : 0.05,
          },
        },
        closed: {
          transition: {
            type: 'spring',
            bounce: 0,
            duration: shouldReduceMotion ? 0 : 0.3,
          },
        },
        exit: {
          transition: {
            type: 'spring',
            bounce: 0,
            duration: shouldReduceMotion ? 0 : 0.3,
          },
        },
      }}
    >
      <motion.div className="flex w-full flex-col items-center gap-y-4 px-8 pt-12">
        {MenuNavigationLinks.map((link: MenuNavigationLinksProps) => (
          <Link
            key={link.href}
            passHref
            onClick={() => handleMenuItemClick()}
            href={link.href}
            className="text-4xl font-semibold text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            <motion.p variants={itemVariants}>{link.text}</motion.p>
          </Link>
        ))}
      </motion.div>

      <div className="mx-auto mt-8 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-4 ">
        <Link
          href="https://twitter.com/documenso"
          target="_blank"
          className="text-[#8D8D8D] hover:text-[#6D6D6D]"
        >
          <Twitter className="h-8 w-8" />
        </Link>

        <Link
          href="https://github.com/documenso/documenso"
          target="_blank"
          className="text-[#8D8D8D] hover:text-[#6D6D6D]"
        >
          <Github className="h-8 w-8" />
        </Link>

        <Link
          href="https://documenso.slack.com"
          target="_blank"
          className="text-[#8D8D8D] hover:text-[#6D6D6D]"
        >
          <Slack className="h-8 w-8" />
        </Link>
      </div>
      <div className="absolute inset-0 -z-10 flex items-start justify-center">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="-mr-[15vw] mt-[12vh] h-full max-h-[150vh] scale-125 object-cover md:-mr-[50vw] md:scale-150 lg:scale-[175%]"
        />
      </div>
    </motion.div>
  );
};
