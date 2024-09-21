'use client';

import Link from 'next/link';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CheckCircle, Download, Edit, EyeIcon, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Document, Recipient, Team, User } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DataTableActionButtonProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
    team: Pick<Team, 'id' | 'url'> | null;
  };
  team?: Pick<Team, 'id' | 'url'>;
};

export const DataTableActionButton = ({ row, team }: DataTableActionButtonProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  if (!session) {
    return null;
  }

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  const isRecipient = !!recipient;
  const isDraft = row.status === DocumentStatus.DRAFT;
  const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = row.status === DocumentStatus.COMPLETED;
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;
  const isCurrentTeamDocument = team && row.team?.url === team.url;

  const documentsPath = formatDocumentsPath(team?.url);

  const onDownloadClick = async () => {
    try {
      let document: DocumentWithData | null = null;

      if (!recipient) {
        document = await trpcClient.document.getDocumentById.query({
          id: row.id,
          teamId: team?.id,
        });
      } else {
        document = await trpcClient.document.getDocumentByToken.query({
          token: recipient.token,
        });
      }

      const documentData = document?.documentData;

      if (!documentData) {
        throw Error('No document available');
      }

      await downloadPDF({ documentData, fileName: row.title });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    }
  };

  // TODO: Consider if want to keep this logic for hiding viewing for CC'ers
  if (recipient?.role === RecipientRole.CC && isComplete === false) {
    return null;
  }

  return match({
    isOwner,
    isRecipient,
    isDraft,
    isPending,
    isComplete,
    isSigned,
    isCurrentTeamDocument,
  })
    .with(
      isOwner ? { isDraft: true, isOwner: true } : { isDraft: true, isCurrentTeamDocument: true },
      () => (
        <Button className="w-32" asChild>
          <Link href={`${documentsPath}/${row.id}/edit`}>
            <Edit className="-ml-1 mr-2 h-4 w-4" />
            <Trans>Edit</Trans>
          </Link>
        </Button>
      ),
    )
    .with({ isRecipient: true, isPending: true, isSigned: false }, () => (
      <Button className="w-32" asChild>
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
    .with({ isPending: true, isSigned: true }, () => (
      <Button className="w-32" disabled={true}>
        <EyeIcon className="-ml-1 mr-2 h-4 w-4" />
        <Trans>View</Trans>
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <Button className="w-32" onClick={onDownloadClick}>
        <Download className="-ml-1 mr-2 inline h-4 w-4" />
        <Trans>Download</Trans>
      </Button>
    ))
    .otherwise(() => <div></div>);
};
