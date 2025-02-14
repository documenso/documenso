'use client';

import Link from 'next/link';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CheckCircle, Download, EyeIcon, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Document, Recipient, Team, User } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentPageViewButtonProps = {
  document: Document & {
    user: Pick<User, 'id' | 'name' | 'email'>;
    recipients: Recipient[];
    team: Pick<Team, 'id' | 'url'> | null;
  };
  team?: Pick<Team, 'id' | 'url'>;
};

export const DocumentPageViewButton = ({ document }: DocumentPageViewButtonProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  if (!session) {
    return null;
  }

  const recipient = document.recipients.find((recipient) => recipient.email === session.user.email);

  const isRecipient = !!recipient;
  const isPending = document.status === DocumentStatus.PENDING;
  const isComplete = document.status === DocumentStatus.COMPLETED;
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;

  const documentsPath = formatDocumentsPath(document.team?.url);

  const onDownloadClick = async ({
    includeCertificate = true,
    includeAuditLog = true,
  }: {
    includeCertificate?: boolean;
    includeAuditLog?: boolean;
  } = {}) => {
    try {
      const documentWithData = await trpcClient.document.getDocumentById.query(
        {
          documentId: document.id,
          includeCertificate,
          includeAuditLog,
        },
        {
          context: {
            teamId: document.team?.id?.toString(),
          },
        },
      );

      const documentData = documentWithData?.documentData;

      if (!documentData) {
        throw new Error('No document available');
      }

      await downloadPDF({
        documentData,
        fileName: documentWithData.title,
        includeCertificate,
        includeAuditLog,
      });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    }
  };

  return match({
    isRecipient,
    isPending,
    isComplete,
    isSigned,
  })
    .with({ isRecipient: true, isPending: true, isSigned: false }, () => (
      <Button className="w-full" asChild>
        <Link href={`/sign/${recipient?.token}`}>
          {match(role)
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
    ))
    .with({ isComplete: false }, () => (
      <Button className="w-full" asChild>
        <Link href={`${documentsPath}/${document.id}/edit`}>
          <Trans>Edit</Trans>
        </Link>
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full">
            <Download className="-ml-1 mr-2 inline h-4 w-4" />
            <Trans>Download</Trans>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => void onDownloadClick()}>
            <Trans>Complete Document</Trans>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              void onDownloadClick({ includeCertificate: true, includeAuditLog: false })
            }
          >
            <Trans>Without Audit Log</Trans>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              void onDownloadClick({ includeCertificate: false, includeAuditLog: true })
            }
          >
            <Trans>Without Certificate</Trans>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              void onDownloadClick({ includeCertificate: false, includeAuditLog: false })
            }
          >
            <Trans>Without Certificate & Audit Log</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    .otherwise(() => null);
};
