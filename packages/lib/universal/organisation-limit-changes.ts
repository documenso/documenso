export type OrganisationLimits = {
  documentQuota: number | null;
  emailQuota: number | null;
  apiQuota: number | null;
  teamCount: number;
  memberCount: number;
  recipientCount: number;
  envelopeItemCount: number;
};

const ORGANISATION_LIMIT_KEYS = [
  'documentQuota',
  'emailQuota',
  'apiQuota',
  'teamCount',
  'memberCount',
  'recipientCount',
  'envelopeItemCount',
] as const satisfies (keyof OrganisationLimits)[];

export const hasOrganisationLimitsChanged = (
  previous: OrganisationLimits,
  next: Partial<OrganisationLimits>,
): boolean => {
  return ORGANISATION_LIMIT_KEYS.some((key) => next[key] !== undefined && next[key] !== previous[key]);
};
