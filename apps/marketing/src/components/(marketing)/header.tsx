'use client';

import { HTMLAttributes, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@documenso/ui/lib/utils';

import { HamburgerMenu } from './mobile-hamburger';
import { MobileNavigation } from './mobile-navigation';

export type HeaderProps = HTMLAttributes<HTMLElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={cn('flex items-center justify-between', className)} {...props}>
      <Link href="/">
        <Image src="/logo.png" alt="Documenso Logo" width={170} height={0}></Image>
      </Link>

      <div className="hidden items-center gap-x-6 md:flex">
        <Link href="/blog" className="text-sm font-semibold text-[#8D8D8D] hover:text-[#6D6D6D]">
          Blog
        </Link>

        <Link href="/open" className="text-sm font-semibold text-[#8D8D8D] hover:text-[#6D6D6D]">
          Open
        </Link>

        <Link
          href="https://app.documenso.com/login"
          target="_blank"
          className="text-sm font-semibold text-[#8D8D8D] hover:text-[#6D6D6D]"
        >
          Sign in
        </Link>
      </div>

      <HamburgerMenu menuToggle={handleMenuToggle} isMenuOpen={isMobileMenuOpen} />
      <MobileNavigation isMenuOpen={isMobileMenuOpen} />
    </header>
  );
};
