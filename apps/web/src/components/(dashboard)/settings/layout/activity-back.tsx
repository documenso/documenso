'use client';

import { useRouter } from 'next/navigation';

import { Trans } from '@lingui/macro';

import { Button } from '@documenso/ui/primitives/button';

export default function ActivityPageBackButton() {
  const router = useRouter();
  return (
    <div>
      <Button
        className="flex-shrink-0"
        variant="secondary"
        onClick={() => {
          void router.back();
        }}
      >
        <Trans>Back</Trans>
      </Button>
    </div>
  );
}
