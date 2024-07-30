'use client';

import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { usePlausible } from 'next-plausible';

import { Button } from '@documenso/ui/primitives/button';

export const Enterprise = () => {
  const event = usePlausible();

  return (
    <div className="mx-auto mt-36 max-w-2xl">
      <h2 className="text-center text-2xl font-semibold">
        <Trans>Enterprise Compliance, License or Technical Needs?</Trans>
      </h2>

      <p className="text-muted-foreground mt-4 text-center leading-relaxed">
        <Trans>
          Our Enterprise License is great for large organizations looking to switch to Documenso for
          all their signing needs. It's available for our cloud offering as well as self-hosted
          setups and offers a wide range of compliance and Adminstration Features.
        </Trans>
      </p>

      <div className="mt-4 flex justify-center">
        <Link
          href="https://dub.sh/enterprise"
          target="_blank"
          className="mt-6"
          onClick={() => event('enterprise-contact')}
        >
          <Button className="rounded-full text-base">
            <Trans>Contact Us</Trans>
          </Button>
        </Link>
      </div>
    </div>
  );
};
