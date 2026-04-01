import { Trans } from '@lingui/react/macro';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { CheckCircle, Download, EyeIcon, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { Button } from '@documenso/ui/primitives/button';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';

export type DocumentPageViewButtonProps = {
  envelope: TEnvelope;
};

export const DocumentPageViewButton = ({ envelope }: DocumentPageViewButtonProps) => {
  const { user } = useSession();

  const recipient = envelope.recipients.find((recipient) => recipient.email === user.email);

  const isRecipient = !!recipient;
  const isPending = envelope.status === DocumentStatus.PENDING;
  const isComplete = isDocumentCompleted(envelope);
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;

  const documentsPath = formatDocumentsPath(envelope.team.url);
  const formatPath = `${documentsPath}/${envelope.id}/edit`;

  return match({
    isRecipient,
    isPending,
    isComplete,
    isSigned,
    internalVersion: envelope.internalVersion,
  })
    .with({ isRecipient: true, isPending: true, isSigned: false }, () => (
      <Button className="w-full" asChild>
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
    .with({ isComplete: false }, () => (
      <Button className="w-full" asChild>
        <Link to={formatPath}>
          <Trans>Edit</Trans>
        </Link>
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <EnvelopeDownloadDialog
        envelopeId={envelope.id}
        envelopeStatus={envelope.status}
        envelopeItems={envelope.envelopeItems}
        token={recipient?.token}
        trigger={
          <Button className="w-full">
            <Download className="-ml-1 mr-2 inline h-4 w-4" />
            <Trans>Download</Trans>
          </Button>
        }
      />
    ))
    .otherwise(() => null);
};
