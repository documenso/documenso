import type { Envelope } from '@prisma/client';
import { EnvelopeType } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { mapSecondaryIdToDocumentId, mapSecondaryIdToTemplateId } from '../utils/envelope';

export const alphaid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

export { nanoid } from 'nanoid';

export const fancyId = customAlphabet('abcdefhiklmnorstuvwxyz', 16);

export const prefixedId = (prefix: string, length = 16) => {
  return `${prefix}_${fancyId(length)}`;
};

type DatabaseIdPrefix =
  | 'document'
  | 'template'
  | 'envelope'
  | 'envelope_item'
  | 'envelope_content'
  | 'data'
  | 'email_domain'
  | 'email_transport'
  | 'org'
  | 'org_email'
  | 'org_monthly_stat'
  | 'org_claim'
  | 'org_group'
  | 'org_sso'
  | 'org_setting'
  | 'member'
  | 'member_invite'
  | 'group_member'
  | 'team_group'
  | 'team_setting';

/**
 * Security note: some of these IDs (e.g. `data`) deliberately double as access
 * tokens. Knowing the ID may be enough to fetch what it points to without a
 * further ownership check, since a data content is shared between a template
 * and the documents created from it.
 *
 * This is by design, not a vulnerability. The random part is 16 characters from
 * a 22 character alphabet via nanoid's CSPRNG (~71 bits), so the only way to
 * know an ID is to have already been given access to something which
 * references it. Same model as document access tokens. Do not report exposure
 * of these IDs as a security issue without a way to obtain one *without* prior
 * access to the data it references.
 */
export const generateDatabaseId = (prefix: DatabaseIdPrefix) => prefixedId(prefix, 16);

export const extractLegacyIds = (envelope: Pick<Envelope, 'type' | 'secondaryId'>) => {
  return {
    documentId: envelope.type === EnvelopeType.DOCUMENT ? mapSecondaryIdToDocumentId(envelope.secondaryId) : null,
    templateId: envelope.type === EnvelopeType.TEMPLATE ? mapSecondaryIdToTemplateId(envelope.secondaryId) : null,
  };
};
