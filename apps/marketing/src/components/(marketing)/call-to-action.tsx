import Link from 'next/link';

import { getDictionary } from 'get-dictionary';
import type { Locale } from 'i18n-config';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';

type CallToActionProps = {
  className?: string;
  utmSource?: string;
  lang: Locale;
};

export const CallToAction = async ({
  className,
  utmSource = 'generic-cta',
  lang,
}: CallToActionProps) => {
  const dictionary = await getDictionary(lang);

  return (
    <Card spotlight className={className}>
      <CardContent className="flex flex-col items-center justify-center p-12">
        <h2 className="text-center text-2xl font-bold">{dictionary.open_startup.join}</h2>

        <p className="text-muted-foreground mt-4 max-w-[55ch] text-center leading-normal">
          {dictionary.open_startup.create}
        </p>

        <Button className="mt-8 rounded-full no-underline" size="lg" asChild>
          <Link href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=${utmSource}`} target="_blank">
            {dictionary.open_startup.get_started}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
