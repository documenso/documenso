'use client';

import Link from 'next/link';

import type { getDictionary } from 'get-dictionary';
import { usePlausible } from 'next-plausible';

import { Button } from '@documenso/ui/primitives/button';

type EnterpriseProps = {
  dictionary: Awaited<ReturnType<typeof getDictionary>>['pricing'];
};

export const Enterprise = ({ dictionary }: EnterpriseProps) => {
  const event = usePlausible();

  return (
    <div className="mx-auto mt-36 max-w-2xl">
      <h2 className="text-center text-2xl font-semibold">{dictionary.enterprise_compliance}</h2>

      <p className="text-muted-foreground mt-4 text-center leading-relaxed">
        {dictionary.our_entreprise}
      </p>

      <div className="mt-4 flex justify-center">
        <Link
          href="https://dub.sh/enterprise"
          target="_blank"
          className="mt-6"
          onClick={() => event('enterprise-contact')}
        >
          <Button className="rounded-full text-base">{dictionary.contact_us}</Button>
        </Link>
      </div>
    </div>
  );
};
