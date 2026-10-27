import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { EmailSuppressionScope, EmailSuppressionSource } from '@prisma/client';

export const EMAIL_SUPPRESSION_SCOPE_MAP: Record<keyof typeof EmailSuppressionScope, MessageDescriptor> = {
  GLOBAL: msg`All senders`,
  ORGANISATION: msg`Organisation`,
  TEAM: msg`Team`,
  USER: msg`User`,
};

export const EMAIL_SUPPRESSION_SOURCE_MAP: Record<keyof typeof EmailSuppressionSource, MessageDescriptor> = {
  RECIPIENT: msg`Recipient`,
  ADMIN: msg`Admin`,
};
