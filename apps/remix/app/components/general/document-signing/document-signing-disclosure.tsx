import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { cn } from '@documenso/ui/lib/utils';

export type DocumentSigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

export const DocumentSigningDisclosure = ({
  className,
  ...props
}: DocumentSigningDisclosureProps) => {
  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props}>
      <Trans>
        By proceeding with your electronic signature, you acknowledge and consent that it will be
        used to sign the given document and holds the same legal validity as a handwritten
        signature. By completing the electronic signing process, you affirm your understanding and
        acceptance of these conditions.
      </Trans>
      <span className="mt-2 block">
        <Trans>
          Read the full{' '}
          <Link
            className="text-documenso-700 underline"
            to="/articles/signature-disclosure"
            target="_blank"
          >
            signature disclosure
          </Link>
          .
        </Trans>
      </span>
    </p>
  );
};
