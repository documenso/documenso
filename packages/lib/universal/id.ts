import { customAlphabet } from 'nanoid';

export const alphaid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

export { nanoid } from 'nanoid';

export const fancyId = customAlphabet('abcdefhiklmnorstuvwxyz', 16);

export const prefixedId = (prefix: string, length = 16) => {
  return `${prefix}_${fancyId(length)}`;
};

type DatabaseIdPrefix =
  | 'org'
  | 'org_claim'
  | 'org_group'
  | 'org_setting'
  | 'member'
  | 'member_invite'
  | 'group_member'
  | 'team_group'
  | 'team_setting';

export const generateDatabaseId = (prefix: DatabaseIdPrefix) => prefixedId(prefix, 16);
