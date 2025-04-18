# Enterprise Edition Stub Package

This package provides stub implementations for all Enterprise Edition features of Documenso. It allows the application to build and run without the proprietary Enterprise Edition code.

## Purpose

When forking Documenso, you don't have access to the proprietary Enterprise Edition code that handles billing, advanced features, and subscription management. This package provides minimal stub implementations that allow the codebase to compile and run without those features.

## Features Stubbed

- Billing and subscription management (Stripe integration)
- User and Team limits
- Enterprise-only features like advanced authentication

## Usage

The package is designed to be a drop-in replacement for `@documenso/ee`. All imports from `@documenso/ee` should be replaced with `@documenso/ee-stub`.

To automatically replace all imports in your codebase, run:

```bash
./scripts/replace-ee-imports.sh
```

Then make sure to run `bun install` to update dependencies.

## Implementation

All stub implementations follow a simple pattern:

- Billing features return success but don't do anything
- Limit checks return basic community plan limits
- Enterprise features are disabled

This allows the application to run without errors while disabling premium features.

## Environment Variables

Make sure to set `NEXT_PUBLIC_FEATURE_BILLING_ENABLED=false` in your `.env` file to ensure the application doesn't try to use billing features.
