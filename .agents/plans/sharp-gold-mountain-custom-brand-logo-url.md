---
date: 2026-05-28
title: Custom Brand Logo Url
---

# Problem

`brandingUrl` (the configured "Brand Website") is persisted and editable in branding
settings, but historically it was never consumed anywhere. It flowed into the database,
the settings form, and the admin read-only view, but never affected any rendered output.

We want `brandingUrl` to actually do something, with deliberately different behavior per
surface.

# Relationship we're going for

`brandingUrl` is an **email-only** linking concept. It is intentionally **not** used on
in-app signing surfaces.

| Surface | Custom branding logo configured | `brandingUrl` behavior |
| --- | --- | --- |
| Transactional emails (logo) | Logo shown | Logo links to `brandingUrl` when it is a safe http(s) URL; otherwise plain image |
| Transactional emails (footer) | n/a | `brandingUrl` rendered as a link in the footer when it is a safe http(s) URL |
| Signing pages (V1 + V2, normal + direct-template) | Logo shown | Ignored — logo is a plain image with no link |
| Signing pages (no custom logo) | Documenso fallback shown | Fallback keeps its internal `/` link |
| Embedded signing | Logo shown | Ignored (logo not linked) |
| Embedded authoring/editor | Logo shown | Ignored |
| Settings / admin branding previews | n/a | Unchanged (display only) |

Rationale:

- On signing pages the recipient is mid-task; sending them off to an external marketing
  site via the logo is undesirable, so the custom logo is a plain image there.
- In emails the logo and a footer link to the brand's own site are a normal, expected
  pattern and reinforce that the email is legitimately from that brand.

# Decisions

## Scope

- Use `brandingUrl` only in transactional email rendering:
  - The shared email logo component links the custom branding logo to `brandingUrl`.
  - The shared email footer renders `brandingUrl` as a link.
- On signing surfaces, render a configured custom branding logo as a plain image with no
  link wrapper. Leave the Documenso fallback logo's internal `/` link untouched.
- Do not change embedded signing, embedded authoring/editor, or settings/admin previews.
- No Prisma schema or database migration. `brandingUrl` already exists and is editable.

## URL safety

Rendering must be defensive because old/imported data can bypass the branding form's URL
validation. Only treat the stored value as a usable Brand Website when it parses as an
absolute `http:` or `https:` URL.

- Empty, missing, invalid, relative, or non-http(s) values are treated as "no Brand
  Website" and produce a plain logo / no footer link.
- Do not mutate stored settings or run a cleanup migration.
- Factored into a single shared helper so both email logo and footer apply identical rules:
  - `packages/email/utils/branding-url.ts` -> `getSafeBrandingUrl(value): string | null`.

## Email rendering

- New shared component `packages/email/template-components/template-branding-logo.tsx`
  (`TemplateBrandingLogo`) renders either:
  - the custom branding logo, wrapped in a `Link` to the safe `brandingUrl` with
    `target="_blank"` when one exists, or a plain `Img` when not; or
  - the Documenso fallback logo (`/static/logo.png`) when custom branding is disabled or
    no logo is set.
- This component replaced the duplicated `brandingEnabled && brandingLogo ? <Img/> : <fallback/>`
  ternary that was copy-pasted across all transactional email templates.
- `packages/email/template-components/template-footer.tsx` renders `brandingUrl` as a
  footer link (via `getSafeBrandingUrl`) when branding is enabled and the URL is safe.

The branding context already exposes `brandingUrl` (`packages/email/providers/branding.tsx`),
populated by `teamGlobalSettingsToBranding` / `organisationGlobalSettingsToBranding`
(which spread `...settings`), so no additional plumbing into the email branding context was
required.

## Signing rendering

- `apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx`:
  custom logo renders as a bare `<img>`. `brandingUrl` is not read; the local branding type
  and loader payload no longer carry it.
- `apps/remix/app/components/general/envelope-signing/envelope-signer-header.tsx` (V2,
  shared by normal and direct-template signing): custom logo renders as a bare `<img>`; the
  Documenso fallback keeps its `<Link to="/">`.
- `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx`: V1 loader branding payload no
  longer includes `brandingUrl`.
- `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts` and
  `get-envelope-for-direct-template-signing.ts`: `brandingUrl` removed from the V2
  `EnvelopeForSigningResponse.settings` schema/payload since it is not consumed there.

# History

An earlier iteration of this plan wired `brandingUrl` into the in-app signing pages so a
custom logo linked to the Brand Website (external `<a target="_blank">`, internal `/`
fallback otherwise) and added `brandingUrl` to the V1/V2 signing payloads. That direction
was reversed: signing-page logos are now plain images and `brandingUrl` is email-only. The
signing payload additions were removed.

# Test coverage

`packages/app-tests/e2e/signing-branding.spec.ts`:

- V1 normal `/sign/:token`: custom logo is a plain image, not inside a link, and no
  `brandingUrl` link is present.
- V2 normal `/sign/:token` and V2 direct-template: same plain-image assertions.
- V2 with no custom logo: Documenso fallback still links to `/`.
- Embedded signing: no custom-logo Brand Website link is rendered.

# Acceptance criteria

- A custom branding logo on any signing surface (V1, V2 normal, V2 direct-template, embedded)
  renders as a plain image with no link, and `brandingUrl` is never rendered as a link there.
- Documenso fallback logos continue linking to `/`.
- In transactional emails, when a custom logo and a safe `brandingUrl` are configured, the
  email logo links to `brandingUrl` (new tab) and the footer shows the Brand Website link.
- In transactional emails, when `brandingUrl` is empty/invalid/relative/non-http(s), the logo
  is a plain image and no footer Brand Website link is shown.
- URL safety is enforced through the single shared `getSafeBrandingUrl` helper.
- Settings/admin branding previews are unchanged.
- No schema or migration changes.
