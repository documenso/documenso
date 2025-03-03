'use client';

import type { HTMLAttributes } from 'react';

import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { CheckCircle, EyeIcon, Pencil } from 'lucide-react';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { type DocumentData, type Prisma, RecipientRole } from '@documenso/prisma/client';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { Button } from '@documenso/ui/primitives/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@documenso/ui/primitives/sheet';

import { DocumentStatus } from './document-status';

type GetNextInboxDocumentResult =
  | Prisma.DocumentGetPayload<{
      select: {
        id: true;
        createdAt: true;
        title: true;
        status: true;
        recipients: {
          select: {
            token: true;
            role: true;
          };
        };
        documentMeta: true;
      };
    }>[]
  | null;

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
  return (
    <Sheet>
      <SheetTrigger asChild>
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
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-2xl">Inbox</SheetTitle>
          <SheetDescription>Documents awaiting your signature or review</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {nextInboxDocument?.map((document) => {
            const recipient = document.recipients[0];

            return (
              <div key={document.id} className="flex items-center justify-between space-y-1">
                <div>
                  <p className="text-foreground text-lg font-semibold">{document.title}</p>

                  <div className="flex items-center gap-x-2">
                    <DocumentStatus status={document.status} />

                    {document.createdAt && (
                      <p className="text-muted-foreground">
                        <Trans>
                          Created {DateTime.fromJSDate(document.createdAt).toFormat('LLL ‘yy')}
                        </Trans>
                      </p>
                    )}
                  </div>
                </div>

                <Button asChild className="w-28">
                  <Link href={`/sign/${recipient?.token}`}>
                    {match(recipient?.role)
                      .with(RecipientRole.SIGNER, () => (
                        <>
                          <Pencil className="-ml-1 mr-2 h-4 w-4" />
                          <Trans>Sign</Trans>
                        </>
                      ))
                      .with(RecipientRole.APPROVER, () => (
                        <>
                          <CheckCircle className="-ml-1 mr-2 h-4 w-4" />
                          <Trans>Approve</Trans>
                        </>
                      ))
                      .otherwise(() => (
                        <>
                          <EyeIcon className="-ml-1 mr-2 h-4 w-4" />
                          <Trans>View</Trans>
                        </>
                      ))}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
