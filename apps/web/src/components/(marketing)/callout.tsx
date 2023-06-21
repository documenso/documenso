'use client';

import Link from 'next/link';

import { Github } from 'lucide-react';
import { usePlausible } from 'next-plausible';

import { Button } from '@documenso/ui/primitives/button';

export const Callout = () => {
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
        Get the Community Plan
        <span className="bg-primary -mr-2 ml-2.5 rounded-full px-2 py-1.5 text-xs">
          $30/mo. forever!
        </span>
      </Button>

      <Button variant="outline" className="rounded-full bg-transparent backdrop-blur-sm" asChild>
        <Link
          href="https://github.com/documenso/documenso"
          target="_blank"
          onClick={() => event('view-github')}
        >
          <Github className="mr-2 h-5 w-5" />
          Star on Github
        </Link>
      </Button>
    </div>
  );
};
