import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { TeamMemberRole } from '@prisma/client';

export const TEAM_MEMBER_ROLE_MAP: Record<keyof typeof TeamMemberRole, MessageDescriptor> = {
  ADMIN: msg`Admin`,
  MANAGER: msg`Manager`,
  MEMBER: msg`Member`,
};

export const EXTENDED_TEAM_MEMBER_ROLE_MAP: Record<keyof typeof TeamMemberRole, MessageDescriptor> =
  {
    ADMIN: msg`Team Admin`,
    MANAGER: msg`Team Manager`,
    MEMBER: msg`Team Member`,
  };
