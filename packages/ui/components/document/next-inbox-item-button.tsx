'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { DateTime } from 'luxon';

import type { DocumentData, Prisma } from '@documenso/prisma/client';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { Button } from '@documenso/ui/primitives/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

type GetNextInboxDocumentResult = Prisma.DocumentGetPayload<{
  select: {
    createdAt: true;
    title: true;
    Recipient: {
      select: {
        token: true;
      };
    };
    documentMeta: true;
  };
}> | null;

export type NextInboxItemButtonProps = HTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean;
  documentData?: DocumentData;
  userEmail: string | undefined;
  nextInboxDocument: GetNextInboxDocumentResult;
};

export const NextInboxItemButton = ({
  className,
  documentData,
  nextInboxDocument,
  userEmail,
  disabled,
  ...props
}: NextInboxItemButtonProps) => {
  const recipientToken = nextInboxDocument?.Recipient[0]?.token ?? null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Link href={'/sign/' + recipientToken}>
          <Button
            type="button"
            variant="outline"
            className={className}
            disabled={disabled || !documentData || !userEmail}
            {...props}
          >
            <SignatureIcon className="mr-2 h-5 w-5" />
            <Trans>Sign Next Document</Trans>
          </Button>
        </Link>
      </TooltipTrigger>

      <TooltipContent className="flex flex-row items-start gap-x-2 p-4">
        <div className="gap-y-2">
          <p className="text-foreground text-base font-semibold">{nextInboxDocument?.title}</p>

          {nextInboxDocument?.createdAt && (
            <p className="text-muted-foreground text-sm">
              <Trans>
                Created {DateTime.fromJSDate(nextInboxDocument?.createdAt).toFormat('LLL ‘yy')}
              </Trans>
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
