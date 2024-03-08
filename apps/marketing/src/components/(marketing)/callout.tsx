'use client';

import Link from 'next/link';

import { usePlausible } from 'next-plausible';
import { LuGithub } from 'react-icons/lu';

import { Button } from '@documenso/ui/primitives/button';

export type CalloutProps = {
  starCount?: number;
  [key: string]: unknown;
};

export const Callout = ({ starCount }: CalloutProps) => {
  const event = usePlausible();

  const onSignUpClick = () => {
    const el = document.getElementById('email');

    if (el) {
      const { top } = el.getBoundingClientRect();

      window.scrollTo({
        top: top - 120,
        behavior: 'smooth',
      });

      setTimeout(() => {
        el.focus();
      }, 500);
    }
  };

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <Button
        type="button"
        variant="outline"
        className="rounded-full bg-transparent backdrop-blur-sm"
        onClick={onSignUpClick}
      >
        Claim Early Adopter Plan
        <span className="bg-primary dark:text-background -mr-2.5 ml-2.5 rounded-full px-2 py-1.5 text-xs font-medium">
          $30/mo
        </span>
      </Button>

      <Link
        href="https://github.com/documenso/documenso"
        target="_blank"
        onClick={() => event('view-github')}
      >
        <Button variant="outline" className="rounded-full bg-transparent backdrop-blur-sm">
          <LuGithub className="mr-2 h-5 w-5" />
          Star on Github
          {starCount && starCount > 0 && (
            <span className="bg-primary dark:text-background -mr-2.5 ml-2.5 rounded-full px-2 py-1.5 text-xs">
              {starCount.toLocaleString('en-US')}
            </span>
          )}
        </Button>
      </Link>
    </div>
  );
};
