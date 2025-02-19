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
  team?: Pick<Team, 'id' | 'url'>;
};

export const DocumentPageViewButton = ({
  document: activeDocument,
}: DocumentPageViewButtonProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  if (!session) {
    return null;
  }

  const recipient = activeDocument.recipients.find(
    (recipient) => recipient.email === session.user.email,
  );

  const isRecipient = !!recipient;
  const isPending = activeDocument.status === DocumentStatus.PENDING;
  const isComplete = activeDocument.status === DocumentStatus.COMPLETED;
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const role = recipient?.role;

  const documentsPath = formatDocumentsPath(activeDocument.team?.url);

  const onDownloadClick = async () => {
    try {
      const documentWithData = await trpcClient.document.getDocumentById.query(
        {
          documentId: activeDocument.id,
        },
        {
          context: {
            teamId: activeDocument.team?.id?.toString(),
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
      });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    }
  };

  const onDownloadAuditLogClick = async () => {
    try {
      const { url } = await trpcClient.document.downloadAuditLogs.mutate({
        documentId: activeDocument.id,
      });

      const iframe = Object.assign(document.createElement('iframe'), {
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
            document.body.removeChild(iframe);
          });
        }
      };

      // When the iframe has loaded, print the iframe and remove it from the dom
      iframe.addEventListener('load', onLoaded);

      document.body.appendChild(iframe);

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

  const onDownloadSigningCertificateClick = async () => {
    try {
      const { url } = await trpcClient.document.downloadCertificate.mutate({
        documentId: activeDocument.id,
      });

      const iframe = Object.assign(document.createElement('iframe'), {
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
            document.body.removeChild(iframe);
          });
        }
      };

      // When the iframe has loaded, print the iframe and remove it from the dom
      iframe.addEventListener('load', onLoaded);

      document.body.appendChild(iframe);

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
        <Link href={`${documentsPath}/${activeDocument.id}/edit`}>
          <Trans>Edit</Trans>
        </Link>
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <SplitButton className="flex w-full">
        <SplitButtonAction className="w-full" onClick={() => void onDownloadClick()}>
          <Download className="-ml-1 mr-2 inline h-4 w-4" />
          <Trans>Download</Trans>
        </SplitButtonAction>
        <SplitButtonDropdown>
          <SplitButtonDropdownItem onClick={() => void onDownloadAuditLogClick()}>
            <Trans>Only Audit Log</Trans>
          </SplitButtonDropdownItem>

          <SplitButtonDropdownItem onClick={() => void onDownloadSigningCertificateClick()}>
            <Trans>Only Signing Certificate</Trans>
          </SplitButtonDropdownItem>
        </SplitButtonDropdown>
      </SplitButton>
    ))
    .otherwise(() => null);
};
