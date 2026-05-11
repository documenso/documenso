---
date: 2026-02-26
title: pnpm Migration
---

## Overview

Migrate from npm to pnpm to eliminate dependency resolution duplication issues that cause bundler problems. The current npm workspace setup results in nested `node_modules` copies that don't deduplicate reliably, requiring manual hoisting and `npm dedupe` cycles. pnpm's content-addressable store and strict symlink structure eliminates this class of problem entirely.

## Current State

- **Package manager:** npm@10.7.0 with `legacy-peer-deps=true` and `prefer-dedupe=true`
- **Workspaces:** 18 total (3 apps, 15 packages) declared in root `package.json` `workspaces` field
- **Lockfile:** `package-lock.json`
- **Patches:** `patch-package` with one patch (`@ai-sdk+google-vertex+3.0.81`)
- **Overrides:** `lodash`, `pdfjs-dist`, `typescript`, `zod` in root `package.json`
- **Syncpack:** installed but unconfigured (no `.syncpackrc`)
- **Heavy duplication:** `zod` in 7 workspaces, `ts-pattern` in 9, `luxon` in 8, `react` in 6, etc.
- **Docker:** `turbo prune` → `npm ci` → `npm ci --only=production` multi-stage build
- **Existing Dockerfiles:** `docker/Dockerfile` (primary, npm), `apps/remix/Dockerfile.pnpm` (already exists, needs review)

## Migration Steps

### Phase 1: Core Migration

#### Step 1: Enable pnpm via corepack

```bash
corepack enable pnpm
corepack use pnpm@latest
```

This adds a `"packageManager"` field to root `package.json` (e.g. `"packageManager": "pnpm@10.x.x"`). Remove the existing `"engines"` npm constraint if present.

