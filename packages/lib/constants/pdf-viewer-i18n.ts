import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

// This is separate from the pdf-viewer.ts constant file due to parsing issues during testing.
export const PDF_VIEWER_ERROR_MESSAGES = {
  editor: {
    title: msg`Configuration Error`,
    description: msg`There was an issue rendering some fields, please review the fields and try again.`,
  },
  preview: {
    title: msg`Configuration Error`,
    description: msg`Something went wrong while rendering the document, some fields may be missing or corrupted.`,
  },
  signing: {
    title: msg`Configuration Error`,
    description: msg`Something went wrong while rendering the document, some fields may be missing or corrupted.`,
  },
  default: {
    title: msg`Configuration Error`,
    description: msg`Something went wrong while rendering the document, please try again or contact our support.`,
  },
} satisfies Record<string, { title: MessageDescriptor; description: MessageDescriptor }>;
