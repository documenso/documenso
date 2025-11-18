// sort-imports-ignore

// ---- PATCH pdfjs-dist's canvas require BEFORE importing it ----
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Canvas, Image } from 'skia-canvas';

const require = createRequire(import.meta.url || fileURLToPath(new URL('.', import.meta.url)));
const Module = require('node:module');

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'canvas') {
    return {
      createCanvas: (width: number, height: number) => new Canvas(width, height),
      Image, // needed by pdfjs-dist
    };
  }
  // eslint-disable-next-line prefer-rest-params, @typescript-eslint/consistent-type-assertions
  return originalRequire.apply(this, arguments as unknown as [string]);
};

// Use dynamic require to bypass Vite SSR transformation
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';
import { generateObject } from 'ai';
import { Hono } from 'hono';
import sharp from 'sharp';
import { z } from 'zod';

import type { HonoEnv } from '../router';
import {
  type TAnalyzeRecipientsResponse,
  type TDetectedRecipient,
  type TDetectFormFieldsResponse,
  ZAnalyzeRecipientsRequestSchema,
  ZDetectedRecipientLLMSchema,
  ZDetectedFormFieldSchema,
  ZDetectFormFieldsRequestSchema,
} from './ai.types';

const renderPdfToImage = async (pdfBytes: Uint8Array) => {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  try {
    const scale = 4;

    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const pageNumber = index + 1;
        const page = await pdf.getPage(pageNumber);

        try {
          const viewport = page.getViewport({ scale });

          const virtualCanvas = new Canvas(viewport.width, viewport.height);
          const context = virtualCanvas.getContext('2d');
          context.imageSmoothingEnabled = false;

          await page.render({ canvasContext: context, viewport }).promise;

          return {
            image: await virtualCanvas.toBuffer('png'),
            pageNumber,
            width: Math.floor(viewport.width),
            height: Math.floor(viewport.height),
          };
        } finally {
          page.cleanup();
        }
      }),
    );

    return pages;
  } finally {
    await pdf.destroy();
  }
};

