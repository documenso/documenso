import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import type { Recipient } from '@prisma/client';
import { EnvelopeType, FieldType, RecipientRole } from '@prisma/client';
import PDFParser from 'pdf2json';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { createEnvelopeFields } from '@documenso/lib/server-only/field/create-envelope-fields';
import { createDocumentRecipients } from '@documenso/lib/server-only/recipient/create-document-recipients';
import { createTemplateRecipients } from '@documenso/lib/server-only/recipient/create-template-recipients';
import type { TFieldAndMeta } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { EnvelopeIdOptions } from '@documenso/lib/utils/envelope';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { generateRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';

import { getPageSize } from './get-page-size';

type TextPosition = {
  text: string;
  x: number;
  y: number;
  w: number;
};

type CharIndexMapping = {
  textPosIndex: number;
};

type PlaceholderInfo = {
  placeholder: string;
  fieldType: string;
  recipient: string;
  isRequired: string;
  page: number;
  // PDF2JSON coordinates (in page units - these are relative to page dimensions)
  x: number;
  y: number;
  width: number;
  height: number;
  // Page dimensions from PDF2JSON (in page units)
  pageWidth: number;
  pageHeight: number;
};

type FieldToCreate = TFieldAndMeta & {
  recipientId: number;
  pageNumber: number;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

/*
  Questions for later:
    - Does it handle multi-page PDFs? ✅ YES! ✅
    - Does it handle multiple recipients on the same page? ✅ YES! ✅
    - Does it handle multiple recipients on multiple pages? ✅ YES! ✅
    - What happens with incorrect placeholders? E.g. those containing non-accepted properties.
    - The placeholder data is dynamic. How to handle this parsing? Perhaps we need to do it similar to the fieldMeta parsing.
    - Need to handle envelopes with multiple items.
*/

export const extractPlaceholdersFromPDF = async (pdf: Buffer): Promise<PlaceholderInfo[]> => {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);

    parser.on('pdfParser_dataError', (errData) => {
      reject(errData);
    });

    parser.on('pdfParser_dataReady', (pdfData) => {
      const placeholders: PlaceholderInfo[] = [];

      pdfData.Pages.forEach((page, pageIndex) => {
        /*
          pdf2json returns the PDF page content as an array of characters.
          We need to concatenate the characters to get the full text.
          We also need to get the position of the text so we can place the placeholders in the correct position.
          
          Page dimensions from PDF2JSON are in "page units" (relative coordinates)
        */
        const pageWidth = page.Width;
        const pageHeight = page.Height;

        let pageText = '';
        const textPositions: TextPosition[] = [];
        const charIndexToTextPos: CharIndexMapping[] = [];

        page.Texts.forEach((text) => {
          /*
            R is an array that contains objects with each character.
            The decodedText contains only the character, without any other information.

            textPositions stores each character and its position on the page.
          */
          const decodedText = text.R.map((run) => decodeURIComponent(run.T)).join('');

          for (let i = 0; i < decodedText.length; i++) {
            charIndexToTextPos.push({
              textPosIndex: textPositions.length,
            });
          }

          pageText += decodedText;

          textPositions.push({
            text: decodedText,
            x: text.x,
            y: text.y,
            w: text.w || 0,
          });
        });

        const placeholderMatches = pageText.matchAll(/{{([^}]+)}}/g);

        for (const match of placeholderMatches) {
          const placeholder = match[0];
          const placeholderData = match[1].split(',').map((part) => part.trim());

          const [fieldType, recipient, isRequired] = placeholderData;

          /*
            Find the position of where the placeholder starts in the text

            Then find the position of where the placeholder ends in the text by adding the length of the placeholder to the index of the placeholder.
          */
          const matchIndex = match.index;
          const placeholderLength = placeholder.length;
          const placeholderEndIndex = matchIndex + placeholderLength;

          const startCharInfo = charIndexToTextPos[matchIndex];
          const endCharInfo = charIndexToTextPos[placeholderEndIndex - 1];

          if (!startCharInfo || !endCharInfo) {
            console.error('Could not find text position for placeholder', placeholder);

            return;
          }

          const startTextPos = textPositions[startCharInfo.textPosIndex];
          const endTextPos = textPositions[endCharInfo.textPosIndex];

          /* 
            PDF2JSON coordinates - these are in "page units" (relative coordinates)
            Calculate width as the distance from start to end, plus a portion of the last character's width
            Use 10% of the last character width to avoid extending too far beyond the placeholder
          */
          const x = startTextPos.x;
          const y = startTextPos.y;
          const width = endTextPos.x + endTextPos.w * 0.1 - startTextPos.x;

          placeholders.push({
            placeholder,
            fieldType,
            recipient,
            isRequired,
            page: pageIndex + 1,
            x,
            y,
            width,
            height: 1,
            pageWidth,
            pageHeight,
          });
        }
      });

      resolve(placeholders);
    });

    parser.parseBuffer(pdf);
  });
};

