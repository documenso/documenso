import { Hono } from 'hono';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { renderPdfToImage } from '@documenso/lib/server-only/pdf/render-pdf-to-image';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { env } from '@documenso/lib/utils/env';
import { logger } from '@documenso/lib/utils/logger';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../router';
import { authorizeDocumentAccess } from './authorization';
import { saveDebugVisualization } from './debug-visualizer';
import type { FieldDetectionRecipient } from './field-detection';
import { runFormFieldDetection } from './field-detection';
import { MAX_PAGES_FOR_RECIPIENT_ANALYSIS, analyzePageForRecipients } from './recipient-detection';
import type { TAnalyzeRecipientsResponse, TDetectFormFieldsResponse } from './types';
import {
  ZAnalyzeRecipientsRequestSchema,
  ZDetectFormFieldsRequestSchema,
  ZDetectFormFieldsResponseSchema,
} from './types';
import { processPageBatch, sortRecipientsForDetection } from './utils';

/**
 * Validates the user has a verified email for AI features.
 */
async function validateUserForAI(request: Request): Promise<{ userId: number }> {
  const { user } = await getSession(request);

  if (!user.emailVerified) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Email verification required',
      userMessage: 'Please verify your email to use AI features',
    });
  }

  return { userId: user.id };
}

/**
 * Fetches recipients for an envelope and validates they exist.
 */
async function getEnvelopeRecipients(envelopeId: string): Promise<FieldDetectionRecipient[]> {
  const recipients = await prisma.recipient.findMany({
    where: { envelopeId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      signingOrder: true,
    },
  });

  if (recipients.length === 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `No recipients found for envelope ${envelopeId}`,
      userMessage: 'Please add at least one recipient before detecting form fields.',
    });
  }

  return sortRecipientsForDetection(recipients);
}

export const aiRoute = new Hono<HonoEnv>()
  .post('/detect-fields', async (c) => {
    try {
      const { userId } = await validateUserForAI(c.req.raw);

      const body = await c.req.json();
      const parsed = ZDetectFormFieldsRequestSchema.safeParse(body);

      if (!parsed.success) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope ID is required',
          userMessage: 'Please provide a valid envelope ID.',
        });
      }

      const { envelopeId } = parsed.data;

      const documentData = await authorizeDocumentAccess(envelopeId, userId);
      const detectionRecipients = await getEnvelopeRecipients(envelopeId);

      const pdfBytes = await getFileServerSide({
        type: documentData.type,
        data: documentData.initialData || documentData.data,
      });

      const renderedPages = await renderPdfToImage(pdfBytes);

      const { results: pageResults } = await processPageBatch(
        renderedPages,
        async (page) => runFormFieldDetection(page.image, page.pageNumber, detectionRecipients),
        {
          itemName: 'page',
          getItemIdentifier: (_, index) => renderedPages[index]?.pageNumber ?? index + 1,
          errorMessage: 'We could not detect fields on some pages. Please try again.',
        },
      );

      const detectedFields = pageResults.flat();

      if (env('NEXT_PUBLIC_AI_DEBUG_PREVIEW') === 'true') {
        await saveDebugVisualization(renderedPages, detectedFields);
      }

      const validatedResponse = ZDetectFormFieldsResponseSchema.parse(detectedFields);

      return c.json<TDetectFormFieldsResponse>(validatedResponse);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to detect form fields from PDF:', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: `Failed to detect form fields from PDF: ${error instanceof Error ? error.message : String(error)}`,
        userMessage: 'An error occurred while detecting form fields. Please try again.',
      });
    }
  })
  .post('/detect-recipients', async (c) => {
    try {
      const { userId } = await validateUserForAI(c.req.raw);

      const body = await c.req.json();
      const parsed = ZAnalyzeRecipientsRequestSchema.safeParse(body);

      if (!parsed.success) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Envelope ID is required',
          userMessage: 'Please provide a valid envelope ID.',
        });
      }

      const { envelopeId } = parsed.data;

      const documentData = await authorizeDocumentAccess(envelopeId, userId);

      const pdfBytes = await getFileServerSide({
        type: documentData.type,
        data: documentData.initialData || documentData.data,
      });

      const renderedPages = await renderPdfToImage(pdfBytes);
      const pagesToAnalyze = renderedPages.slice(0, MAX_PAGES_FOR_RECIPIENT_ANALYSIS);

      const { results: pageResults } = await processPageBatch(
        pagesToAnalyze,
        async (page) => analyzePageForRecipients(page),
        {
          itemName: 'page',
          getItemIdentifier: (page) => page.pageNumber,
          errorMessage: 'We could not analyze recipients on some pages. Please try again.',
        },
      );

      const allRecipients = pageResults.flat();

      return c.json<TAnalyzeRecipientsResponse>(allRecipients);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to analyze recipients from PDF:', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: `Failed to analyze recipients from PDF: ${error instanceof Error ? error.message : String(error)}`,
        userMessage: 'An error occurred while analyzing recipients. Please try again.',
      });
    }
  });
