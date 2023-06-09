import { HTMLAttributes } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Github, Slack, Twitter } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export type FooterProps = HTMLAttributes<HTMLDivElement>;

export const Footer = ({ className, ...props }: FooterProps) => {
  return (
    <div className={cn('border-t py-12', className)} {...props}>
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-start justify-between gap-8 px-8">
        <div>
          <Link href="/">
            <Image src="/logo.png" alt="Documenso Logo" width={170} height={0}></Image>
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-4 text-[#8D8D8D]">
            <Link
              href="https://twitter.com/documenso"
              target="_blank"
              className="hover:text-[#6D6D6D]"
            >
              <Twitter className="h-6 w-6" />
            </Link>

            <Link
              href="https://github.com/documenso/documenso"
              target="_blank"
              className="hover:text-[#6D6D6D]"
            >
              <Github className="h-6 w-6" />
            </Link>

            <Link
              href="https://documenso.slack.com"
              target="_blank"
              className="hover:text-[#6D6D6D]"
            >
              <Slack className="h-6 w-6" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <Link
            href="/pricing"
            className="flex-shrink-0 text-sm text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            Pricing
          </Link>

          <Link
            href="https://status.documenso.com"
            target="_blank"
            className="flex-shrink-0 text-sm text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            Status
          </Link>

          <Link
            href="mailto:support@documenso.com"
            className="flex-shrink-0 text-sm text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            Support
          </Link>

          {/* <Link
            href="/privacy"
            className="flex-shrink-0 text-sm text-[#8D8D8D] hover:text-[#6D6D6D]"
          >
            Privacy
          </Link> */}
        </div>
      </div>
      <div className="mx-auto mt-4 w-full max-w-screen-xl px-8 md:mt-12 lg:mt-24">
        <p className="text-sm text-[#8D8D8D]">
          © {new Date().getFullYear()} Documenso, Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
};
