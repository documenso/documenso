'use client';

import Link from 'next/link';

import { usePlausible } from 'next-plausible';

import { Button } from '@documenso/ui/primitives/button';

export const Enterprise = () => {
  const event = usePlausible();

  return (
    <div className="mx-auto mt-36 max-w-2xl">
      <h2 className="text-center text-2xl font-semibold">
        Enterprise Compliance, License or Technical Needs?
      </h2>

      <p className="text-muted-foreground mt-4 text-center leading-relaxed">
        Our Enterprise License is great large organizations looking to switch to Documenso for all
        their signing needs. It's availible for our cloud offering as well as self-hosted setups and
        offer a wide range of compliance and Adminstration Features.
      </p>

      <div className="mt-4 flex justify-center">
        <Link
          href="https://dub.sh/enterprise"
          target="_blank"
          className="mt-6"
          onClick={() => event('enterprise-contact')}
        >
          <Button className="rounded-full text-base">Contact Us</Button>
        </Link>
      </div>
    </div>
  );
};
