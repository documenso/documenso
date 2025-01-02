import Link from 'next/link';

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
        <h2 className="text-center text-2xl font-bold">Looking for the managed solution?</h2>

        <p className="text-muted-foreground mt-4 max-w-[55ch] text-center leading-normal">
          You can get started with Documenso in minutes. We handle the infrastructure, so you can
          focus on signing documents.
        </p>

        <Button
          className="focus-visible:ring-ring ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90text-sm mt-8 inline-flex items-center justify-center rounded-full border font-medium no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          variant="default"
          size="lg"
          asChild
        >
          <Link href={`https://app.documenso.com/signup?utm_source=${utmSource}`} target="_blank">
            Get started
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
