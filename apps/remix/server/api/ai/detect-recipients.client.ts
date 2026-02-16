import { z } from 'zod';

import { ZDetectedRecipientSchema } from '@documenso/lib/server-only/ai/envelope/detect-recipients/schema';

import { type TDetectRecipientsRequest } from './detect-recipients.types';

export type { TDetectRecipientsRequest };

// Stream event schemas
const ZProgressEventSchema = z.object({
  type: z.literal('progress'),
  pagesProcessed: z.number(),
  totalPages: z.number(),
  recipientsDetected: z.number(),
});

const ZKeepaliveEventSchema = z.object({
  type: z.literal('keepalive'),
});

const ZErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

const ZCompleteEventSchema = z.object({
  type: z.literal('complete'),
  recipients: z.array(ZDetectedRecipientSchema),
});

const ZStreamEventSchema = z.discriminatedUnion('type', [
  ZProgressEventSchema,
  ZKeepaliveEventSchema,
  ZErrorEventSchema,
  ZCompleteEventSchema,
]);

export type DetectRecipientsProgressEvent = z.infer<typeof ZProgressEventSchema>;
export type DetectRecipientsCompleteEvent = z.infer<typeof ZCompleteEventSchema>;
export type DetectRecipientsStreamEvent = z.infer<typeof ZStreamEventSchema>;

const ZApiErrorResponseSchema = z.object({
  error: z.string(),
});

export class AiApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AiApiError';
  }
}

export type DetectRecipientsOptions = {
  request: TDetectRecipientsRequest;
  onProgress?: (event: DetectRecipientsProgressEvent) => void;
  onComplete: (event: DetectRecipientsCompleteEvent) => void;
  onError: (error: AiApiError) => void;
  signal?: AbortSignal;
};

/**
 * Detect recipients from an envelope using AI with streaming support.
 */
export const detectRecipients = async ({
  request,
  onProgress,
  onComplete,
  onError,
  signal,
}: DetectRecipientsOptions): Promise<void> => {
  const response = await fetch('/api/ai/detect-recipients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  // Handle non-streaming error responses (auth failures, etc.)
  if (!response.ok) {
    const text = await response.text();

    try {
      const parsed = ZApiErrorResponseSchema.parse(JSON.parse(text));

      throw new AiApiError(parsed.error, response.status);
    } catch (e) {
      if (e instanceof AiApiError) {
        throw e;
      }

      throw new AiApiError('Failed to detect recipients', response.status);
    }
  }

  // Handle streaming response
  const reader = response.body?.getReader();

  if (!reader) {
    throw new AiApiError('No response body', 500);
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;

      if (done) {
        break;
      }

      const value = result.value;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const event = ZStreamEventSchema.parse(JSON.parse(line));

          switch (event.type) {
            case 'progress':
              onProgress?.(event);
              break;
            case 'keepalive':
              // Ignore keepalive, it's just to prevent timeout
              break;
            case 'error':
              onError(new AiApiError(event.message, 500));
              return;
            case 'complete':
              onComplete(event);
              return;
          }
        } catch {
          // Ignore malformed lines
          console.warn('Failed to parse stream event:', line);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};
