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
  | 'email_domain'
  | 'org'
  | 'org_email'
  | 'org_claim'
  | 'org_group'
  | 'org_sso'
  | 'org_setting'
  | 'member'
  | 'member_invite'
  | 'group_member'
  | 'team_group'
  | 'team_setting';

export const generateDatabaseId = (prefix: DatabaseIdPrefix) => prefixedId(prefix, 16);

export const extractLegacyIds = (envelope: Pick<Envelope, 'type' | 'secondaryId'>) => {
  return {
    documentId:
      envelope.type === EnvelopeType.DOCUMENT
        ? mapSecondaryIdToDocumentId(envelope.secondaryId)
        : null,
    templateId:
      envelope.type === EnvelopeType.TEMPLATE
        ? mapSecondaryIdToTemplateId(envelope.secondaryId)
        : null,
  };
};
