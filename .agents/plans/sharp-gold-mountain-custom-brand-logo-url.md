---
date: 2026-05-28
title: Custom Brand Logo Url
---

# Problem

Custom branding logos can render on in-app recipient signing surfaces, but their click behavior does not consistently honor the configured Brand Website (`brandingUrl`).

- V2 non-embedded signing uses `EnvelopeSignerHeader`, which currently wraps the logo area in `<Link to="/">`; a custom logo therefore routes recipients back to Documenso instead of the customer brand website.
- V1 normal signing renders a custom logo as a bare image, so it never links to the Brand Website.
- V1 currently reads logo visibility from the raw `document.team.teamGlobalSettings` row even though the loader already resolves inherited team/organisation settings through `getTeamSettings()`.

# Decisions

## Scope

Apply this feature to in-app/web surfaces where a custom branding logo is already rendered in a non-embedded signing flow:

- `apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx` for normal `/sign/:token` V1 signing.
- `apps/remix/app/components/general/envelope-signing/envelope-signer-header.tsx` for non-embedded V2 signing. This includes normal `/sign/:token` V2 signing and direct-template `/d/:token` V2 signing because both reuse `EnvelopeSignerHeader`.

Do not add new custom logo placements. V1 direct-template signing remains unchanged because it does not currently render the custom logo in this header area.

Explicitly out of scope:

- Transactional email template logos.
- Embedded signing.
- Embedded authoring/editor logos.
- Settings/admin branding previews.
- Documenso fallback logos.

## Data contract

`brandingUrl` is persisted already, but the current signing payloads do not expose it to the rendering components.

- Add `brandingUrl` to the existing V2 `EnvelopeForSigningResponse.settings` payload and Zod schema.
- Populate the V2 value from the same derived `getTeamSettings()` result used for `brandingEnabled` and `brandingLogo` in:
  - `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts`
  - `packages/lib/server-only/envelope/get-envelope-for-direct-template-signing.ts`
- For V1, return a derived branding settings payload from the existing `getTeamSettings()` call in `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx`, then pass it into `DocumentSigningPageViewV1`.
- V1 logo rendering should use this derived payload for `brandingEnabled`, `brandingLogo`, and `brandingUrl`, not raw `document.team.teamGlobalSettings`.

No Prisma schema or database migration is required. Backend response/select/schema changes are required because the current client payloads are missing `brandingUrl`.

## URL safety

Only render the Brand Website as a link when the stored value parses as an absolute `http:` or `https:` URL.

- Empty, missing, invalid, relative, or non-http(s) values are treated as no Brand Website.
- Do not mutate stored settings or run a cleanup migration as part of this fix.
- Do not trust backend router input validation here; rendering must be defensive because old/imported data can bypass the branding form.

## Navigation behavior

Use a plain external anchor for safe Brand Website links:

```tsx
<a href={safeBrandingUrl} target="_blank" rel="noopener noreferrer">
  ...
</a>
```

Use React Router `Link` only for internal Documenso navigation. Remix/React Router `Link` is for client-side route navigation; external absolute URLs should not be routed through it.

Behavior matrix:

| Surface | Custom logo + safe Brand Website | Custom logo + no safe Brand Website | No custom logo |
| --- | --- | --- | --- |
| V1 normal `/sign/:token` | External `<a>` opens Brand Website in a new tab | Existing internal `/` link is preserved | No new fallback logo |
| V2 normal `/sign/:token` | External `<a>` opens Brand Website in a new tab | Existing internal `/` link is preserved | Existing Documenso fallback logo links to `/` |
| V2 direct-template `/d/:token` | Same as V2 normal signing | Same as V2 normal signing | Same as V2 normal signing |
| Embedded signing | Unchanged | Unchanged | Unchanged |
| Embedded authoring/editor | Unchanged | Unchanged | Unchanged |
| Settings/admin previews | Unchanged | Unchanged | Unchanged |
| Emails | Unchanged | Unchanged | Unchanged |

# Implementation plan

1. Update V2 signing payloads.
   - Extend `ZEnvelopeForSigningResponse.settings` with `brandingUrl`.
   - Populate `settings.brandingUrl` from derived team settings in recipient signing and direct-template signing loaders.
   - Keep existing `brandingEnabled` and `brandingLogo` behavior intact.

2. Update V1 signing payload and rendering.
   - Return derived `brandingEnabled`, `brandingLogo`, and `brandingUrl` from the existing `getTeamSettings()` call in the V1 signing loader.
   - Pass that payload to `DocumentSigningPageViewV1`.
   - Render the V1 custom logo from the derived payload so organisation-inherited branding works consistently.

3. Apply safe Brand Website linking.
   - Parse the stored URL defensively at render time or through a small shared helper used by the touched signing components.
   - Only accept `http:` and `https:` protocols.
   - For safe URLs, wrap the custom logo with an external `<a>` using `target="_blank"` and `rel="noopener noreferrer"`.
   - For unsafe or missing URLs, preserve the no-Brand-Website behavior from the matrix above.

4. Preserve excluded surfaces.
   - Do not change email templates.
   - Do not change embedded signing or embedded authoring/editor logo behavior.
   - Do not change settings/admin logo previews.
   - Do not change Documenso fallback logo behavior.

5. Add regression coverage.
   - Prefer the existing signing E2E area, such as `packages/app-tests/e2e/pdf-viewer/pdf-viewer.spec.ts`, or a focused signing-branding spec if that is cleaner.
   - Seed real team branding with `brandingEnabled`, `brandingLogo`, and `brandingUrl`; do not mock the logo route.
   - Cover normal V1 `/sign/:token` with a safe Brand Website and assert the custom logo is inside an external link with normalized `href`, `target="_blank"`, and safe `rel`.
   - Cover normal V2 `/sign/:token` with the same safe Brand Website assertion.
   - Cover V2 direct-template signing if the test setup already creates that route cheaply; otherwise rely on the shared `EnvelopeSignerHeader` assertion from normal V2 signing and keep direct-template V2 in the manual trace.
   - Cover the V1 and V2 custom-logo/no-Brand-Website branches and assert the existing `/` link remains.
   - Cover embedded signing unchanged by asserting no custom-logo Brand Website link is rendered there.
   - Cover unsafe URL handling with the narrowest practical test. A small helper-level test is acceptable if the URL sanitizer is factored out; otherwise use a targeted rendering/E2E assertion.

# Acceptance criteria

- A recipient clicking a custom branded logo on non-embedded V1 normal signing opens the configured safe Brand Website in a new tab.
- A recipient clicking a custom branded logo on non-embedded V2 normal signing opens the configured safe Brand Website in a new tab.
- A recipient clicking a custom branded logo on non-embedded V2 direct-template signing opens the configured safe Brand Website in a new tab.
- V1 normal signing uses derived team/organisation branding settings for logo visibility and URL.
- If no safe Brand Website is configured, V1 and V2 custom logos keep the existing `/` fallback link.
- Embedded signing remains unchanged.
- Embedded authoring/editor remains unchanged.
- Transactional email logos remain unchanged.
- Settings/admin branding previews remain unchanged.
- Existing Documenso fallback logos continue linking to `/`.
- Non-http(s), relative, invalid, empty, or missing `brandingUrl` values do not render as external links.
- Targeted regression coverage fails before the fix and passes after it.