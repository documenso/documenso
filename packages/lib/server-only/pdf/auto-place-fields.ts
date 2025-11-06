import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import type { Recipient } from '@prisma/client';
import PDFParser from 'pdf2json';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { createEnvelopeFields } from '@documenso/lib/server-only/field/create-envelope-fields';
import { type TFieldAndMeta, ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { EnvelopeIdOptions } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { getPageSize } from './get-page-size';
import {
  createRecipientsFromPlaceholders,
  extractRecipientPlaceholder,
  parseFieldMetaFromPlaceholder,
  parseFieldTypeFromPlaceholder,
} from './helpers';

type TextPosition = {
  text: string;
  x: number;
  y: number;
  w: number;
};

type CharIndexMapping = {
  textPositionIndex: number;
};

type PlaceholderInfo = {
  placeholder: string;
  recipient: string;
  fieldAndMeta: TFieldAndMeta;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

type FieldToCreate = TFieldAndMeta & {
  envelopeItemId?: string;
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
    - The placeholder data is dynamic. How to handle this parsing? Perhaps we need to do it similar to the fieldMeta parsing. ✅
    - Need to handle envelopes with multiple items. ✅
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
        let pageText = '';
        const textPositions: TextPosition[] = [];
        const charIndexMappings: CharIndexMapping[] = [];

        page.Texts.forEach((text) => {
          /*
            R is an array of objects containing each character, its position and styling information.
            The decodedText stores the characters, without any other information.

            textPositions stores each character and its position on the page.
          */
          const decodedText = text.R.map((run) => decodeURIComponent(run.T)).join('');

          /*
            For each character in the decodedText, we store its position in the textPositions array.
            This allows us to quickly find the position of a character in the textPositions array by its index.
          */
          for (let i = 0; i < decodedText.length; i++) {
            charIndexMappings.push({
              textPositionIndex: textPositions.length,
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

        /*
          A placeholder match has the following format:

          [
            '{{fieldType,recipient,fieldMeta}}',
            'fieldType,recipient,fieldMeta',
            'index: <number>',
            'input: <pdf-text>'
          ]
        */
        for (const placeholderMatch of placeholderMatches) {
          const placeholder = placeholderMatch[0];
          const placeholderData = placeholderMatch[1].split(',').map((property) => property.trim());

          const [fieldTypeString, recipient, ...fieldMetaData] = placeholderData;

          const rawFieldMeta = Object.fromEntries(
            fieldMetaData.map((property) => property.split('=')),
          );

          const fieldType = parseFieldTypeFromPlaceholder(fieldTypeString);
          const parsedFieldMeta = parseFieldMetaFromPlaceholder(rawFieldMeta, fieldType);

          const fieldAndMeta: TFieldAndMeta = ZFieldAndMetaSchema.parse({
            type: fieldType,
            fieldMeta: parsedFieldMeta,
          });

          /*
            Find the position of where the placeholder starts and ends in the text.

            Then find the position of the characters in the textPositions array.
            This allows us to quickly find the position of a character in the textPositions array by its index.
          */
          if (placeholderMatch.index === undefined) {
            console.error('Placeholder match index is undefined for placeholder', placeholder);

            continue;
          }

          const placeholderEndCharIndex = placeholderMatch.index + placeholder.length;

          /*
            Get the index of the placeholder's first and last character in the textPositions array.
            Used to retrieve the character information from the textPositions array.

            Example:
              startTextPosIndex - 1
              endTextPosIndex - 40
          */
          const startTextPosIndex = charIndexMappings[placeholderMatch.index].textPositionIndex;
          const endTextPosIndex = charIndexMappings[placeholderEndCharIndex - 1].textPositionIndex;

          /*
            Get the placeholder's first and last character information from the textPositions array.

            Example:
              placeholderStart = { text: '{', x: 100, y: 100, w: 100 }
              placeholderEnd = { text: '}', x: 200, y: 100, w: 100 }
          */
          const placeholderStart = textPositions[startTextPosIndex];
          const placeholderEnd = textPositions[endTextPosIndex];

          const width = placeholderEnd.x + placeholderEnd.w * 0.1 - placeholderStart.x;

          placeholders.push({
            placeholder,
            recipient,
            fieldAndMeta,
            page: pageIndex + 1,
            x: placeholderStart.x,
            y: placeholderStart.y,
            width,
            height: 1,
            pageWidth: page.Width,
            pageHeight: page.Height,
          });
        }
      });

      resolve(placeholders);
    });

    parser.parseBuffer(pdf);
  });
};

export const removePlaceholdersFromPDF = async (pdf: Buffer): Promise<Buffer> => {
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

export const insertFieldsFromPlaceholdersInPDF = async (
  pdf: Buffer,
  userId: number,
  teamId: number,
  envelopeId: EnvelopeIdOptions,
  requestMetadata: ApiRequestMetadata,
  envelopeItemId?: string,
  recipients?: Pick<Recipient, 'id' | 'email'>[],
): Promise<Buffer> => {
  const placeholders = await extractPlaceholdersFromPDF(pdf);

  if (placeholders.length === 0) {
    return pdf;
  }

  /*
    A structure that maps the recipient index to the recipient name.
    Example: 1 => 'Recipient 1'
  */
  const recipientPlaceholders = new Map<number, string>();

  for (const placeholder of placeholders) {
    const { name, recipientIndex } = extractRecipientPlaceholder(placeholder.recipient);

    recipientPlaceholders.set(recipientIndex, name);
  }

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

  if (recipients && recipients.length > 0) {
    createdRecipients = recipients;
  } else {
    createdRecipients = await createRecipientsFromPlaceholders(
      recipientPlaceholders,
      envelope,
      envelopeId,
      userId,
      teamId,
      requestMetadata,
    );
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

    let recipient: Pick<Recipient, 'id' | 'email'> | undefined;

    if (recipients && recipients.length > 0) {
      /*
        Map placeholder by index: r1 -> recipients[0], r2 -> recipients[1], etc.
        recipientIndex is 1-based, so we subtract 1 to get the array index.
      */
      const { recipientIndex } = extractRecipientPlaceholder(placeholder.recipient);
      const recipientArrayIndex = recipientIndex - 1;

      if (recipientArrayIndex < 0 || recipientArrayIndex >= recipients.length) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Recipient placeholder ${placeholder.recipient} (index ${recipientIndex}) is out of range. Provided ${recipients.length} recipient(s).`,
        });
      }

      recipient = recipients[recipientArrayIndex];
    } else {
      /*
        Use email-based matching for placeholder recipients.
      */
      const { email } = extractRecipientPlaceholder(placeholder.recipient);
      recipient = createdRecipients.find((r) => r.email === email);
    }

    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Could not find recipient ID for placeholder: ${placeholder.placeholder}`,
      });
    }

    const recipientId = recipient.id;

    // Default height percentage if too small (use 2% as a reasonable default)
    const finalHeightPercent = heightPercent > 0.01 ? heightPercent : 2;

    fieldsToCreate.push({
      ...placeholder.fieldAndMeta,
      envelopeItemId,
      recipientId,
      pageNumber: placeholder.page,
      pageX: xPercent,
      pageY: yPercent,
      width: widthPercent,
      height: finalHeightPercent,
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