export const replacePlaceholdersInPDF = async (pdf: Buffer): Promise<Buffer> => {
  const placeholders = await extractPlaceholdersFromPDF(pdf);

  const pdfDoc = await PDFDocument.load(new Uint8Array(pdf));
  const pages = pdfDoc.getPages();

  for (const placeholder of placeholders) {
    const pageIndex = placeholder.page - 1;
    const page = pages[pageIndex];

    const { width: pdfLibPageWidth, height: pdfLibPageHeight } = getPageSize(page);

    /*
      Convert PDF2JSON coordinates to pdf-lib coordinates:
      
      PDF2JSON uses relative "page units":
      - x, y, width, height are in page units
      - Page dimensions (Width, Height) are also in page units
      
      pdf-lib uses absolute points (1 point = 1/72 inch):
      - Need to convert from page units to points
      - Y-axis in pdf-lib is bottom-up (origin at bottom-left)
      - Y-axis in PDF2JSON is top-down (origin at top-left)
      
      Conversion formulas:
      - x_points = (x / pageWidth) * pdfLibPageWidth
      - y_points = pdfLibPageHeight - ((y / pageHeight) * pdfLibPageHeight)
      - width_points = (width / pageWidth) * pdfLibPageWidth
      - height_points = (height / pageHeight) * pdfLibPageHeight
    */

    const xPoints = (placeholder.x / placeholder.pageWidth) * pdfLibPageWidth;
    const yPoints = pdfLibPageHeight - (placeholder.y / placeholder.pageHeight) * pdfLibPageHeight;
    const widthPoints = (placeholder.width / placeholder.pageWidth) * pdfLibPageWidth;
    const heightPoints = (placeholder.height / placeholder.pageHeight) * pdfLibPageHeight;

    page.drawRectangle({
      x: xPoints,
      y: yPoints - heightPoints, // Adjust for height since y is at baseline
      width: widthPoints,
      height: heightPoints,
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 2,
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();

  return Buffer.from(modifiedPdfBytes);
};

const extractRecipientPlaceholder = (
  placeholder: string,
): { email: string; recipientIndex: number } => {
  const indexMatch = placeholder.match(/^r(\d+)$/i);

  if (!indexMatch) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid recipient placeholder format: ${placeholder}. Expected format: r1, r2, r3, etc.`,
    });
  }

  return {
    email: `recipient.${indexMatch[1]}@documenso.com`,
    recipientIndex: Number(indexMatch[1]),
  };
};

/*
  Parse field type string to FieldType enum.
  Normalizes the input (uppercase, trim) and validates it's a valid field type.
  This ensures we handle case variations and whitespace, and provides clear error messages.
*/
const parseFieldType = (fieldTypeString: string): FieldType => {
  const normalizedType = fieldTypeString.toUpperCase().trim();

  return match(normalizedType)
    .with('SIGNATURE', () => FieldType.SIGNATURE)
    .with('FREE_SIGNATURE', () => FieldType.FREE_SIGNATURE)
    .with('INITIALS', () => FieldType.INITIALS)
    .with('NAME', () => FieldType.NAME)
    .with('EMAIL', () => FieldType.EMAIL)
    .with('DATE', () => FieldType.DATE)
    .with('TEXT', () => FieldType.TEXT)
    .with('NUMBER', () => FieldType.NUMBER)
    .with('RADIO', () => FieldType.RADIO)
    .with('CHECKBOX', () => FieldType.CHECKBOX)
    .with('DROPDOWN', () => FieldType.DROPDOWN)
    .otherwise(() => {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Invalid field type: ${fieldTypeString}`,
      });
    });
};

