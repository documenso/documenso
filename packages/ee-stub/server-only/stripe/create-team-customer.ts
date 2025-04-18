/**
 * Stub implementation for creating a team customer.
 * In the stub version, returns a mock customer ID.
 */

export const createTeamCustomer = async ({
  name,
  email
}: {
  name: string | null;
  email: string
}) => {
  return { id: 'cus_stub_team' };
};
