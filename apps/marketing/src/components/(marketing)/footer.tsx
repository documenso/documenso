'use client';

import type { HTMLAttributes } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { FaXTwitter } from 'react-icons/fa6';
import { LiaDiscord } from 'react-icons/lia';
import { LuGithub } from 'react-icons/lu';

import LogoImage from '@documenso/assets/logo.png';
import { cn } from '@documenso/ui/lib/utils';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

export type FooterProps = HTMLAttributes<HTMLDivElement>;

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/documenso', icon: <FaXTwitter className="h-6 w-6" /> },
  { href: 'https://github.com/documenso/documenso', icon: <LuGithub className="h-6 w-6" /> },
  { href: 'https://documen.so/discord', icon: <LiaDiscord className="h-7 w-7" /> },
];

const FOOTER_LINKS = [
  { href: '/pricing', text: 'Pricing' },
  { href: '/singleplayer', text: 'Singleplayer' },
  { href: '/blog', text: 'Blog' },
  { href: '/design-system', text: 'Design' },
  { href: '/open', text: 'Open Startup' },
  { href: 'https://shop.documenso.com', text: 'Shop', target: '_blank' },
  { href: 'https://status.documenso.com', text: 'Status', target: '_blank' },
  { href: 'mailto:support@documenso.com', text: 'Support', target: '_blank' },
  { href: '/oss-friends', text: 'OSS Friends' },
  { href: '/careers', text: 'Careers' },
  { href: '/privacy', text: 'Privacy' },
];

export const Footer = ({ className, ...props }: FooterProps) => {
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
        </div>

        <div className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2 md:w-auto md:gap-x-8">
          {FOOTER_LINKS.map((link, index) => (
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
          © {new Date().getFullYear()} Documenso, Inc. All rights reserved.
        </p>

        <div className="flex flex-wrap">
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  );
};
