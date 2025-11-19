import { generateObject } from 'ai';

import { resizeAndCompressImage } from '@documenso/lib/server-only/image/resize-and-compress-image';
import { resolveRecipientEmail } from '@documenso/lib/utils/recipients';

import { ANALYZE_RECIPIENTS_PROMPT } from './prompts';
import type { TDetectedRecipient } from './types';
import { ZDetectedRecipientLLMSchema } from './types';
import { safeGenerateObject } from './utils';

// Limit recipient detection to first 3 pages for performance and cost efficiency
export const MAX_PAGES_FOR_RECIPIENT_ANALYSIS = 3;

export type PageWithImage = {
  image: Buffer;
  pageNumber: number;
};

/**
 * Analyze a single page for recipient information.
 */
export async function analyzePageForRecipients(page: PageWithImage): Promise<TDetectedRecipient[]> {
  const compressedImageBuffer = await resizeAndCompressImage(page.image);
  const base64Image = compressedImageBuffer.toString('base64');

  const recipients = await safeGenerateObject(
    async () =>
      generateObject({
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
      }),
    {
      operation: 'analyze recipients',
      pageNumber: page.pageNumber,
    },
  );

  return normalizeRecipients(recipients);
}

/**
 * Normalize recipient data by resolving emails and ensuring consistent format.
 */
function normalizeRecipients(
  recipients: Array<{
    name: string;
    email?: string;
    role: 'SIGNER' | 'APPROVER' | 'CC';
    signingOrder?: number;
  }>,
): TDetectedRecipient[] {
  return recipients.map((recipient) => ({
    ...recipient,
    email: resolveRecipientEmail(recipient.email),
  }));
}
