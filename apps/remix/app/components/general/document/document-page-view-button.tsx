import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Document, Recipient, Team, User } from '@prisma/client';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { CheckCircle, Download, EyeIcon, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonDropdown,
  SplitButtonDropdownItem,
} from '@documenso/ui/primitives/split-button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentPageViewButtonProps = {
  document: Document & {
    user: Pick<User, 'id' | 'name' | 'email'>;
    recipients: Recipient[];
    team: Pick<Team, 'id' | 'url'> | null;
  };
};

export const DocumentPageViewButton = ({ document }: DocumentPageViewButtonProps) => {
  const { user } = useSession();

  const { toast } = useToast();
  const { _ } = useLingui();

  const recipient = document.recipients.find((recipient) => recipient.email === user.email);

  const isRecipient = !!recipient;
  const isPending = document.status === DocumentStatus.PENDING;
  const isComplete = isDocumentCompleted(document);
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;

  const documentsPath = formatDocumentsPath(document.team?.url);
  const formatPath = document.folderId
    ? `${documentsPath}/f/${document.folderId}/${document.id}/edit`
    : `${documentsPath}/${document.id}/edit`;

  const { mutateAsync: downloadCertificate, isPending: isDownloadingCertificate } =
    trpc.document.downloadCertificate.useMutation();

  const { mutateAsync: downloadAuditLogs, isPending: isDownloadingAuditLogs } =
    trpc.document.downloadAuditLogs.useMutation();

  const onDownloadClick = async () => {
    try {
      const documentWithData = await trpcClient.document.getDocumentById.query(
        {
          documentId: document.id,
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

      await downloadPDF({ documentData, fileName: documentWithData.title });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    }
  };

  const onDownloadOriginalClick = async () => {
    try {
      const documentWithData = await trpcClient.document.getDocumentById.query(
        {
          documentId: document.id,
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

      await downloadPDF({ documentData, fileName: documentWithData.title, version: 'original' });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    }
  };

  const onDownloadCertificateClick = async () => {
    try {
      const { url } = await downloadCertificate({ documentId: document.id });

      const iframe = Object.assign(window.document.createElement('iframe'), {
        src: url,
      });

      Object.assign(iframe.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
      });

      const onLoaded = () => {
        if (iframe.contentDocument?.readyState === 'complete') {
          iframe.contentWindow?.print();

          iframe.contentWindow?.addEventListener('afterprint', () => {
            window.document.body.removeChild(iframe);
          });
        }
      };

      // When the iframe has loaded, print the iframe and remove it from the dom
      iframe.addEventListener('load', onLoaded);

      window.document.body.appendChild(iframe);

      onLoaded();
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the certificate. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const onDownloadAuditLogClick = async () => {
    try {
      const { url } = await downloadAuditLogs({ documentId: document.id });

      const iframe = Object.assign(window.document.createElement('iframe'), {
        src: url,
      });

      Object.assign(iframe.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
      });

      const onLoaded = () => {
        if (iframe.contentDocument?.readyState === 'complete') {
          iframe.contentWindow?.print();

          iframe.contentWindow?.addEventListener('afterprint', () => {
            window.document.body.removeChild(iframe);
          });
        }
      };

      // When the iframe has loaded, print the iframe and remove it from the dom
      iframe.addEventListener('load', onLoaded);

      window.document.body.appendChild(iframe);

      onLoaded();
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the audit logs. Please try again later.`,
        ),
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
      <SplitButton className="w-full">
        <SplitButtonAction onClick={onDownloadClick}>
          <Download className="-ml-1 mr-2 inline h-4 w-4" />
          <Trans>Download</Trans>
        </SplitButtonAction>

        <SplitButtonDropdown>
          <SplitButtonDropdownItem onClick={onDownloadOriginalClick}>
            <Trans>Download Original Document</Trans>
          </SplitButtonDropdownItem>

          <SplitButtonDropdownItem onClick={onDownloadCertificateClick}>
            <Trans>Download Document Certificate</Trans>
          </SplitButtonDropdownItem>

          <SplitButtonDropdownItem onClick={onDownloadAuditLogClick}>
            <Trans>Download Audit Log</Trans>
          </SplitButtonDropdownItem>
        </SplitButtonDropdown>
      </SplitButton>
    ))
    .otherwise(() => null);
};