export const insertFieldsFromPlaceholdersInPDF = async (
  pdf: Buffer,
  userId: number,
  teamId: number,
  envelopeId: EnvelopeIdOptions,
  requestMetadata: ApiRequestMetadata,
): Promise<Buffer> => {
  const placeholders = await extractPlaceholdersFromPDF(pdf);

  if (placeholders.length === 0) {
    return pdf;
  }

  /*
    A structure that maps the recipient email to the recipient index.
    Example: 'recipient.1@documenso.com' => 1
  */
  const recipientEmailToIndex = new Map<string, number>();

  for (const placeholder of placeholders) {
    const { email, recipientIndex } = extractRecipientPlaceholder(placeholder.recipient);

    recipientEmailToIndex.set(email, recipientIndex);
  }

  /*
    Create a list of recipients to create.
    Example: [{ email: 'recipient.1@documenso.com', name: 'Recipient 1', role: 'SIGNER', signingOrder: 1 }]
  */
  const recipientsToCreate = Array.from(
    recipientEmailToIndex.entries(),
    ([email, recipientIndex]) => {
      const placeholderInfo = generateRecipientPlaceholder(recipientIndex);

      return {
        email,
        name: placeholderInfo.name,
        role: RecipientRole.SIGNER,
        signingOrder: recipientIndex,
      };
    },
  );

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: envelopeId,
    userId,
    teamId,
    type: null,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      id: true,
      type: true,
      secondaryId: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  let createdRecipients: Pick<Recipient, 'id' | 'email'>[];

  if (envelope.type === EnvelopeType.DOCUMENT) {
    const { recipients } = await createDocumentRecipients({
      userId,
      teamId,
      id: envelopeId,
      recipients: recipientsToCreate,
      requestMetadata,
    });

    createdRecipients = recipients;
  } else {
    const templateId =
      envelopeId.type === 'templateId'
        ? envelopeId.id
        : mapSecondaryIdToTemplateId(envelope.secondaryId);

    const { recipients } = await createTemplateRecipients({
      userId,
      teamId,
      templateId,
      recipients: recipientsToCreate,
    });

    createdRecipients = recipients;
  }

  const fieldsToCreate: FieldToCreate[] = [];

  for (const placeholder of placeholders) {
    /*
      Convert PDF2JSON coordinates to percentage-based coordinates (0-100)
      The UI expects positionX and positionY as percentages, not absolute points
      PDF2JSON uses relative coordinates: x/pageWidth and y/pageHeight give us the percentage
    */
    const xPercent = (placeholder.x / placeholder.pageWidth) * 100;
    const yPercent = (placeholder.y / placeholder.pageHeight) * 100;

    const widthPercent = (placeholder.width / placeholder.pageWidth) * 100;
    const heightPercent = (placeholder.height / placeholder.pageHeight) * 100;

    const fieldType = parseFieldType(placeholder.fieldType);

    const { email } = extractRecipientPlaceholder(placeholder.recipient);
    const normalizedEmail = email.toLowerCase();
    const recipient = createdRecipients.find((r) => r.email.toLowerCase() === normalizedEmail);

    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Could not find recipient ID for placeholder: ${placeholder.placeholder}`,
      });
    }

    const recipientId = recipient.id;

    // Default height percentage if too small (use 2% as a reasonable default)
    const finalHeightPercent = heightPercent > 0.01 ? heightPercent : 2;

    const baseField = {
      recipientId,
      pageNumber: placeholder.page,
      pageX: xPercent,
      pageY: yPercent,
      width: widthPercent,
      height: finalHeightPercent,
    };

    fieldsToCreate.push({
      type: fieldType,
      fieldMeta: undefined,
      ...baseField,
    });
  }

  await createEnvelopeFields({
    userId,
    teamId,
    id: envelopeId,
    fields: fieldsToCreate,
    requestMetadata,
  });

  return pdf;
};
