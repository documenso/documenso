'use client';

import { type HTMLAttributes, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { FaXTwitter } from 'react-icons/fa6';
import { LiaDiscord } from 'react-icons/lia';
import { LuGithub, LuLanguages } from 'react-icons/lu';

import LogoImage from '@documenso/assets/logo.png';
import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
// import { StatusWidgetContainer } from './status-widget-container';
import { LanguageSwitcherDialog } from '@documenso/ui/components/common/language-switcher-dialog';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

export type FooterProps = HTMLAttributes<HTMLDivElement>;

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/documenso', icon: <FaXTwitter className="h-6 w-6" /> },
  { href: 'https://github.com/documenso/documenso', icon: <LuGithub className="h-6 w-6" /> },
  { href: 'https://documen.so/discord', icon: <LiaDiscord className="h-7 w-7" /> },
];

const FOOTER_LINKS = [
  { href: '/pricing', text: msg`Pricing` },
  { href: '/singleplayer', text: 'Singleplayer' },
  { href: 'https://docs.documenso.com', text: msg`Documentation`, target: '_blank' },
  { href: 'mailto:support@documenso.com', text: msg`Support`, target: '_blank' },
  { href: '/blog', text: msg`Blog` },
  { href: '/changelog', text: msg`Changelog` },
  { href: '/open', text: msg`Open Startup` },
  { href: '/design-system', text: msg`Design` },
  { href: 'https://shop.documenso.com', text: msg`Shop`, target: '_blank' },
  { href: 'https://status.documenso.com', text: msg`Status`, target: '_blank' },
  { href: '/oss-friends', text: msg`OSS Friends` },
  { href: '/careers', text: msg`Careers` },
  { href: '/privacy', text: msg`Privacy` },
];

export const Footer = ({ className, ...props }: FooterProps) => {
  const { _, i18n } = useLingui();

  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);

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
              {typeof link.text === 'string' ? link.text : _(link.text)}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-4 flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-4 px-8 md:mt-12 lg:mt-24">
        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} Documenso, Inc. All rights reserved.
        </p>

        <div className="flex flex-row-reverse items-center sm:flex-row">
          <Button
            className="text-muted-foreground ml-2 rounded-full font-normal sm:mr-2"
            variant="ghost"
            onClick={() => setLanguageSwitcherOpen(true)}
          >
            <LuLanguages className="mr-1.5 h-4 w-4" />
            {SUPPORTED_LANGUAGES[i18n.locale]?.full || i18n.locale}
          </Button>

          <div className="flex flex-wrap">
            <ThemeSwitcher />
          </div>
        </div>
      </div>

      <LanguageSwitcherDialog open={languageSwitcherOpen} setOpen={setLanguageSwitcherOpen} />
    </div>
  );
};
