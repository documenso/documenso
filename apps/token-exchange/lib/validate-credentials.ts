/**
 * Validate third-party credentials.
 *
 * Override this function to integrate with your external system.
 * Return true if credentials are valid, false otherwise.
 */
export async function validateThirdPartyCredentials(
  credentials: Record<string, unknown>,
): Promise<boolean> {
  // TODO: Implement validation against your 3rd party system.
  // Example: Call their API to verify the credentials.
  //
  // const response = await fetch('https://your-3rd-party.com/api/verify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(credentials),
  // });
  // return response.ok;

  if (!credentials || Object.keys(credentials).length === 0) {
    return false;
  }

  // Stub: Accept any non-empty credentials for development.
  // Replace with real validation before production.
  await Promise.resolve();
  return true;
}
