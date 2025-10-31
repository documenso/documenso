import { generateObject } from 'ai';
import { mkdir, writeFile } from 'fs/promises';
import { Hono } from 'hono';
import { join } from 'path';
import sharp from 'sharp';
import { Canvas, Image } from 'skia-canvas';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { env } from '@documenso/lib/utils/env';

import type { HonoEnv } from '../router';
import {
  type TDetectFormFieldsResponse,
  ZDetectFormFieldsRequestSchema,
  ZDetectedFormFieldSchema,
} from './ai.types';

/**
 * Resize and compress image for better Gemini API accuracy.
 * Resizes to max width of 1000px (maintaining aspect ratio) and compresses to JPEG at 70% quality.
 * This preprocessing improves bounding box detection accuracy.
 */
async function resizeAndCompressImage(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;

  if (originalWidth > 1000) {
    return await sharp(imageBuffer)
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  return await sharp(imageBuffer).jpeg({ quality: 70 }).toBuffer();
}

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
- EXCLUDE all printed text labels, even if they are:
  · Directly to the left of the field (e.g., "Name: _____")
  · Directly above the field (e.g., "Signature" printed above a line)
  · Very close to the field with minimal spacing
  · Inside the same outlined box as the fillable area
- The label text helps you IDENTIFY the field type, but must be EXCLUDED from the bounding box
- If you detect a label "Email:" followed by a blank box, draw the box around ONLY the blank box, not the word "Email:"

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

const runFormFieldDetection = async (imageBuffer: Buffer): Promise<TDetectFormFieldsResponse> => {
  const compressedImageBuffer = await resizeAndCompressImage(imageBuffer);
  const base64Image = compressedImageBuffer.toString('base64');

  const result = await generateObject({
    model: 'google/gemini-2.5-pro',
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
            text: detectObjectsPrompt,
          },
        ],
      },
    ],
  });

  return result.object;
};

export const aiRoute = new Hono<HonoEnv>().post('/detect-form-fields', async (c) => {
  try {
    await getSession(c.req.raw);

    const parsedBody = await c.req.parseBody();
    const rawImage = parsedBody.image;
    const imageCandidate = Array.isArray(rawImage) ? rawImage[0] : rawImage;
    const parsed = ZDetectFormFieldsRequestSchema.safeParse({ image: imageCandidate });

    if (!parsed.success) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Image file is required',
        userMessage: 'Please upload a valid image file.',
      });
    }

    const imageBuffer = Buffer.from(await parsed.data.image.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    if (!imageWidth || !imageHeight) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Unable to extract image dimensions',
        userMessage: 'The image file appears to be invalid or corrupted.',
      });
    }

    const detectedFields = await runFormFieldDetection(imageBuffer);

    if (env('NEXT_PUBLIC_AI_DEBUG_PREVIEW') === 'true') {
      const padding = { left: 80, top: 20, right: 20, bottom: 40 };
      const canvas = new Canvas(
        imageWidth + padding.left + padding.right,
        imageHeight + padding.top + padding.bottom,
      );
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.src = imageBuffer;
      ctx.drawImage(img, padding.left, padding.top);

      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 1000; i += 100) {
        const x = padding.left + (i / 1000) * imageWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, imageHeight + padding.top);
        ctx.stroke();
      }

      for (let i = 0; i <= 1000; i += 100) {
        const y = padding.top + (i / 1000) * imageHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(imageWidth + padding.left, y);
        ctx.stroke();
      }

      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

      detectedFields.forEach((field, index) => {
        const [ymin, xmin, ymax, xmax] = field.boundingBox.map((coord) => coord / 1000);

        const x = xmin * imageWidth + padding.left;
        const y = ymin * imageHeight + padding.top;
        const width = (xmax - xmin) * imageWidth;
        const height = (ymax - ymin) * imageHeight;

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
      ctx.lineTo(padding.left, imageHeight + padding.top);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 1000; i += 100) {
        const y = padding.top + (i / 1000) * imageHeight;
        ctx.fillStyle = '#000000';
        ctx.fillText(i.toString(), padding.left - 5, y);

        ctx.beginPath();
        ctx.moveTo(padding.left - 5, y);
        ctx.lineTo(padding.left, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(padding.left, imageHeight + padding.top);
      ctx.lineTo(imageWidth + padding.left, imageHeight + padding.top);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= 1000; i += 100) {
        const x = padding.left + (i / 1000) * imageWidth;
        ctx.fillStyle = '#000000';
        ctx.fillText(i.toString(), x, imageHeight + padding.top + 5);

        ctx.beginPath();
        ctx.moveTo(x, imageHeight + padding.top);
        ctx.lineTo(x, imageHeight + padding.top + 5);
        ctx.stroke();
      }

      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+/, '')
        .replace('T', '_');
      const outputFilename = `detected_form_fields_${timestamp}.png`;
      const debugDir = join(process.cwd(), '..', '..', 'packages', 'assets', 'ai-previews');
      const outputPath = join(debugDir, outputFilename);

      await mkdir(debugDir, { recursive: true });

      const pngBuffer = await canvas.toBuffer('png');
      await writeFile(outputPath, pngBuffer);
    }

    return c.json<TDetectFormFieldsResponse>(detectedFields);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to detect form fields and generate preview',
      userMessage: 'An error occurred while detecting form fields. Please try again.',
    });
  }
});
