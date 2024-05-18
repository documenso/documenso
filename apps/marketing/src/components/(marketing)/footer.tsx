'use client';

import type { HTMLAttributes } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { FaFacebookF } from 'react-icons/fa6';
import { FaInstagram } from 'react-icons/fa6';
import { FaYoutube } from 'react-icons/fa6';

import LogoImage from '@documenso/assets/logo.png';
import { cn } from '@documenso/ui/lib/utils';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

// import { StatusWidgetContainer } from './status-widget-container';

export type FooterProps = HTMLAttributes<HTMLDivElement>;

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/documenso', icon: <FaFacebookF className="h-5 w-5" /> },
  { href: 'https://github.com/documenso/documenso', icon: <FaInstagram className="h-6 w-6" /> },
  { href: 'https://documen.so/discord', icon: <FaYoutube className="h-7 w-7" /> },
];

const FOOTER_LINKS = [
  { href: '/pricing', text: 'ფასი' },
  { href: '/blog', text: 'ბლოგი' },
  { href: '/open', text: 'ნებისმიერი' },
  { href: 'mailto:support@documenso.com', text: 'მხარდაჭერა', target: '_blank' },
  { href: '/privacy', text: 'კონფიდენციალურობა' },
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

          {/* <div className="mt-6">
            <StatusWidgetContainer />
          </div> */}
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
          © {new Date().getFullYear()} CHIKOVANI, Inc. ყველა უფლება დაცულია
        </p>

        <div className="flex flex-wrap">
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  );
};
