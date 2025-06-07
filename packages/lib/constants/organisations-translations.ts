/**
 * These constants are in a different file to avoid E2E tests from importing `msg`
 * which will break it.
 */
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { OrganisationMemberRole } from '@prisma/client';

export const ORGANISATION_MEMBER_ROLE_MAP: Record<
  keyof typeof OrganisationMemberRole,
  MessageDescriptor
> = {
  ADMIN: msg`Admin`,
  MANAGER: msg`Manager`,
  MEMBER: msg`Member`,
};

export const EXTENDED_ORGANISATION_MEMBER_ROLE_MAP: Record<
  keyof typeof OrganisationMemberRole,
  MessageDescriptor
> = {
  ADMIN: msg`Organisation Admin`,
  MANAGER: msg`Organisation Manager`,
  MEMBER: msg`Organisation Member`,
};
