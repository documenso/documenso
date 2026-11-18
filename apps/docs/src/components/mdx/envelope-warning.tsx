import { Callout } from 'fumadocs-ui/components/callout';

const MIGRATION_GUIDE_HREF = '/docs/developers/api/migrate-to-envelopes';

/**
 * Deprecation banner steering API consumers away from the legacy document and
 * template create endpoints and towards the unified Envelope API.
 *
 * Registered globally in `mdx-components.tsx`, so it can be used in any MDX page
 * as `<EnvelopeWarning />` without an explicit import.
 */
export function EnvelopeWarning() {
  return (
    <Callout type="error">
      <strong>Documents and templates are being deprecated and replaced by envelopes.</strong>{' '}
      <a href={MIGRATION_GUIDE_HREF}>Read the migration guide here.</a>
    </Callout>
  );
}
