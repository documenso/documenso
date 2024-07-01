'use client';

import { useMemo } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { motion, useReducedMotion } from 'framer-motion';
import type { getDictionary } from 'get-dictionary';
import { FaXTwitter } from 'react-icons/fa6';
import { LiaDiscord } from 'react-icons/lia';
import { LuGithub } from 'react-icons/lu';

import LogoImage from '@documenso/assets/logo.png';
import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';

export type MobileNavigationProps = {
  isMenuOpen: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
  dictionary: {
    footer: Awaited<ReturnType<typeof getDictionary>>['footer'];
    header: Awaited<ReturnType<typeof getDictionary>>['header'];
  };
};

export const MENU_NAVIGATION_LINKS = (dictionary: MobileNavigationProps['dictionary']) => [
  {
    href: '/singleplayer',
    text: dictionary.footer.singleplayer,
  },
  {
    href: '/blog',
    text: dictionary.footer.blog,
  },
  {
    href: '/pricing',
    text: dictionary.footer.pricing,
  },
  {
    href: '/open',
    text: dictionary.footer.open_startup,
  },
  {
    href: 'https://status.documenso.com',
    text: dictionary.footer.status,
  },
  {
    href: 'mailto:support@documenso.com',
    text: dictionary.footer.status,
    target: '_blank',
  },
  {
    href: '/privacy',
    text: dictionary.footer.privacy,
  },
  {
    href: 'https://app.documenso.com/signin?utm_source=marketing-header',
    text: dictionary.header.signin,
  },
  {
    href: 'https://app.documenso.com/signup?utm_source=marketing-header',
    text: dictionary.header.signup,
  },
];

export const MobileNavigation = ({
  isMenuOpen,
  onMenuOpenChange,
  dictionary,
}: MobileNavigationProps) => {
  const shouldReduceMotion = useReducedMotion();
  const menu_navigation_links = useMemo(() => MENU_NAVIGATION_LINKS(dictionary), []);

  const handleMenuItemClick = () => {
    onMenuOpenChange?.(false);
  };

  return (
    <Sheet open={isMenuOpen} onOpenChange={onMenuOpenChange}>
      <SheetContent className="w-full max-w-[400px]">
        <Link href="/" className="z-10" onClick={handleMenuItemClick}>
          <Image
            src={LogoImage}
            alt="Documenso Logo"
            className="dark:invert"
            width={170}
            height={25}
          />
        </Link>

        <motion.div
          className="mt-12 flex w-full flex-col items-start gap-y-4"
          initial="initial"
          animate="animate"
          transition={{
            staggerChildren: 0.03,
          }}
        >
          {menu_navigation_links.map(({ href, text, target }) => (
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
                className="text-foreground hover:text-foreground/80 text-2xl font-semibold"
                href={href}
                onClick={() => handleMenuItemClick()}
                target={target}
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
            className="text-foreground hover:text-foreground/80"
          >
            <FaXTwitter className="h-6 w-6" />
          </Link>

          <Link
            href="https://github.com/documenso/documenso"
            target="_blank"
            className="text-foreground hover:text-foreground/80"
          >
            <LuGithub className="h-6 w-6" />
          </Link>

          <Link
            href="https://documen.so/discord"
            target="_blank"
            className="text-foreground hover:text-foreground/80"
          >
            <LiaDiscord className="h-7 w-7" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
};
