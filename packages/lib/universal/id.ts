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
 * Generate a database ID with the given prefix, e.g. `data_kfxwsemrhvbtlnuc`.
 *
 * ## Security note: some IDs double as access tokens
 *
 * Some of these IDs (e.g. `data`) are deliberately treated as a shared
 * secret: the same ID may be referenced from multiple places (a data content
 * shared between a template and the documents created from it), and knowing
 * the ID may be enough to fetch what it points to, without a further
 * ownership check.
 *
 * This is by design and is not considered a vulnerability. The random part
 * of the ID is 16 characters drawn from a 22 character alphabet by nanoid's
 * cryptographically secure generator, giving roughly 71 bits of entropy.
 * That is not enumerable or guessable, so the only way to know an ID is to
 * have already been given access to something which references it. Anyone
 * who can present the ID has therefore already seen the data, and no new
 * access is gained by "leaking" it. This is the same model as document
 * access tokens.
 *
 * Please do not report the reuse or exposure of these IDs as a security
 * issue on its own. A report needs to show a way to obtain an ID *without*
 * prior access to the data it references.
 */
export const generateDatabaseId = (prefix: DatabaseIdPrefix) => prefixedId(prefix, 16);

export const extractLegacyIds = (envelope: Pick<Envelope, 'type' | 'secondaryId'>) => {
  return {
    documentId: envelope.type === EnvelopeType.DOCUMENT ? mapSecondaryIdToDocumentId(envelope.secondaryId) : null,
    templateId: envelope.type === EnvelopeType.TEMPLATE ? mapSecondaryIdToTemplateId(envelope.secondaryId) : null,
  };
};
