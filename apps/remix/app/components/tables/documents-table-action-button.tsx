import { Trans } from '@lingui/react/macro';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { CheckCircle, Download, Edit, EyeIcon, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TDocumentMany as TDocumentRow } from '@documenso/lib/types/document';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { Button } from '@documenso/ui/primitives/button';

import { useCurrentTeam } from '~/providers/team';

import { EnvelopeDownloadDialog } from '../dialogs/envelope-download-dialog';

export type DocumentsTableActionButtonProps = {
  row: TDocumentRow;
};

export const DocumentsTableActionButton = ({ row }: DocumentsTableActionButtonProps) => {
  const { user } = useSession();

  const team = useCurrentTeam();

  const recipient = row.recipients.find((recipient) => recipient.email === user.email);

  const isOwner = row.user.id === user.id;
  const isRecipient = !!recipient;
  const isDraft = row.status === DocumentStatus.DRAFT;
  const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = isDocumentCompleted(row.status);
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;
  const isCurrentTeamDocument = team && row.team?.url === team.url;

  const documentsPath = formatDocumentsPath(team.url);
  const formatPath = `${documentsPath}/${row.envelopeId}/edit`;

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
    internalVersion: row.internalVersion,
  })
    .with(
      isOwner ? { isDraft: true, isOwner: true } : { isDraft: true, isCurrentTeamDocument: true },
      () => (
        <Button className="w-32" asChild>
          <Link to={formatPath}>
            <Edit className="-ml-1 mr-2 h-4 w-4" />
            <Trans>Edit</Trans>
          </Link>
        </Button>
      ),
    )
    .with({ isRecipient: true, isPending: true, isSigned: false }, () => (
      <Button className="w-32" asChild>
        <Link to={`/sign/${recipient?.token}`}>
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
      <EnvelopeDownloadDialog
        envelopeId={row.envelopeId}
        envelopeStatus={row.status}
        token={recipient?.token}
        trigger={
          <Button className="w-32">
            <Download className="-ml-1 mr-2 inline h-4 w-4" />
            <Trans>Download</Trans>
          </Button>
        }
      />
    ))
    .otherwise(() => <div></div>);
};
