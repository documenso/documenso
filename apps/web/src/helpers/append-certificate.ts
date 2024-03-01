import { groupBy } from 'lodash';
import type { PDFPage } from 'pdf-lib';
import { PDFDocument, rgb } from 'pdf-lib';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import type { DocumentData } from '@documenso/prisma/client';
import { trpc as trpcClient } from '@documenso/trpc/client';

export const appendCertificate = async (documentData: DocumentData, documentId: number) => {
  const bytes = await getFile(documentData);
  const pdfDoc = await PDFDocument.load(bytes);
  let page = pdfDoc.addPage();
  const signatures = await trpcClient.document.getSignaturesByDocumentId.query({
    id: documentId,
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
  const drawPageLayout = (page: PDFPage, pageInd: number, totalPage: number) => {
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
    page.drawText(`Page ${pageInd} of ${totalPage}`, {
      x: width * 0.85,
      y: height * 0.05,
      size: fontSize,
    });
  };
  let index = 0;
  const totalPage = Math.ceil(signatures.length / 4.0);
  drawPageLayout(page, 1, totalPage);
  for (const signature of signatures) {
    const colInd = index % 4;
    if (colInd == 0 && index != 0) {
      page = pdfDoc.addPage();
      drawPageLayout(page, Math.ceil(index / 4) + 1, totalPage);
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
      y: intialCellPos.y - signatureDim.height - nextLineIndent * 0.5 - cellIncrement.col * colInd,
      width: signatureDim.width,
      height: signatureDim.height,
      borderColor: rgb(162 / 255, 231 / 255, 113 / 255),
      borderWidth: 1.5,
    });
    page.drawText(
      `Singature Id:${signature.id} \nIP Address: ${
        auditLogs.DOCUMENT_FIELD_INSERTED.find(
          (log) => log?.data?.fieldId == signature.Field.secondaryId,
        )?.ipAddress
      } \nSigning Reason: ${signature.Recipient.role}`,
      {
        x: tableTitlePos.x + cellIncrement.row,
        y:
          intialCellPos.y - nextLineIndent * 1.5 - signatureDim.height - cellIncrement.col * colInd,
        size: fontSize,
        maxWidth: width * 0.9 * 0.3,
      },
    );
    page.drawText(
      `Sent: ${auditLogs.DOCUMENT_SENT[0].createdAt}\nViewed: ${
        auditLogs.DOCUMENT_OPENED.find((log) => log.email == signature.Recipient.email)?.createdAt
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
  return new Blob([pdfBytes], {
    type: 'application/pdf',
  });
};
