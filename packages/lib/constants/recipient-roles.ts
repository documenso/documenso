import { RecipientRole } from '@documenso/prisma/client';

// {actionVerb} Document

export const RECIPIENT_ROLES_DESCRIPTION = {
  [RecipientRole.APPROVER]: {
    actionVerb: 'დაამტკიცოთ',
    actioned: 'დაამტკიცა',
    progressiveVerb: 'დამტკიცებით',
    roleName: 'დამამტკიცებელი',
  },
  [RecipientRole.CC]: {
    actionVerb: 'ასლი მიიღოთ',
    actioned: `ასლი მიიღო`,
    progressiveVerb: 'ასლის მიღებით',
    roleName: 'ასლის მიმღები',
  },
  [RecipientRole.SIGNER]: {
    actionVerb: 'ხელი მოაწეროთ',
    actioned: 'ხელი მოაწერა',
    progressiveVerb: 'ხელმოწერით',
    roleName: 'ხელმომწერი',
  },
  [RecipientRole.VIEWER]: {
    actionVerb: 'იხილოთ',
    actioned: 'იხილა',
    progressiveVerb: 'ნახვით',
    roleName: 'დამკვირვებელი',
  },
} satisfies Record<keyof typeof RecipientRole, unknown>;

export const RECIPIENT_ROLE_TO_EMAIL_TYPE = {
  [RecipientRole.SIGNER]: 'SIGNING_REQUEST',
  [RecipientRole.VIEWER]: 'VIEW_REQUEST',
  [RecipientRole.APPROVER]: 'APPROVE_REQUEST',
} as const;

export const RECIPIENT_ROLE_SIGNING_REASONS = {
  [RecipientRole.SIGNER]: 'მე ვარ ამ დოკუმენტის ხელმომწერი',
  [RecipientRole.APPROVER]: 'მე ვარ ამ დოკუმენტის დამამტკიცებელი',
  [RecipientRole.CC]: 'მე ვალდებული ვარ მივიღო ამ დოკუმენტის ასლი',
  [RecipientRole.VIEWER]: 'მე ვერ არ დოკუმენტის მოწმე',
} satisfies Record<keyof typeof RecipientRole, string>;
