import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/macro';

import { DocumentDistributionMethod, DocumentStatus } from '@documenso/prisma/client';

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

type DocumentDistributionMethodTypeData = {
  value: DocumentDistributionMethod;
  description: MessageDescriptor;
};

export const DOCUMENT_DISTRIBUTION_METHODS: Record<string, DocumentDistributionMethodTypeData> = {
  [DocumentDistributionMethod.EMAIL]: {
    value: DocumentDistributionMethod.EMAIL,
    description: msg`Email`,
  },
  [DocumentDistributionMethod.NONE]: {
    value: DocumentDistributionMethod.NONE,
    description: msg`None`,
  },
} satisfies Record<DocumentDistributionMethod, DocumentDistributionMethodTypeData>;
