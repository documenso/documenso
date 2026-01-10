import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { Role } from '@prisma/client';

export const ROLE_MAP: Record<Role, MessageDescriptor> = {
  [Role.USER]: msg`User`,
  [Role.ADMIN]: msg`Admin`,
};
