import { DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

export const DOCUMENT_TITLE_MAX_LENGTH = 255;

export const ZDocumentTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(DOCUMENT_TITLE_MAX_LENGTH)
  .describe('The title of the document.');

export const ZDocumentExternalIdSchema = z
  .string()
  .trim()
  .max(255)
  .describe('The external ID of the document.');

export const ZDocumentVisibilitySchema = z
  .nativeEnum(DocumentVisibility)
  .describe('The visibility of the document.');