const resizeAndCompressImage = async (imageBuffer: Buffer): Promise<Buffer> => {
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;

  if (originalWidth > 1000) {
    return await sharp(imageBuffer)
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  return await sharp(imageBuffer).jpeg({ quality: 70 }).toBuffer();
};

const detectObjectsPrompt = `You are analyzing a form document image to detect fillable fields for the Documenso document signing platform.

IMPORTANT RULES:
1. Only detect EMPTY/UNFILLED fields (ignore boxes that already contain text or data)
2. Analyze nearby text labels to determine the field type
3. Return bounding boxes for the fillable area only, NOT the label text
4. Each boundingBox must be in the format [ymin, xmin, ymax, xmax] where all coordinates are NORMALIZED to a 0-1000 scale

CRITICAL: UNDERSTANDING FILLABLE AREAS
The "fillable area" is ONLY the empty space where a user will write, type, sign, or check.
- ✓ CORRECT: The blank underscore where someone writes their name: "Name: _________" → box ONLY the underscores
- ✓ CORRECT: The empty white rectangle inside a box outline → box ONLY the empty space, not any printed text
- ✓ CORRECT: The blank space to the right of a label: "Email: [ empty box ]" → box ONLY the empty box, exclude "Email:"
- ✗ INCORRECT: Including the word "Signature:" that appears to the left of a signature line
- ✗ INCORRECT: Including printed labels, instructions, or descriptive text near the field
- ✗ INCORRECT: Extending the box to include text just because it's close to the fillable area

VISUALIZING THE DISTINCTION:
- If there's text (printed words/labels) near an empty box or line, they are SEPARATE elements
- The text is a LABEL telling the user what to fill
- The empty space is the FILLABLE AREA where they actually write/sign
- Your bounding box should capture ONLY the empty space, even if the label is immediately adjacent

FIELD TYPES TO DETECT:
• SIGNATURE - Signature lines, boxes labeled 'Signature', 'Sign here', 'Authorized signature', 'X____'
• INITIALS - Small boxes labeled 'Initials', 'Initial here', typically smaller than signature fields
• NAME - Boxes labeled 'Name', 'Full name', 'Your name', 'Print name', 'Printed name'
• EMAIL - Boxes labeled 'Email', 'Email address', 'E-mail', 'Email:'
• DATE - Boxes labeled 'Date', 'Date signed', "Today's date", or showing date format placeholders like 'MM/DD/YYYY', '__/__/____'
• CHECKBOX - Empty checkbox squares (☐) with or without labels, typically small square boxes
• RADIO - Empty radio button circles (○) in groups, typically circular selection options
• NUMBER - Boxes labeled with numeric context: 'Amount', 'Quantity', 'Phone', 'Phone number', 'ZIP', 'ZIP code', 'Age', 'Price', '#'
• DROPDOWN - Boxes with dropdown indicators (▼, ↓) or labeled 'Select', 'Choose', 'Please select'
• TEXT - Any other empty text input boxes, general input fields, unlabeled boxes, or when field type is uncertain

DETECTION GUIDELINES:
- Read text located near the box (above, to the left, or inside the box boundary) to infer the field type
- IMPORTANT: Use the nearby text to CLASSIFY the field type, but DO NOT include that text in the bounding box
- If you're uncertain which type fits best, default to TEXT
- For checkboxes and radio buttons: Detect each individual box/circle separately, not the label
- Signature fields are often longer horizontal lines or larger boxes
- Date fields often show format hints or date separators (slashes, dashes)
- Look for visual patterns: underscores (____), horizontal lines, box outlines

BOUNDING BOX PLACEMENT (CRITICAL):
- Your coordinates must capture ONLY the empty fillable space (the blank area where input goes)
- Once you find the fillable region, LOCK the box to the full boundary of that region (top, bottom, left, right). Do not leave the box floating over just the starting edge.
- If the field is defined by a line or a rectangular border, extend xmin/xmax/ymin/ymax across the entire line/border so the box spans the whole writable area end-to-end.
- EXCLUDE all printed text labels, even if they are:
  · Directly to the left of the field (e.g., "Name: _____")
  · Directly above the field (e.g., "Signature" printed above a line)
  · Very close to the field with minimal spacing
  · Inside the same outlined box as the fillable area
- The label text helps you IDENTIFY the field type, but must be EXCLUDED from the bounding box
- If you detect a label "Email:" followed by a blank box, draw the box around ONLY the blank box, not the word "Email:"
- The box should never cover only the leftmost few characters of a long field. For "Signature: ____________", the box must stretch from the first underscore to the last.

COORDINATE SYSTEM:
- [ymin, xmin, ymax, xmax] normalized to 0-1000 scale
- Top-left corner: ymin and xmin close to 0
- Bottom-right corner: ymax and xmax close to 1000
- Coordinates represent positions on a 1000x1000 grid overlaid on the image

FIELD SIZING STRATEGY FOR LINE-BASED FIELDS:
When detecting thin horizontal lines for SIGNATURE, INITIALS, NAME, EMAIL, DATE, TEXT, or NUMBER fields:
1. Analyze the visual context around the detected line:
   - Look at the empty space ABOVE the detected line
   - Observe the spacing to any text labels, headers, or other form elements above
   - Assess what would be a reasonable field height to make the field clearly visible when filled
2. Expand UPWARD from the detected line to create a usable field:
   - Keep ymax (bottom) at the detected line position (the line becomes the bottom edge)
   - Extend ymin (top) upward into the available whitespace
   - Aim to use 60-80% of the clear whitespace above the line, while being reasonable
   - The expanded field should provide comfortable space for signing/writing (minimum 30 units tall)
3. Apply minimum dimensions: height at least 30 units (3% of 1000-scale), width at least 36 units
4. Ensure ymin >= 0 (do not go off-page). If ymin would be negative, clamp to 0
5. Do NOT apply this expansion to CHECKBOX, RADIO, or DROPDOWN fields - use detected dimensions for those
6. Example: If you detect a signature line at ymax=500 with clear whitespace extending up to y=400:
   - Available whitespace: 100 units
   - Use 60-80% of that: 60-80 units
   - Expanded field: [ymin=420, xmin=200, ymax=500, xmax=600] (creates 80-unit tall field)
   - This gives comfortable signing space while respecting the form layout`;

type FieldDetectionRecipient = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  signingOrder: number | null;
};

