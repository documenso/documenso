import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';

type CallToActionProps = {
  className?: string;
  utmSource?: string;
};

export const CallToAction = ({ className, utmSource = 'generic-cta' }: CallToActionProps) => {
  return (
    <Card spotlight className={className}>
      <CardContent className="flex flex-col items-center justify-center p-12">
        <h2 className="text-center text-2xl font-bold">
          <Trans>Join the Open Signing Movement</Trans>
        </h2>

        <p className="text-muted-foreground mt-4 max-w-[55ch] text-center leading-normal">
          <Trans>
            Create your account and start using state-of-the-art document signing. Open and
            beautiful signing is within your grasp.
          </Trans>
        </p>

        <Button className="mt-8 rounded-full no-underline" size="lg" asChild>
          <Link href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=${utmSource}`} target="_blank">
            <Trans>Get started</Trans>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
