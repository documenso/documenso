import { generateObject } from 'ai';
import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Canvas, Image } from 'skia-canvas';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resizeAndCompressImage } from '@documenso/lib/server-only/image/resize-and-compress-image';
import { renderPdfToImage } from '@documenso/lib/server-only/pdf/render-pdf-to-image';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { env } from '@documenso/lib/utils/env';
import { resolveRecipientEmail } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../router';
import { ANALYZE_RECIPIENTS_PROMPT, DETECT_OBJECTS_PROMPT } from './prompts';
import {
  type TAnalyzeRecipientsResponse,
  type TDetectFormFieldsResponse,
  type TDetectedRecipient,
  ZAnalyzeRecipientsRequestSchema,
  ZDetectFormFieldsRequestSchema,
  ZDetectedFormFieldSchema,
  ZDetectedRecipientLLMSchema,
} from './types';

type FieldDetectionRecipient = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  signingOrder: number | null;
};

const buildFieldDetectionPrompt = (recipients: FieldDetectionRecipient[]) => {
  if (recipients.length === 0) {
    return DETECT_OBJECTS_PROMPT;
  }

  const directory = recipients
    .map((recipient, index) => {
      const name = recipient.name?.trim() || `Recipient ${index + 1}`;
      const details = [`name: "${name}"`, `role: ${recipient.role}`];

      if (recipient.email) {
        details.push(`email: ${recipient.email}`);
      }

      if (typeof recipient.signingOrder === 'number') {
        details.push(`signingOrder: ${recipient.signingOrder}`);
      }

      return `ID ${recipient.id} → ${details.join(', ')}`;
    })
    .join('\n');

  return `${DETECT_OBJECTS_PROMPT}\n\nRECIPIENT DIRECTORY:\n${directory}\n\nRECIPIENT ASSIGNMENT RULES:\n1. Every detected field MUST include a "recipientId" taken from the directory above.\n2. Match printed names, role labels ("Buyer", "Seller"), or instructions near the field to the closest recipient.\n3. When the document references numbered signers (Signer 1, Signer 2, etc.), align them with signingOrder when provided.\n4. If a name exactly matches a recipient, always use that recipient's ID.\n5. When context is ambiguous, distribute fields logically across recipients instead of assigning all fields to one person.\n6. Never invent new recipients or IDs—only use those in the directory.`;
};

const runFormFieldDetection = async (
  imageBuffer: Buffer,
  pageNumber: number,
  recipients: FieldDetectionRecipient[],
): Promise<TDetectFormFieldsResponse> => {
  const compressedImageBuffer = await resizeAndCompressImage(imageBuffer);
  const base64Image = compressedImageBuffer.toString('base64');
  const prompt = buildFieldDetectionPrompt(recipients);

  const result = await generateObject({
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
  });

  const recipientIds = new Set(recipients.map((recipient) => recipient.id));
  const fallbackRecipientId = recipients[0]?.id;

  if (fallbackRecipientId === undefined) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Unable to assign recipients because no recipients were provided',
      userMessage: 'Please add at least one recipient before detecting form fields.',
    });
  }

  return result.object.map((field) => {
    let recipientId = field.recipientId;

    if (!recipientIds.has(recipientId)) {
      console.warn(
        'AI returned invalid recipientId for detected field, defaulting to first recipient',
        {
          field,
          fallbackRecipientId,
        },
      );

      recipientId = fallbackRecipientId;
    }

    return {
      ...field,
      recipientId,
      pageNumber,
    };
  });
};

// Limit recipient detection to first 3 pages for performance and cost efficiency
const MAX_PAGES_FOR_RECIPIENT_ANALYSIS = 3;

const authorizeDocumentAccess = async (envelopeId: string, userId: number) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  if (!envelope || !envelope.envelopeItems || envelope.envelopeItems.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope not found: ${envelopeId}`,
      userMessage: 'The requested document does not exist.',
    });
  }

  const isDirectOwner = envelope.userId === userId;

  let hasTeamAccess = false;
  if (envelope.teamId) {
    try {
      await getTeamById({ teamId: envelope.teamId, userId });
      hasTeamAccess = true;
    } catch {
      hasTeamAccess = false;
    }
  }

  if (!isDirectOwner && !hasTeamAccess) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: `User ${userId} does not have access to envelope ${envelopeId}`,
      userMessage: 'You do not have permission to access this document.',
    });
  }

  // Return the first document data from the envelope
  const documentData = envelope.envelopeItems[0]?.documentData;

  if (!documentData) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Document data not found in envelope: ${envelopeId}`,
      userMessage: 'The requested document does not exist.',
    });
  }

  return documentData;
};

