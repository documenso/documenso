import { DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

export const ZDocumentTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .describe('The title of the document.');

export const ZDocumentExternalIdSchema = z
  .string()
  .trim()
  .max(255)
  .describe('The external ID of the document.');

export const ZDocumentVisibilitySchema = z
  .nativeEnum(DocumentVisibility)
  .describe('The visibility of the document.');
