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
import { type TFieldAndMeta, ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { EnvelopeIdOptions } from '@documenso/lib/utils/envelope';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
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

type RecipientPlaceholderInfo = {
  email: string;
  name: string;
  recipientIndex: number;
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

/*
  Transform raw field metadata from placeholder format to schema format.
  Users should provide properly capitalized property names (e.g., readOnly, fontSize, textAlign).
  Converts string values to proper types (booleans, numbers).
*/
const parseFieldMeta = (
  rawFieldMeta: Record<string, string>,
  fieldType: FieldType,
): Record<string, unknown> | undefined => {
  if (fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE) {
    return;
  }

  if (Object.keys(rawFieldMeta).length === 0) {
    return;
  }

  const fieldTypeString = String(fieldType).toLowerCase();

  const parsedFieldMeta: Record<string, boolean | number | string> = {
    type: fieldTypeString,
  };

  /*
    rawFieldMeta is an object with string keys and string values.
    It contains string values because the PDF parser returns the values as strings.

    E.g. { required: 'true', fontSize: '12', maxValue: '100', minValue: '0', characterLimit: '100' }
  */
  const rawFieldMetaEntries = Object.entries(rawFieldMeta);

  for (const entry of rawFieldMetaEntries) {
    const [key, value] = entry;

    if (key === 'readOnly' || key === 'required') {
      parsedFieldMeta[key] = value === 'true';
    } else if (
      key === 'fontSize' ||
      key === 'maxValue' ||
      key === 'minValue' ||
      key === 'characterLimit'
    ) {
      const numValue = Number(value);

      if (!Number.isNaN(numValue)) {
        parsedFieldMeta[key] = numValue;
      }
    } else {
      parsedFieldMeta[key] = value;
    }
  }

  return parsedFieldMeta;
};

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

        for (const placeholderMatch of placeholderMatches) {
          const placeholder = placeholderMatch[0];
          const placeholderData = placeholderMatch[1].split(',').map((part) => part.trim());

          const [fieldTypeString, recipient, ...fieldMetaData] = placeholderData;

          const rawFieldMeta = Object.fromEntries(fieldMetaData.map((meta) => meta.split('=')));

          const fieldType = parseFieldType(fieldTypeString);
          const parsedFieldMeta = parseFieldMeta(rawFieldMeta, fieldType);

          const fieldAndMeta: TFieldAndMeta = ZFieldAndMetaSchema.parse({
            type: fieldType,
            fieldMeta: parsedFieldMeta,
          });

          /*
            Find the position of where the placeholder starts in the text

            Then find the position of where the placeholder ends in the text by adding the length of the placeholder to the index of the placeholder.
          */
          const matchIndex = placeholderMatch.index;

          if (matchIndex === undefined) {
            continue;
          }

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
            recipient,
            fieldAndMeta,
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

const extractRecipientPlaceholder = (placeholder: string): RecipientPlaceholderInfo => {
  const indexMatch = placeholder.match(/^r(\d+)$/i);

  if (!indexMatch) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid recipient placeholder format: ${placeholder}. Expected format: r1, r2, r3, etc.`,
    });
  }

  const recipientIndex = Number(indexMatch[1]);

  return {
    email: `recipient.${recipientIndex}@documenso.com`,
    name: `Recipient ${recipientIndex}`,
    recipientIndex,
  };
};

export const insertFieldsFromPlaceholdersInPDF = async (
  pdf: Buffer,
  userId: number,
  teamId: number,
  envelopeId: EnvelopeIdOptions,
  requestMetadata: ApiRequestMetadata,
  envelopeItemId?: string,
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

  /*
    Create a list of recipients to create.
    Example: [{ email: 'recipient.1@documenso.com', name: 'Recipient 1', role: 'SIGNER', signingOrder: 1 }]
  */
  const recipientsToCreate = Array.from(
    recipientPlaceholders.entries(),
    ([recipientIndex, name]) => {
      return {
        email: `recipient.${recipientIndex}@documenso.com`,
        name,
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

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      envelopeId: envelope.id,
    },
    select: {
      id: true,
      email: true,
    },
  });

  const existingEmails = new Set(existingRecipients.map((r) => r.email.toLowerCase()));
  const recipientsToCreateFiltered = recipientsToCreate.filter(
    (r) => !existingEmails.has(r.email.toLowerCase()),
  );

  let createdRecipients: Pick<Recipient, 'id' | 'email'>[] = existingRecipients;

  if (recipientsToCreateFiltered.length > 0) {
    if (envelope.type === EnvelopeType.DOCUMENT) {
      const { recipients } = await createDocumentRecipients({
        userId,
        teamId,
        id: envelopeId,
        recipients: recipientsToCreateFiltered,
        requestMetadata,
      });

      createdRecipients = [...existingRecipients, ...recipients];
    } else if (envelope.type === EnvelopeType.TEMPLATE) {
      const templateId =
        envelopeId.type === 'templateId'
          ? envelopeId.id
          : mapSecondaryIdToTemplateId(envelope.secondaryId);

      const { recipients } = await createTemplateRecipients({
        userId,
        teamId,
        templateId,
        recipients: recipientsToCreateFiltered,
      });

      createdRecipients = [...existingRecipients, ...recipients];
    } else {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Invalid envelope type: ${envelope.type}`,
      });
    }
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