export const aiRoute = new Hono<HonoEnv>()
  .post('/detect-fields', async (c) => {
    try {
      const { user } = await getSession(c.req.raw);

      const body = await c.req.json();
      const parsed = ZDetectFormFieldsRequestSchema.safeParse(body);

      if (!parsed.success) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope ID is required',
          userMessage: 'Please provide a valid envelope ID.',
        });
      }

      const { envelopeId } = parsed.data;

      // Use shared authorization function
      const documentData = await authorizeDocumentAccess(envelopeId, user.id);

      const envelopeRecipients = await prisma.recipient.findMany({
        where: { envelopeId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          signingOrder: true,
        },
      });

      if (envelopeRecipients.length === 0) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: `No recipients found for envelope ${envelopeId}`,
          userMessage: 'Please add at least one recipient before detecting form fields.',
        });
      }

      const rolePriority: Record<string, number> = {
        SIGNER: 0,
        APPROVER: 1,
        CC: 2,
      };

      const detectionRecipients: FieldDetectionRecipient[] = envelopeRecipients
        .slice()
        .sort((a, b) => {
          const roleDiff = (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3);
          if (roleDiff !== 0) {
            return roleDiff;
          }

          const aOrder =
            typeof a.signingOrder === 'number' ? a.signingOrder : Number.MAX_SAFE_INTEGER;
          const bOrder =
            typeof b.signingOrder === 'number' ? b.signingOrder : Number.MAX_SAFE_INTEGER;

          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }

          return a.id - b.id;
        })
        .map((recipient) => ({
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
        }));

      const pdfBytes = await getFileServerSide({
        type: documentData.type,
        data: documentData.initialData || documentData.data,
      });

      const renderedPages = await renderPdfToImage(pdfBytes);

      const results = await Promise.allSettled(
        renderedPages.map(async (page) => {
          return await runFormFieldDetection(page.image, page.pageNumber, detectionRecipients);
        }),
      );

      const detectedFields: TDetectFormFieldsResponse = [];
      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          detectedFields.push(...result.value);
        } else {
          const pageNumber = renderedPages[index]?.pageNumber ?? index + 1;
          console.error(`Failed to detect fields on page ${pageNumber}:`, result.reason);
        }
      }

      if (env('NEXT_PUBLIC_AI_DEBUG_PREVIEW') === 'true') {
        const debugDir = join(process.cwd(), '..', '..', 'packages', 'assets', 'ai-previews');
        await mkdir(debugDir, { recursive: true });

        const now = new Date();
        const timestamp = now
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\..+/, '')
          .replace('T', '_');

        for (const page of renderedPages) {
          const padding = { left: 80, top: 20, right: 20, bottom: 40 };
          const canvas = new Canvas(
            page.width + padding.left + padding.right,
            page.height + padding.top + padding.bottom,
          );
          const ctx = canvas.getContext('2d');

          const img = new Image();
          img.src = page.image;
          ctx.drawImage(img, padding.left, padding.top);

          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.lineWidth = 1;

          for (let i = 0; i <= 1000; i += 100) {
            const x = padding.left + (i / 1000) * page.width;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, page.height + padding.top);
            ctx.stroke();
          }

          for (let i = 0; i <= 1000; i += 100) {
            const y = padding.top + (i / 1000) * page.height;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(page.width + padding.left, y);
            ctx.stroke();
          }

          const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

          const pageFields = detectedFields.filter((f) => f.pageNumber === page.pageNumber);
          pageFields.forEach((field, index) => {
            const [ymin, xmin, ymax, xmax] = field.boundingBox.map((coord) => coord / 1000);

            const x = xmin * page.width + padding.left;
            const y = ymin * page.height + padding.top;
            const width = (xmax - xmin) * page.width;
            const height = (ymax - ymin) * page.height;

            ctx.strokeStyle = colors[index % colors.length];
            ctx.lineWidth = 5;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = colors[index % colors.length];
            ctx.font = '20px Arial';
            ctx.fillText(field.label, x, y - 5);
          });

          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.font = '26px Arial';

          ctx.beginPath();
          ctx.moveTo(padding.left, padding.top);
          ctx.lineTo(padding.left, page.height + padding.top);
          ctx.stroke();

          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          for (let i = 0; i <= 1000; i += 100) {
            const y = padding.top + (i / 1000) * page.height;
            ctx.fillStyle = '#000000';
            ctx.fillText(i.toString(), padding.left - 5, y);

            ctx.beginPath();
            ctx.moveTo(padding.left - 5, y);
            ctx.lineTo(padding.left, y);
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.moveTo(padding.left, page.height + padding.top);
          ctx.lineTo(page.width + padding.left, page.height + padding.top);
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          for (let i = 0; i <= 1000; i += 100) {
            const x = padding.left + (i / 1000) * page.width;
            ctx.fillStyle = '#000000';
            ctx.fillText(i.toString(), x, page.height + padding.top + 5);

            ctx.beginPath();
            ctx.moveTo(x, page.height + padding.top);
            ctx.lineTo(x, page.height + padding.top + 5);
            ctx.stroke();
          }

          const outputFilename = `detected_form_fields_${timestamp}_page_${page.pageNumber}.png`;
          const outputPath = join(debugDir, outputFilename);

          const pngBuffer = await canvas.toBuffer('png');
          await writeFile(outputPath, new Uint8Array(pngBuffer));
        }
      }

      return c.json<TDetectFormFieldsResponse>(detectedFields);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error('Failed to detect form fields from PDF:', error);

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: `Failed to detect form fields from PDF: ${error instanceof Error ? error.message : String(error)}`,
        userMessage: 'An error occurred while detecting form fields. Please try again.',
      });
    }
  })
  .post('/detect-recipients', async (c) => {
    try {
      const { user } = await getSession(c.req.raw);

      const body = await c.req.json();
      const parsed = ZAnalyzeRecipientsRequestSchema.safeParse(body);

      if (!parsed.success) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope ID is required',
          userMessage: 'Please provide a valid envelope ID.',
        });
      }

      const { envelopeId } = parsed.data;

      // Use shared authorization function
      const documentData = await authorizeDocumentAccess(envelopeId, user.id);

      const pdfBytes = await getFileServerSide({
        type: documentData.type,
        data: documentData.initialData || documentData.data,
      });

      const renderedPages = await renderPdfToImage(pdfBytes);

      // Only analyze first few pages for performance
      const pagesToAnalyze = renderedPages.slice(0, MAX_PAGES_FOR_RECIPIENT_ANALYSIS);

      const results = await Promise.allSettled(
        pagesToAnalyze.map(async (page) => {
          const compressedImageBuffer = await resizeAndCompressImage(page.image);
          const base64Image = compressedImageBuffer.toString('base64');

          const result = await generateObject({
            model: 'anthropic/claude-haiku-4.5',
            output: 'array',
            schema: ZDetectedRecipientLLMSchema,
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
                    text: ANALYZE_RECIPIENTS_PROMPT,
                  },
                ],
              },
            ],
          });

          console.info('AI analyze recipients raw response', {
            envelopeId,
            pageNumber: page.pageNumber,
            recipients: result.object,
          });

          return {
            pageNumber: page.pageNumber,
            recipients: result.object,
          };
        }),
      );

      const allRecipients: TDetectedRecipient[] = [];
      let recipientIndex = 1;

      for (const result of results) {
        if (result.status !== 'fulfilled') {
          console.error('Failed to analyze recipients on a page:', result.reason);
          continue;
        }

        const { pageNumber, recipients } = result.value;

        const recipientsWithEmails = recipients.map((recipient) => {
          const email = resolveRecipientEmail(recipient.email);

          const normalizedRecipient: TDetectedRecipient = {
            ...recipient,
            email,
          };

          recipientIndex += 1;

          return normalizedRecipient;
        });

        console.info('AI analyze recipients normalized response', {
          envelopeId,
          pageNumber,
          recipients: recipientsWithEmails,
        });

        allRecipients.push(...recipientsWithEmails);
      }

      return c.json<TAnalyzeRecipientsResponse>(allRecipients);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error('Failed to analyze recipients from PDF:', error);

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: `Failed to analyze recipients from PDF: ${error instanceof Error ? error.message : String(error)}`,
        userMessage: 'An error occurred while analyzing recipients. Please try again.',
      });
    }
  });
