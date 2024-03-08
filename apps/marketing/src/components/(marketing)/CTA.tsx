import Link from 'next/link';

import { Button } from '@documenso/ui/primitives/button';

export default function CTA() {
  return (
    <div className="bg-background shadow-foreground/5 border-documenso mt-12 flex flex-col items-center justify-center rounded-lg border-4 border-double p-8 shadow-lg hover:shadow-md">
      <h2 className="mt-4 text-center text-2xl font-bold">
        Join the Open Document Signing Movement
      </h2>

      <p className="text-muted-foreground max-w-[55ch] text-center text-lg leading-normal">
        Create your account and start using state-of-the-art document signing. Open and beautiful
        signing is within your grasp.
      </p>

      <Button className="mt-4 rounded-full no-underline" size="sm" asChild>
        <Link href="https://app.documenso.com/signup?utm_source=cta" target="_blank">
          Get started
        </Link>
      </Button>
    </div>
  );
}
