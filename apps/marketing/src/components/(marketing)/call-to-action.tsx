import Link from 'next/link';

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
        <h2 className="text-center text-2xl font-bold">შეუერთდით შვენს მოძრაობას</h2>

        <p className="text-muted-foreground mt-4 max-w-[55ch] text-center leading-normal">
          შექმენით ანგარიში და დაიწყეთ დოკუმენტებზე ხელის მოწერა მარტივად და სწრაფად.
        </p>

        <Button className="mt-8 rounded-full no-underline" size="lg" asChild>
          <Link href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=${utmSource}`} target="_blank">
            Დაიწყე
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
