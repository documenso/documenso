import { generateObject } from 'ai';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resizeAndCompressImage } from '@documenso/lib/server-only/image/resize-and-compress-image';

import { DETECT_OBJECTS_PROMPT } from './prompts';
import type { TDetectFormFieldsResponse } from './types';
import { ZDetectedFormFieldSchema } from './types';
import { buildRecipientDirectory, safeGenerateObject, validateRecipientId } from './utils';

export type FieldDetectionRecipient = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  signingOrder: number | null;
};

/**
 * Build the field detection prompt with optional recipient context.
 */
function buildFieldDetectionPrompt(recipients: FieldDetectionRecipient[]): string {
  if (recipients.length === 0) {
    return DETECT_OBJECTS_PROMPT;
  }

  const directory = buildRecipientDirectory(recipients);

  return `${DETECT_OBJECTS_PROMPT}

RECIPIENT DIRECTORY:
${directory}

RECIPIENT ASSIGNMENT RULES:
1. Every detected field MUST include a "recipientId" taken from the directory above.
2. Match printed names, role labels ("Buyer", "Seller"), or instructions near the field to the closest recipient.
3. When the document references numbered signers (Signer 1, Signer 2, etc.), align them with signingOrder when provided.
4. If a name exactly matches a recipient, always use that recipient's ID.
5. When context is ambiguous, distribute fields logically across recipients instead of assigning all fields to one person.
6. Never invent new recipients or IDs—only use those in the directory.`;
}

/**
 * Run form field detection on a single page image.
 */
export async function runFormFieldDetection(
  imageBuffer: Buffer,
  pageNumber: number,
  recipients: FieldDetectionRecipient[],
): Promise<TDetectFormFieldsResponse> {
  const compressedImageBuffer = await resizeAndCompressImage(imageBuffer);
  const base64Image = compressedImageBuffer.toString('base64');
  const prompt = buildFieldDetectionPrompt(recipients);

  const detectedFields = await safeGenerateObject(
    async () =>
      generateObject({
        model: 'google/gemini-3-pro-preview',
        output: 'array',
        schema: ZDetectedFormFieldSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: `data:image/jpeg;base64,${base64Image}`,
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    {
      operation: 'detect form fields',
      pageNumber,
    },
  );

  return validateAndEnrichFields(detectedFields, recipients, pageNumber);
}

/**
 * Validate recipient IDs and add page numbers to detected fields.
 */
function validateAndEnrichFields(
  detectedFields: Array<Omit<TDetectFormFieldsResponse[0], 'pageNumber'>>,
  recipients: FieldDetectionRecipient[],
  pageNumber: number,
): TDetectFormFieldsResponse {
  const recipientIds = new Set(recipients.map((r) => r.id));
  const fallbackRecipientId = recipients[0]?.id;

  if (fallbackRecipientId === undefined) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Unable to assign recipients because no recipients were provided',
      userMessage: 'Please add at least one recipient before detecting form fields.',
    });
  }

  return detectedFields.map((field) => {
    const validatedRecipientId = validateRecipientId(
      field.recipientId,
      recipientIds,
      fallbackRecipientId,
      { fieldLabel: field.label },
    );

    return {
      ...field,
      recipientId: validatedRecipientId,
      pageNumber,
    };
  });
}
