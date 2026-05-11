---
date: 2026-05-06
title: Platform Signing Page Branding
---

## What

Platform-plan organisations (and their teams) can customise the **non-embed
signing pages** (`/sign/:token`, `/d/:token`, and the sibling
complete/expired/rejected/waiting pages) with:

- Six brand colour tokens (background, foreground, primary, primary-foreground,
  border, ring) plus a border-radius length.
- A free-text custom CSS block (up to 256 KB).

Settings live on `OrganisationGlobalSettings` and `TeamGlobalSettings`. Teams
inherit from the org via the existing `brandingEnabled === null` mechanism.

## Why

- Embed customers already have white-label CSS; Platform customers want the
  same coverage on direct signing URLs that they iframe or link to.
- Persisting on org/team (not per envelope) means it's set-and-forget.
- Sanitising **on save** lets us inline the verbatim string at SSR — no
  per-render parsing cost, no `<style>.innerHTML` injection on the client.
- Reusing the existing `embedSigningWhiteLabel` claim flag keeps "if you can
  white-label an embed, you can white-label this" as one decision.

## How

### Storage (`packages/prisma/schema.prisma`)

Two new fields on each settings model. No new tables.

| Field            | Org type           | Team type          |
| ---------------- | ------------------ | ------------------ |
| `brandingColors` | `Json?` (nullable) | `Json?` (nullable) |
| `brandingCss`    | `String @default("")` | `String?`       |

Colours are validated against `ZCssVarsSchema`. The team's `null` means
"inherit"; an empty colour object is collapsed to `null` server-side so a
team toggling `brandingEnabled = true` without filling in colours doesn't
silently override the org's defaults with nothing.

### Sanitiser (`packages/lib/utils/sanitize-branding-css.ts`)

PostCSS + `postcss-selector-parser`. Runs on save only.

- Drops selectors containing `::before`/`::after`/`::backdrop`/`::marker` or
  the universal `*`.
- Drops integrity-breaking properties (`display`, `position`, `transform`,
  layout-affecting dimensions, text-hiding properties).
- Drops declaration values containing `url(`, `expression(`, `@import`,
  `javascript:`.
- Strips `!important`.
- Allows `@media` only; drops other at-rules.
- **Does not** rewrite selectors. Scoping happens at render time via native
  CSS nesting under `.documenso-branded { ... }`.
- Final-pass tripwire: if a literal `</style` somehow survives serialization,
  reject the entire output. PostCSS already escapes `<` to `\3c` whenever it
  would form `</...`; the explicit check is belt-and-braces in case a future
  serializer regresses.
- Returns `{ css, warnings[] }`. Warnings are surfaced in the UI.

Border-radius is the only token interpolated raw into a `<style>` block; it
is regex-validated (`CSS_LENGTH_REGEX`) at both the Zod schema and the
runtime `toNativeCssVars` call. Belt-and-braces against schema drift.

### Render (`apps/remix/app/components/general/recipient-branding.tsx`)

Each recipient loader calls `loadRecipientBrandingByTeamId` and threads the
payload through to `<RecipientBranding>`, which emits a single
nonce-attributed `<style>`:

```
.documenso-branded {
  --background: ...; ...
  <user css>
}
```

Native CSS nesting expands user rules under the wrapper. The body class is
applied unconditionally to recipient routes in `root.tsx` via `useMatches()`
so portaled Radix content (dialogs, popovers, tooltips, dropdowns) inherits
the scope.

CSP for recipient routes already supports `<style nonce>`; no policy
changes needed.

### Plan gate

`organisationClaim.flags.embedSigningWhiteLabel || !IS_BILLING_ENABLED()`.
Self-hosted instances always allow. The outer paywall for logo/URL/details
stays on `allowCustomBranding` (Team plan and up); only the new
colour/CSS section is Platform-only.

### UI (`apps/remix/app/components/forms/branding-preferences-form.tsx`)

Extends the existing branding form. Six `<ColorPicker showHex>` (rewritten
to use the native `<input type="color">` instead of `react-colorful`, which
was removed) in a 2-col grid, plus a free-text radius input and an
`<Accordion>` revealing a mono `<Textarea>`. Defaults come from
`packages/lib/constants/theme.ts` (light-mode hex mirror of `theme.css`).

Warnings from the sanitiser are surfaced in an `<Alert variant="warning">`
after save, and the `brandingCss` textarea is re-synced from the persisted
value so the user sees exactly what was stored. Other fields are
deliberately NOT reset on settings refetch — that would clobber in-flight
edits.

### TRPC

`update-organisation-settings` and `update-team-settings` accept the new
fields, run them through `sanitizeBrandingCss` + `normalizeBrandingColors`,
and return any sanitiser warnings to the client. The team route treats
`null` as "inherit"; an empty post-sanitisation string is collapsed to
`null` (team) so an empty override doesn't mask the org's CSS.

## Known accepted limitations

- The sanitiser does not prevent hostile-but-syntactically-valid CSS
  (`color: transparent`, low-contrast values, etc.). The customer is
  branding **their own** signing pages — we focus on integrity (no
  overlay/hide/exfiltrate), not aesthetic policing.
- User rules targeting `body`/`html`/`:root` no-op once nested under the
  wrapper class. Documented for users.
- CSS nesting baseline is Chrome 120+ / Firefox 117+ / Safari 16.5+.
  Acceptable for the Platform-tier audience.
- No automated `theme.css` ↔ `theme.ts` sync check; fat comment in
  `theme.ts` reminds devs to update both.
- Per-section team inherit is coarse — `brandingEnabled = null` inherits
  everything from the org. Per-field inherit toggles are deferred.

## Out of scope

Live preview, embed-route sanitiser unification, email/PDF certificate
branding, custom font upload, the full ~30 colour tokens in the picker UI,
wiring `hidePoweredBy` through to the actual footer.
