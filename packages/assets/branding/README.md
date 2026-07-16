# Brand source files

This folder is the single source of truth for Keep Contracts logo/icon artwork.

- `logo-light.svg` / `logo-dark.svg` — full combo mark (icon + wordmark), for light-background and dark-background contexts respectively.
- `icon-light.svg` / `icon-dark.svg` — icon-only mark, for light-background and dark-background contexts respectively. Also used as the source for the browser favicon and app-icon tiles.

## If you replace one of these files

The codebase can't reference an arbitrary-format SVG everywhere (email clients and native app icons need raster images), so a handful of derived files need to be regenerated and copied by hand:

| Derived file | Rendered from | Also copy to |
|---|---|---|
| `packages/assets/logo.png` | `logo-light.svg` | — |
| `packages/assets/static/logo.png` | `logo-light.svg` (small) | `apps/remix/public/static/logo.png`, `apps/docs/public/logo.png`, `packages/email/static/logo.png` |
| `packages/assets/logo_icon.png` | `icon-light.svg` | `apps/remix/public/logo_icon.png` |
| `packages/assets/favicon.svg` | `icon-light.svg` (copy as-is) | `apps/remix/public/favicon.svg` |
| `packages/assets/favicon-40x40.png` | `icon-light.svg` | `apps/remix/public/favicon-40x40.png` |
| `packages/assets/favicon.ico` | `icon-light.svg` (16/32/48px, transparent) | `apps/remix/public/favicon.ico`, `apps/docs/src/app/favicon.ico` |
| `packages/assets/apple-touch-icon.png` | `icon-dark.svg` on a `#256395` tile | `apps/remix/public/apple-touch-icon.png`, `apps/docs/public/apple-touch-icon.png`, `apps/docs/src/app/apple-icon.png` |
| `packages/assets/android-chrome-192x192.png` / `-512x512.png` | `icon-dark.svg` on a `#256395` tile | `apps/remix/public/android-chrome-*.png` |

There's no build script for this on purpose (see repo-wide guidance on keeping diffs small for easier upstream merges). Regenerate with any SVG-to-PNG tool (e.g. `sharp`) and copy by hand.
