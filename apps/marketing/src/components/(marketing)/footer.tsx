'use client';

import { HTMLAttributes } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { FaXTwitter } from 'react-icons/fa6';

import LogoImage from '@documenso/assets/logo.png';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
// import { LiaDiscord } from 'react-icons/lia';
// import { LuGithub } from 'react-icons/lu';
import { cn } from '@documenso/ui/lib/utils';

export type FooterProps = HTMLAttributes<HTMLDivElement>;

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/notario', icon: <FaXTwitter className="h-6 w-6" /> },
  // { href: 'https://github.com/documenso/documenso', icon: <LuGithub className="h-6 w-6" /> },
  // { href: 'https://documen.so/discord', icon: <LiaDiscord className="h-7 w-7" /> },
];

const FOOTER_LINKS = [
  { href: '/pricing', text: 'pricing' },
  { href: '/singleplayer', text: 'single-player-mode' },
  { href: 'mailto:info@progiciel.com', text: 'support', target: '_blank' },
  { href: '/privacy', text: 'privacy' },
];

export const Footer = ({ className, ...props }: FooterProps) => {
  const { setTheme } = useTheme();
  const locale = useParams()?.locale as LocaleTypes;
  const { t } = useTranslation(locale, 'marketing');

  return (
    <div className={cn('border-t py-12', className)} {...props}>
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-start justify-between gap-8 px-8">
        <div>
          <Link href="/">
            <Image
              src={LogoImage}
              alt="Notario Logo"
              className="dark:invert"
              width={145}
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

        <div className="grid max-w-xs flex-1 grid-cols-2 gap-x-4 gap-y-2">
          {FOOTER_LINKS.map((link, index) => (
            <Link
              key={index}
              href={link.href}
              target={link.target}
              className="text-muted-foreground hover:text-muted-foreground/80 flex-shrink-0 text-sm"
            >
              {t(link.text)}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-4 flex w-full max-w-screen-xl flex-wrap justify-between gap-4 px-8 md:mt-12 lg:mt-24">
        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} Notario, Inc. All rights reserved.
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <button type="button" className="text-muted-foreground" onClick={() => setTheme('light')}>
            <Sun className="h-5 w-5" />
            <span className="sr-only">Light</span>
          </button>

          <button type="button" className="text-muted-foreground" onClick={() => setTheme('dark')}>
            <Moon className="h-5 w-5" />
            <span className="sr-only">Dark</span>
          </button>
        </div>
      </div>
    </div>
  );
};
