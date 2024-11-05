import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/macro';

import { DocumentStatus } from '@documenso/prisma/client';

export const DOCUMENT_STATUS: {
  [status in DocumentStatus]: { description: MessageDescriptor };
} = {
  [DocumentStatus.COMPLETED]: {
    description: msg`Completed`,
  },
  [DocumentStatus.DRAFT]: {
    description: msg`Draft`,
  },
  [DocumentStatus.PENDING]: {
    description: msg`Pending`,
  },
};
