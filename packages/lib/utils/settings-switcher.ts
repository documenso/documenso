export type ComputeSwitcherContinuityPathArgs = {
  currentPath: string;

  /**
   * Every settings path navigable in the destination scope — pass the destination's
   * `SettingsNavGroup.items` paths from `getSettingsNavGroups`.
   *
   * Sourcing these from the nav builder (rather than a hardcoded list) means the switcher
   * can only ever land on a page that is actually reachable there: permission and
   * claim/billing gating are already applied when the group is built.
   */
  destinationPaths: string[];

  /** Where to land when the current section has no equivalent in the destination. */
  fallbackPath: string;
};

/**
 * Extract the "section" portion of a settings URL. Returns null if not a scoped
 * settings URL (account settings and non-settings pages have no equivalent to carry over).
 *
 * Examples:
 *   /o/acme/settings/members      → 'members'
 *   /o/acme/settings              → 'general'  (bare index redirects to General)
 *   /t/eng/settings/webhooks/42   → 'webhooks'
 *   /o/acme/documents             → null
 *   /settings/profile             → null
 */
const parseSettingsSection = (path: string): string | null => {
  const match = /^\/[ot]\/[^/]+\/settings(?:\/([^/?#]+))?(?:[/?#]|$)/.exec(path);

  if (!match) {
    return null;
  }

  return match[1] ?? 'general';
};

/**
 * Compute the destination URL when the user switches organisation or team via the
 * unified settings sidebar's switcher.
 *
 * Rule: stay on the same section if the destination has one; else use the fallback.
 */
export const computeSwitcherContinuityPath = ({
  currentPath,
  destinationPaths,
  fallbackPath,
}: ComputeSwitcherContinuityPathArgs): string => {
  const currentSection = parseSettingsSection(currentPath);

  if (!currentSection) {
    return fallbackPath;
  }

  return destinationPaths.find((path) => parseSettingsSection(path) === currentSection) ?? fallbackPath;
};
