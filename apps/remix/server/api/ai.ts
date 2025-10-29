import { google } from '@ai-sdk/google';
import { sValidator } from '@hono/standard-validator';
import { generateObject, generateText } from 'ai';
import { readFile, writeFile } from 'fs/promises';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join } from 'path';
import sharp from 'sharp';
import { Canvas, Image } from 'skia-canvas';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import type { HonoEnv } from '../router';
import {
  type TDetectObjectsAndDrawResponse,
  type TDetectObjectsResponse,
  type TGenerateTextResponse,
  ZDetectObjectsAndDrawRequestSchema,
  ZDetectObjectsRequestSchema,
  ZDetectObjectsResponseSchema,
  ZGenerateTextRequestSchema,
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

export const aiRoute = new Hono<HonoEnv>()
  .use(
    '*',
    cors({
      origin: 'http://localhost:3000',
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )

  .post('/generate', sValidator('json', ZGenerateTextRequestSchema), async (c) => {
    try {
      await getSession(c.req.raw);

      const { prompt } = c.req.valid('json');

      const result = await generateText({
        model: google('gemini-2.0-flash-exp'),
        prompt,
      });

      return c.json<TGenerateTextResponse>({ text: result.text });
    } catch (error) {
      console.error('AI generation failed:', error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to generate text',
        userMessage: 'An error occurred while generating the text. Please try again.',
      });
    }
  })

  .post('/detect-objects', sValidator('json', ZDetectObjectsRequestSchema), async (c) => {
    try {
      await getSession(c.req.raw);

      const { imagePath } = c.req.valid('json');

      const imageBuffer = await readFile(imagePath);
      const compressedImageBuffer = await resizeAndCompressImage(imageBuffer);
      const base64Image = compressedImageBuffer.toString('base64');

      const result = await generateObject({
        model: google('gemini-2.5-pro'),
        schema: ZDetectObjectsResponseSchema,
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
                text: `You are analyzing a form document image to detect fillable fields for the Documenso document signing platform.

IMPORTANT RULES:
1. Only detect EMPTY/UNFILLED fields (ignore boxes that already contain text or data)
2. Analyze nearby text labels to determine the field type
3. Return bounding boxes for the fillable area only, NOT the label text
4. Each bounding box must be in the format [ymin, xmin, ymax, xmax] where all coordinates are NORMALIZED to a 0-1000 scale

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
- If you're uncertain which type fits best, default to TEXT
- For checkboxes and radio buttons: Detect each individual box/circle separately, not the label
- Signature fields are often longer horizontal lines or larger boxes
- Date fields often show format hints or date separators (slashes, dashes)
- Look for visual patterns: underscores (____), horizontal lines, box outlines
- Return coordinates for the fillable area, not the descriptive label text

COORDINATE SYSTEM:
- [ymin, xmin, ymax, xmax] normalized to 0-1000 scale
- Top-left corner: ymin and xmin close to 0
- Bottom-right corner: ymax and xmax close to 1000
- Coordinates represent positions on a 1000x1000 grid overlaid on the image`,
              },
            ],
          },
        ],
      });

      return c.json<TDetectObjectsResponse>(result.object);
    } catch (error) {
      console.error('Object detection failed:', error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to detect objects',
        userMessage: 'An error occurred while detecting objects. Please try again.',
      });
    }
  })

  .post(
    '/detect-object-and-draw',
    sValidator('json', ZDetectObjectsAndDrawRequestSchema),
    async (c) => {
      try {
        await getSession(c.req.raw);

        const { imagePath } = c.req.valid('json');

        console.log(`[detect-object-and-draw] Reading image from: ${imagePath}`);

        const imageBuffer = await readFile(imagePath);
        const metadata = await sharp(imageBuffer).metadata();
        const imageWidth = metadata.width;
        const imageHeight = metadata.height;

        console.log(
          `[detect-object-and-draw] Original image dimensions: ${imageWidth}x${imageHeight}`,
        );

        if (!imageWidth || !imageHeight) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Unable to extract image dimensions',
            userMessage: 'The image file appears to be invalid or corrupted.',
          });
        }

        console.log('[detect-object-and-draw] Compressing image for Gemini API...');
        const compressedImageBuffer = await resizeAndCompressImage(imageBuffer);
        const base64Image = compressedImageBuffer.toString('base64');

        console.log('[detect-object-and-draw] Calling Gemini API for form field detection...');
        const result = await generateObject({
          model: google('gemini-2.5-pro'),
          schema: ZDetectObjectsResponseSchema,
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
                  text: `You are analyzing a form document image to detect fillable fields for the Documenso document signing platform.

IMPORTANT RULES:
1. Only detect EMPTY/UNFILLED fields (ignore boxes that already contain text or data)
2. Analyze nearby text labels to determine the field type
3. Return bounding boxes for the fillable area only, NOT the label text
4. Each bounding box must be in the format [ymin, xmin, ymax, xmax] where all coordinates are NORMALIZED to a 0-1000 scale

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
- If you're uncertain which type fits best, default to TEXT
- For checkboxes and radio buttons: Detect each individual box/circle separately, not the label
- Signature fields are often longer horizontal lines or larger boxes
- Date fields often show format hints or date separators (slashes, dashes)
- Look for visual patterns: underscores (____), horizontal lines, box outlines
- Return coordinates for the fillable area, not the descriptive label text

COORDINATE SYSTEM:
- [ymin, xmin, ymax, xmax] normalized to 0-1000 scale
- Top-left corner: ymin and xmin close to 0
- Bottom-right corner: ymax and xmax close to 1000
- Coordinates represent positions on a 1000x1000 grid overlaid on the image`,
                },
              ],
            },
          ],
        });
        console.log('[detect-object-and-draw] Gemini API call completed');

        const detectedObjects = result.object;

        console.log(
          `[detect-object-and-draw] Detected ${detectedObjects.length} objects, starting to draw...`,
        );

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

        // Horizontal grid lines (every 100 units on 0-1000 scale)
        for (let i = 0; i <= 1000; i += 100) {
          const y = padding.top + (i / 1000) * imageHeight;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(imageWidth + padding.left, y);
          ctx.stroke();
        }

        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

        detectedObjects.forEach((obj, index) => {
          const [ymin, xmin, ymax, xmax] = obj.box_2d.map((coord) => coord / 1000);

          const x = xmin * imageWidth + padding.left;
          const y = ymin * imageHeight + padding.top;
          const width = (xmax - xmin) * imageWidth;
          const height = (ymax - ymin) * imageHeight;

          ctx.strokeStyle = colors[index % colors.length];
          ctx.lineWidth = 5;
          ctx.strokeRect(x, y, width, height);

          ctx.fillStyle = colors[index % colors.length];
          ctx.font = '20px Arial';
          ctx.fillText(obj.label, x, y - 5);
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
        const outputFilename = `detected_objects_${timestamp}.png`;
        const outputPath = join(process.cwd(), outputFilename);

        console.log('[detect-object-and-draw] Converting canvas to PNG buffer...');
        const pngBuffer = await canvas.toBuffer('png');
        console.log(`[detect-object-and-draw] Saving to: ${outputPath}`);
        await writeFile(outputPath, pngBuffer);

        console.log('[detect-object-and-draw] Image saved successfully!');
        return c.json<TDetectObjectsAndDrawResponse>({
          outputPath,
          detectedObjects,
        });
      } catch (error) {
        console.error('Object detection and drawing failed:', error);

        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to detect objects and draw',
          userMessage: 'An error occurred while detecting and drawing objects. Please try again.',
        });
      }
    },
  );
