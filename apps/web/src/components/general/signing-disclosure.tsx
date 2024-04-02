import type { HTMLAttributes } from 'react';

import Link from 'next/link';

import { cn } from '@documenso/ui/lib/utils';

export type SigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

export const SigningDisclosure = ({ className, ...props }: SigningDisclosureProps) => {
  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props}>
      By proceeding with your electronic signature, you acknowledge and consent that it will be used
      to sign the given document and holds the same legal validity as a handwritten signature. By
      completing the electronic signing process, you affirm your understanding and acceptance of
      these conditions.
      <span className="mt-2 block">
        Read the full{' '}
        <Link
          className="text-documenso-700 underline"
          href="/articles/signature-disclosure"
          target="_blank"
        >
          signature disclosure
        </Link>
        .
      </span>
    </p>
  );
};
