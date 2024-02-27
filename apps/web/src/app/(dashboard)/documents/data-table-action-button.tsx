'use client';

import React from 'react';

import Link from 'next/link';

import { CheckCircle, Download, Edit, EyeIcon, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { PDFDocument, rgb } from 'pdf-lib';
import { match } from 'ts-pattern';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { getFile } from '@documenso/lib/universal/upload/get-file';
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
      const signatures = await trpcClient.document.getSignaturesByDocumentId.query({
        id: row.id,
      });
      const bytes = await getFile(documentData);
      const signImg = signatures[0].signatureImageAsBase64;

      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;
      page.drawRectangle({
        x: width * 0.05,
        y: height * 0.05,
        width: width * 0.9,
        height: height * 0.85,
        borderColor: rgb(229 / 255, 229 / 255, 229 / 255),
        borderWidth: 1.5,
      });
      page.drawRectangle({
        x: width * 0.05 + 1.5,
        y: height * 0.05 + 1.5,
        width: width * 0.9 - 3,
        height: height * 0.85 - 3,
        borderColor: rgb(162 / 255, 231 / 255, 113 / 255),
        borderWidth: 1.5,
      });

      // if(signImg) {
      //   const pngImage = await pdfDoc.embedPng(signImg);
      //   page.drawImage(pngImage, {
      //     width: pngImage.width,
      //     height: pngImage.height,
      //   });
      // }
      page.drawText('Signing Certificate', {
        x: width * 0.05,
        y: height * 0.93,
        size: fontSize + 4,
      });
      page.drawText('Signer Events', {
        x: width * 0.07,
        y: height * 0.87,
        size: fontSize,
      });
      page.drawText('Signature', {
        x: (width - 50) / 3 + width * 0.07,
        y: height * 0.87,
        size: fontSize,
      });
      page.drawText('Timestamp', {
        x: ((width - 50) * 2) / 3 + width * 0.07,
        y: height * 0.87,
        size: fontSize,
      });
      page.drawLine({
        start: { x: width * 0.05, y: height * 0.85 },
        end: { x: width * 0.95, y: height * 0.85 },
        thickness: 1.5,
        color: rgb(229 / 255, 229 / 255, 229 / 255),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], {
        type: 'application/pdf',
      });

      downloadFile({
        filename: row.title,
        data: blob,
      });

      // await downloadPDF({ documentData, fileName: row.title });
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description: 'An error occurred while downloading your document.',
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
            Edit
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
    .with({ isPending: true, isSigned: true }, () => (
      <Button className="w-32" disabled={true}>
        <EyeIcon className="-ml-1 mr-2 h-4 w-4" />
        View
      </Button>
    ))
    .with({ isComplete: true }, () => {
      return (
        <Button className="w-32" onClick={onDownloadClick}>
          <Download className="-ml-1 mr-2 inline h-4 w-4" />
          Download
        </Button>
      );
    })
    .otherwise(() => <div></div>);
};
