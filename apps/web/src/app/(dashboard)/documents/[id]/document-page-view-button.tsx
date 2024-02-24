'use client';

import Link from 'next/link';

import { CheckCircle, Download, EyeIcon, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Document, Recipient, Team, User } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentPageViewButtonProps = {
  document: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
    team: Pick<Team, 'id' | 'url'> | null;
  };
  team?: Pick<Team, 'id' | 'url'>;
};

export const DocumentPageViewButton = ({ document, team }: DocumentPageViewButtonProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();

  if (!session) {
    return null;
  }

  const recipient = document.Recipient.find((recipient) => recipient.email === session.user.email);

  const isRecipient = !!recipient;
  const isPending = document.status === DocumentStatus.PENDING;
  const isComplete = document.status === DocumentStatus.COMPLETED;
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;

  const documentsPath = formatDocumentsPath(document.team?.url);

  const onDownloadClick = async () => {
    try {
      const documentWithData = await trpcClient.document.getDocumentById.query({
        id: document.id,
        teamId: team?.id,
      });

      const documentData = documentWithData?.documentData;

      if (!documentData) {
        throw new Error('No document available');
      }

      await downloadPDF({ documentData, fileName: documentWithData.title });
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description: 'An error occurred while downloading your document.',
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
                Sign
              </>
            ))
            .with(RecipientRole.APPROVER, () => (
              <>
                <CheckCircle className="-ml-1 mr-2 h-4 w-4" />
                Approve
              </>
            ))
            .otherwise(() => (
              <>
                <EyeIcon className="-ml-1 mr-2 h-4 w-4" />
                View
              </>
            ))}
        </Link>
      </Button>
    ))
    .with({ isComplete: false }, () => (
      <Button className="w-full" asChild>
        <Link href={`${documentsPath}/${document.id}/edit`}>Edit</Link>
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <Button className="w-full" onClick={onDownloadClick}>
        <Download className="-ml-1 mr-2 inline h-4 w-4" />
        Download
      </Button>
    ))
    .otherwise(() => null);
};