#### Step 2: Create `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
```

Remove the `"workspaces"` field from root `package.json` — pnpm uses `pnpm-workspace.yaml` instead.

#### Step 3: Convert lockfile

```bash
pnpm import
```

This reads `package-lock.json` and generates `pnpm-lock.yaml`. After verifying, delete `package-lock.json`.

#### Step 4: Create `.npmrc` for pnpm

Replace the current `.npmrc` contents. The existing settings (`legacy-peer-deps=true`, `prefer-dedupe=true`) are npm-specific.

```ini
# Hoist packages that expect to be resolvable from any workspace.
# Start strict, add patterns here only as needed.
shamefully-hoist=true
```

> **Note:** `shamefully-hoist=true` is the pragmatic starting point. It mimics npm's flat `node_modules` layout. Once the migration is stable, this can be tightened to `hoist-pattern[]` entries for specific packages that need it, moving toward pnpm's strict isolation model.

#### Step 5: Clean install

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

Verify the install completes without errors. Fix any peer dependency warnings — pnpm is stricter than npm with `legacy-peer-deps=true`.

#### Step 6: Convert `overrides` to `pnpm.overrides`

In root `package.json`, move the `overrides` block under `pnpm`:

```json
{
  "pnpm": {
    "overrides": {
      "lodash": "4.17.23",
      "pdfjs-dist": "5.4.296",
      "typescript": "5.6.2",
      "zod": "^3.25.76"
    }
  }
}
```

Remove the top-level `overrides` field (that's npm-specific).

#### Step 7: Convert patch-package to pnpm patches

pnpm has native patching. Convert the existing `@ai-sdk+google-vertex+3.0.81` patch:

```bash
# Remove patch-package dependency and postinstall script
# Then use pnpm's native patching:
pnpm patch @ai-sdk/google-vertex@3.0.81
# Apply the same changes from patches/@ai-sdk+google-vertex+3.0.81.patch
pnpm patch-commit <temp-dir>
```

This adds a `pnpm.patchedDependencies` entry to root `package.json` and stores the patch in a `patches/` directory (pnpm's own format). Remove `patch-package` from dependencies and the `postinstall` script.

### Phase 2: Catalogs

#### Step 8: Identify catalog candidates

Packages duplicated across 3+ workspaces are prime candidates:

| Package                                         | Workspaces | Catalog?               |
| ----------------------------------------------- | ---------- | ---------------------- |
| `zod`                                           | 7          | Yes                    |
| `ts-pattern`                                    | 9          | Yes                    |
| `luxon`                                         | 8          | Yes                    |
| `react` / `react-dom`                           | 6 / 3      | Yes                    |
| `typescript`                                    | 6          | Yes                    |
| `nanoid`                                        | 4          | Yes                    |
| `@lingui/core` / `macro` / `react`              | 2-3        | Yes                    |
| `@simplewebauthn/server`                        | 3          | Yes                    |
| `@documenso/*` (internal)                       | varies     | No (use `workspace:*`) |
| `@aws-sdk/*`                                    | 2          | Yes                    |
| `hono`                                          | 2          | Yes                    |
| `posthog-node` / `posthog-js`                   | 2          | Yes                    |
| `remeda`                                        | 3          | Yes                    |
| `@tanstack/react-query`                         | 2          | Yes                    |
| `@trpc/*`                                       | 2          | Yes                    |
| `superjson`                                     | 2          | Yes                    |
| `kysely`                                        | 2          | Yes                    |
| `@types/react` / `@types/node` / `@types/luxon` | 3-4        | Yes                    |

#### Step 9: Define catalogs in `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*

catalog:
  # Core
  react: ^18
  react-dom: ^18
  typescript: 5.6.2
  zod: ^3.25.76

  # Shared utilities
  ts-pattern: <current-version>
  luxon: ^3.7.2
  nanoid: ^5.1.6
  remeda: <current-version>
  superjson: ^2.2.5

  # AWS
  '@aws-sdk/client-s3': ^3.998.0
  '@aws-sdk/client-sesv2': ^3.998.0
  '@aws-sdk/cloudfront-signer': ^3.998.0
  '@aws-sdk/s3-request-presigner': ^3.998.0
  '@aws-sdk/signature-v4-crt': ^3.998.0

  # Framework
  hono: 4.12.2
  '@tanstack/react-query': <current-version>
  '@trpc/client': 11.8.1
  '@trpc/react-query': 11.8.1
  '@trpc/server': 11.8.1

  # i18n
  '@lingui/core': ^5.6.0
  '@lingui/macro': ^5.6.0
  '@lingui/react': ^5.6.0

  # Auth
  '@simplewebauthn/server': <current-version>

  # Observability
  posthog-node: 4.18.0
  posthog-js: <current-version>

  # Database
  kysely: <current-version>
  '@prisma/client': ^6.19.0
  prisma: ^6.19.0

  # Types
  '@types/react': <current-version>
  '@types/react-dom': <current-version>
  '@types/node': ^20
  '@types/luxon': <current-version>
```

#### Step 10: Update workspace `package.json` files

Replace pinned versions with `catalog:` protocol for all cataloged packages:

```json
{
  "dependencies": {
    "zod": "catalog:",
    "ts-pattern": "catalog:",
    "luxon": "catalog:"
  }
}
```

This is a mechanical find-and-replace across all workspace `package.json` files.

### Phase 3: Internal Workspace References

#### Step 11: Convert internal references to `workspace:*`

All `@documenso/*` internal package references currently use `"*"`. Convert to pnpm's `workspace:*` protocol:

```json
{
  "dependencies": {
    "@documenso/lib": "workspace:*",
    "@documenso/prisma": "workspace:*"
  }
}
```

This makes the workspace resolution explicit and prevents accidental resolution to a published version.

### Phase 4: Docker & CI

#### Step 12: Update primary Dockerfile (`docker/Dockerfile`)

The existing multi-stage build needs to change:

1. **base:** Add pnpm — `corepack enable pnpm` or install via `npm i -g pnpm`
2. **builder:** `turbo prune` still works with pnpm. Output structure is the same.
3. **installer:**
   - Replace `npm ci` with `pnpm install --frozen-lockfile`
   - Copy `pnpm-lock.yaml` and `pnpm-workspace.yaml` instead of `package-lock.json`
   - Remove `patch-package` from postinstall (pnpm patches are applied natively)
4. **runner:**
   - Replace `npm ci --only=production` with `pnpm install --frozen-lockfile --prod`
   - Or use `pnpm deploy` for standalone output (copies only production deps to a flat directory)

Review `apps/remix/Dockerfile.pnpm` — it already exists and may have most of this solved. Reconcile with the primary `docker/Dockerfile`.

#### Step 13: Update CI workflows

Search for all `npm ci`, `npm install`, `npm run` in CI config files (`.github/workflows/`, etc.) and replace with `pnpm install --frozen-lockfile`, `pnpm run`, etc.

Ensure corepack is enabled in CI runners:

```yaml
- run: corepack enable pnpm
```

#### Step 14: Update turborepo config

Turbo works with pnpm out of the box. The `turbo.json` should not need changes. Verify `turbo prune` generates correct output with pnpm lockfile.

### Phase 5: Cleanup & Tighten

#### Step 15: Remove npm-specific tooling

- Remove `syncpack` (catalogs replace its purpose)
- Remove `patch-package` (pnpm native patches replace it)
- Remove `"workspaces"` from root `package.json` if not already done
- Delete `package-lock.json`
- Update `.gitignore` if needed (pnpm store is outside the repo by default)

#### Step 16: Tighten hoisting (optional, future)

Once stable, replace `shamefully-hoist=true` with targeted hoist patterns:

```ini
shamefully-hoist=false
hoist-pattern[]=*eslint*
hoist-pattern[]=*prettier*
# Add others as discovered
```

This moves toward strict isolation where each package can only import what it declares. Catches phantom dependency issues. Do this incrementally — let the bundler tell you what breaks.

#### Step 17: Remove root-level dependency hoisting

With catalogs and strict resolution, dependencies currently hoisted to root `package.json` for deduplication purposes can be moved back to the workspaces that actually use them. The root `package.json` should only contain tooling deps (`turbo`, `prettier`, `eslint`, etc.) and `pnpm.overrides`.

## Risks and Mitigations

1. **Phantom dependencies surface:** pnpm's strict isolation will expose imports that work today only because npm hoisted them. `shamefully-hoist=true` defers this, but tightening later will reveal them.
   - **Mitigation:** Start with `shamefully-hoist=true`. Tighten incrementally after the migration is stable.

2. **Peer dependency strictness:** pnpm enforces peer deps by default. The current `.npmrc` has `legacy-peer-deps=true` which suppresses all peer dep errors.
   - **Mitigation:** Run `pnpm install` and address peer dep warnings. Most will be resolvable by adding missing peer deps to the relevant workspace.

3. **Docker build breakage:** The `turbo prune` + `npm ci` pipeline is battle-tested. Switching to pnpm changes the install semantics.
   - **Mitigation:** The existing `Dockerfile.pnpm` in `apps/remix/` provides a reference. Test the Docker build in CI before merging.

4. **CI cache invalidation:** Switching lockfiles invalidates all CI dependency caches.
   - **Mitigation:** Update cache keys to use `pnpm-lock.yaml` hash. First CI run will be slower, subsequent runs will cache normally.

5. **Turbo + pnpm compatibility:** Turbo has first-class pnpm support, but `turbo prune` output format may differ slightly.
   - **Mitigation:** Test `turbo prune --scope=@documenso/remix --docker` and verify output structure before updating Dockerfile.

## Verification Checklist

- [ ] `pnpm install` succeeds with no errors
- [ ] `pnpm run build` succeeds (all workspaces)
- [ ] `pnpm run lint` passes
- [ ] `pnpm run dev` starts correctly
- [ ] Docker build produces a working image
- [ ] E2E tests pass (`pnpm run test:e2e`)
- [ ] No duplicate package copies in `node_modules` for key deps (`zod`, `react`, `typescript`)
- [ ] `pnpm audit` shows same or better results than current npm audit
- [ ] CI pipeline passes end-to-end
