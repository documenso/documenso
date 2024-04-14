'use client';

import { useRouter } from 'next/navigation';

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
        Back
      </Button>
    </div>
  );
}