const buildFieldDetectionPrompt = (recipients: FieldDetectionRecipient[]) => {
  if (recipients.length === 0) {
    return detectObjectsPrompt;
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

  return `${detectObjectsPrompt}\n\nRECIPIENT DIRECTORY:\n${directory}\n\nRECIPIENT ASSIGNMENT RULES:\n1. Every detected field MUST include a "recipientId" taken from the directory above.\n2. Match printed names, role labels ("Buyer", "Seller"), or instructions near the field to the closest recipient.\n3. When the document references numbered signers (Signer 1, Signer 2, etc.), align them with signingOrder when provided.\n4. If a name exactly matches a recipient, always use that recipient's ID.\n5. When context is ambiguous, distribute fields logically across recipients instead of assigning all fields to one person.\n6. Never invent new recipients or IDs—only use those in the directory.`;
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

const MAX_PAGES_FOR_RECIPIENT_ANALYSIS = 3;

const recipientEmailSchema = z.string().email();

const resolveRecipientEmail = (candidateEmail: string | undefined) => {
  if (candidateEmail) {
    const trimmedEmail = candidateEmail.trim();

    if (recipientEmailSchema.safeParse(trimmedEmail).success) {
      return trimmedEmail;
    }
  }

  return undefined;
};

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

const analyzeRecipientsPrompt = `You are analyzing a document to identify recipients who need to sign, approve, or receive copies.

TASK: Extract recipient information from this document.

RECIPIENT TYPES:
- SIGNER: People who must sign the document (look for signature lines, "Signed by:", "Signature:", "X____")
- APPROVER: People who must review/approve before signing (look for "Approved by:", "Reviewed by:", "Approval:")
- CC: People who receive a copy for information only (look for "CC:", "Copy to:", "For information:")

EXTRACTION RULES:
1. Look for signature lines with names printed above, below, or near them
2. Check for explicit labels like "Name:", "Signer:", "Party:", "Recipient:"
3. Look for "Approved by:", "Reviewed by:", "CC:" sections
4. Extract FULL NAMES as they appear in the document
5. If an email address is visible near a name, include it exactly in the "email" field
6. If NO email is found, leave the email field empty.
7. Assign signing order based on document flow (numbered items, "First signer:", "Second signer:", or top-to-bottom sequence)

IMPORTANT:
- Only extract recipients explicitly mentioned in the document
- Default role is SIGNER if unclear (signature lines = SIGNER)
- Signing order starts at 1 (first signer = 1, second = 2, etc.)
- If no clear ordering, omit signingOrder
- Return empty array if absolutely no recipients can be detected
- Do NOT invent recipients - only extract what's clearly present

EXAMPLES:
Good:
  - "Signed: _________ John Doe" → { name: "John Doe", role: "SIGNER", signingOrder: 1 }
  - "Approved by: Jane Smith (jane@example.com)" → { name: "Jane Smith", email: "jane@example.com", role: "APPROVER" }
  - "CC: Legal Team" → { name: "Legal Team", role: "CC" }

Bad:
  - Extracting the document title as a recipient name
  - Making up email addresses that aren't in the document
  - Adding people not mentioned in the document`;

export const aiRoute = new Hono<HonoEnv>()
  .post('/detect-form-fields', async (c) => {
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
  .post('/analyze-recipients', async (c) => {
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
                    text: analyzeRecipientsPrompt,
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
