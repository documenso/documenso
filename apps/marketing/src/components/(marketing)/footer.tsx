'use client';

import { type HTMLAttributes, useMemo } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { FaXTwitter } from 'react-icons/fa6';
import { LiaDiscord } from 'react-icons/lia';
import { LuGithub } from 'react-icons/lu';

import LogoImage from '@documenso/assets/logo.png';
import { cn } from '@documenso/ui/lib/utils';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

import type { Dictionary } from '~/providers/dictionary-provider';
import { useDictionary } from '~/providers/dictionary-provider';

// import { StatusWidgetContainer } from './status-widget-container';

export type FooterProps = HTMLAttributes<HTMLDivElement>;

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/documenso', icon: <FaXTwitter className="h-6 w-6" /> },
  { href: 'https://github.com/documenso/documenso', icon: <LuGithub className="h-6 w-6" /> },
  { href: 'https://documen.so/discord', icon: <LiaDiscord className="h-7 w-7" /> },
];

const FOOTER_LINKS = (dictionary: Dictionary['footer']) => [
  { href: '/pricing', text: dictionary.pricing },
  { href: '/singleplayer', text: dictionary.singleplayer },
  { href: '/blog', text: dictionary.blog },
  { href: '/design-system', text: dictionary.design },
  { href: '/open', text: dictionary.open_startup },
  { href: 'https://shop.documenso.com', text: dictionary.shop, target: '_blank' },
  { href: 'https://status.documenso.com', text: dictionary.status, target: '_blank' },
  { href: 'mailto:support@documenso.com', text: dictionary.support, target: '_blank' },
  { href: '/oss-friends', text: dictionary.oss_friends },
  { href: '/careers', text: dictionary.careers },
  { href: '/privacy', text: dictionary.privacy },
  { href: '/changelog', text: dictionary.changelog },
];

export const Footer = ({ className, ...props }: FooterProps) => {
  const dictionary = useDictionary();
  const footer_links = useMemo(() => FOOTER_LINKS(dictionary.footer), []);
  return (
    <div className={cn('border-t py-12', className)} {...props}>
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-start justify-between gap-8 px-8">
        <div className="flex-shrink-0">
          <Link href="/">
            <Image
              src={LogoImage}
              alt="Documenso Logo"
              className="dark:invert"
              width={170}
              height={0}
            />
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-4">
            {SOCIAL_LINKS.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                target="_blank"
                className="text-muted-foreground hover:text-muted-foreground/80"
              >
                {link.icon}
              </Link>
            ))}
          </div>

          {/* <div className="mt-6">
            <StatusWidgetContainer />
          </div> */}
        </div>

        <div className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2 md:w-auto md:gap-x-8">
          {footer_links.map((link, index) => (
            <Link
              key={index}
              href={link.href}
              target={link.target}
              className="text-muted-foreground hover:text-muted-foreground/80 flex-shrink-0 break-words text-sm"
            >
              {link.text}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-4 flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-4 px-8 md:mt-12 lg:mt-24">
        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} Documenso, Inc. {dictionary.footer.rights}
        </p>

        <div className="flex flex-wrap">
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  );
};
