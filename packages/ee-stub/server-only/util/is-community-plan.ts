/**
 * Stub implementation of the community plan check.
 * In the stub version, all users are considered to be on the community plan.
 */

export const isCommunityPlan = async ({
  userId,
  teamId,
}: {
  userId: number;
  teamId?: number | null;
}) => {
  return true;
};
