import { getOrganisationClaimByUserId } from '../organisation/get-organisation-claims';

/**
 * Check if a user has enterprise features enabled (cfr21 flag).
 */
export const isUserEnterprise = async ({ userId }: { userId: number }): Promise<boolean> => {
  try {
    const organisationClaim = await getOrganisationClaimByUserId({ userId });
    return Boolean(organisationClaim.flags.cfr21);
  } catch {
    // If we can't find the organisation claim, assume non-enterprise
    return false;
  }
};
