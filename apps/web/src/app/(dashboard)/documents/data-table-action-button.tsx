'use client';

import React from 'react';

import Link from 'next/link';

// import { PDFPage } from 'https://cdn.skypack.dev/pdf-lib@^1.11.1?dts';
import { groupBy } from 'lodash';
import { CheckCircle, Download, Edit, EyeIcon, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type { PDFPage } from 'pdf-lib';
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
      const bytes = await getFile(documentData);
      const pdfDoc = await PDFDocument.load(bytes);
      let page = pdfDoc.addPage();

      const signatures = await trpcClient.document.getSignaturesByDocumentId.query({
        id: row.id,
      });
      const auditLogs = groupBy(signatures[0]?.Recipient?.Document?.auditLogs, 'type');
      const { width, height } = page.getSize();
      const tableStyles = {
        x: width * 0.05,
        y: height * 0.08,
        width: width * 0.9,
        height: height * 0.85,
      };
      const fontSize = 10;
      const tableTitlePos = {
        x: width * 0.07,
        y: height * 0.9,
      };
      const titleCellHeight = height * 0.04;
      const intialCellPos = {
        x: tableStyles.x,
        y: tableTitlePos.y - titleCellHeight / 2,
      };
      const cellIncrement = {
        row: tableStyles.width / 3.0,
        col: (tableStyles.height - titleCellHeight) / 4.0,
      };
      const nextLineIndent = 20;
      const drawPageLayout = (page: PDFPage) => {
        page.drawRectangle({
          x: tableStyles.x,
          y: tableStyles.y,
          width: tableStyles.width,
          height: tableStyles.height,
          borderColor: rgb(229 / 255, 229 / 255, 229 / 255),
          borderWidth: 1.5,
        });
        page.drawRectangle({
          x: tableStyles.x + 1.5,
          y: tableStyles.y + 1.5,
          width: tableStyles.width - 3,
          height: tableStyles.height - 3,
          borderColor: rgb(162 / 255, 231 / 255, 113 / 255),
          borderWidth: 1.5,
        });
        page.drawText('Signing Certificate', {
          x: width * 0.05,
          y: height * 0.95,
          size: fontSize + 4,
        });
        page.drawText('Signer Events', {
          x: tableTitlePos.x,
          y: tableTitlePos.y,
          size: fontSize,
        });
        page.drawText('Signature', {
          x: cellIncrement.row + tableTitlePos.x,
          y: tableTitlePos.y,
          size: fontSize,
        });
        page.drawText('Timestamp', {
          x: cellIncrement.row * 2 + width * 0.07,
          y: tableTitlePos.y,
          size: fontSize,
        });
        page.drawLine({
          start: { x: intialCellPos.x, y: intialCellPos.y },
          end: { x: width * 0.95, y: intialCellPos.y },
          thickness: 1.5,
          color: rgb(229 / 255, 229 / 255, 229 / 255),
        });
        page.drawLine({
          start: { x: intialCellPos.x, y: intialCellPos.y - cellIncrement.col },
          end: { x: width * 0.95, y: intialCellPos.y - cellIncrement.col },
          thickness: 1.5,
          color: rgb(229 / 255, 229 / 255, 229 / 255),
        });
        page.drawLine({
          start: { x: intialCellPos.x, y: intialCellPos.y - cellIncrement.col * 2 },
          end: { x: width * 0.95, y: intialCellPos.y - cellIncrement.col * 2 },
          thickness: 1.5,
          color: rgb(229 / 255, 229 / 255, 229 / 255),
        });
        page.drawLine({
          start: { x: intialCellPos.x, y: intialCellPos.y - cellIncrement.col * 3 },
          end: { x: width * 0.95, y: intialCellPos.y - cellIncrement.col * 3 },
          thickness: 1.5,
          color: rgb(229 / 255, 229 / 255, 229 / 255),
        });
      };
      let index = 0;

      for (const signature of signatures) {
        drawPageLayout(page);
        console.log('signature', signature);
        const colInd = index % 4;
        if (colInd == 0 && index != 0) {
          page = pdfDoc.addPage();
          drawPageLayout(page);
        }

        page.drawText(
          `${signature.Recipient.name} \n${signature.Recipient.email} \nSecurity Level: Email, \nAccount Authentication \n(required), Logged in`,
          {
            x: tableTitlePos.x,
            y: intialCellPos.y - nextLineIndent - cellIncrement.col * colInd,
            size: fontSize,
            maxWidth: width * 0.9 * 0.3,
          },
        );
        const signImg = signature?.signatureImageAsBase64;
        const signatureDim = {
          width: cellIncrement.row / 2,
          height: cellIncrement.col / 4,
        };
        if (signImg) {
          const pngImage = await pdfDoc.embedPng(signImg);
          const scaledImage = pngImage.scale(signatureDim.width / pngImage.width);
          page.drawImage(pngImage, {
            width: scaledImage.width,
            height: scaledImage.height,
            x: tableTitlePos.x + cellIncrement.row,
            y: intialCellPos.y - signatureDim.height - cellIncrement.col * colInd,
          });
        }
        page.drawRectangle({
          x: tableTitlePos.x + cellIncrement.row,
          y:
            intialCellPos.y -
            signatureDim.height -
            nextLineIndent * 0.5 -
            cellIncrement.col * colInd,
          width: signatureDim.width,
          height: signatureDim.height,
          borderColor: rgb(162 / 255, 231 / 255, 113 / 255),
          borderWidth: 1.5,
        });
        page.drawText(
          `Singature Id:${signature.id} \nIP Address: ${auditLogs['DOCUMENT_FIELD_INSERTED'].find(
            (log) => (log.email = signature.Recipient.email),
          )} \nSigning Reason: ${signature.Recipient.role}`,
          {
            x: tableTitlePos.x + cellIncrement.row,
            y:
              intialCellPos.y -
              nextLineIndent * 1.5 -
              signatureDim.height -
              cellIncrement.col * colInd,
            size: fontSize,
            maxWidth: width * 0.9 * 0.3,
          },
        );
        page.drawText(
          `Sent: ${auditLogs.DOCUMENT_SENT[0].createdAt}\nViewed: ${
            auditLogs.DOCUMENT_OPENED.find((log) => log.email == signature.Recipient.email)
              ?.createdAt
          } \nSigned: ${
            auditLogs.DOCUMENT_FIELD_INSERTED.find(
              (log) => log?.data?.fieldId == signature.Field.secondaryId,
            )?.createdAt
          }`,
          {
            x: tableTitlePos.x + cellIncrement.row * 2,
            y: intialCellPos.y - nextLineIndent - cellIncrement.col * colInd,
            size: fontSize,
            maxWidth: width * 0.9 * 0.3,
          },
        );
        index++;
      }

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
