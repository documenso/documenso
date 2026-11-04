/**
 * These constants are in a different file to avoid E2E tests from importing `msg`
 * which will break it.
 */
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import type { TAdminTagType } from '../types/admin-tags';

export const ADMIN_TAG_TYPE_MAP: Record<TAdminTagType, MessageDescriptor> = {
  flagged_for_review: msg`Flagged for review`,
};
