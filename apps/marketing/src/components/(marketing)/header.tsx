import { HTMLAttributes } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@documenso/ui/lib/utils';

export type HeaderProps = HTMLAttributes<HTMLElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  return (
    <header className={cn('flex items-center justify-between', className)} {...props}>
      <Link href="/">
        <Image src="/logo.png" alt="Documenso Logo" width={170} height={0}></Image>
      </Link>

      <div className="flex items-center gap-x-6">
        <Link href="/pricing" className="text-sm font-semibold text-[#8D8D8D] hover:text-[#6D6D6D]">
          Pricing
        </Link>

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
    </header>
  );
};
