---
date: 2026-01-14
title: Simplewebauthn V13 Upgrade
---

## Overview

Upgrade SimpleWebAuthn packages from v9.x to v13.x to address the deprecation of `@simplewebauthn/types` and take advantage of new features and improvements.

## Current State

The codebase currently uses:
- `@simplewebauthn/browser@9.x`
- `@simplewebauthn/server@9.x`
- `@simplewebauthn/types@9.x`

## Breaking Changes Summary (v9 → v13)

### v10.0.0 Breaking Changes
1. **Minimum Node version raised to Node v20**
2. **`generateRegistrationOptions()` now expects `Base64URLString` for `excludeCredentials` IDs** (no more `type: 'public-key'` needed)
3. **`generateAuthenticationOptions()` now expects `Base64URLString` for `allowCredentials` IDs**
4. **`credentialID` returned from verification methods is now `Base64URLString`** instead of `Uint8Array`
5. **`AuthenticatorDevice.credentialID` is now `Base64URLString`**
6. **`rpID` is now required when calling `generateAuthenticationOptions()`**
7. **`generateRegistrationOptions()` will generate random user IDs** if not provided
8. **`user.id` is treated as base64url string in `startRegistration()`**
9. **`userHandle` is treated as base64url string in `startAuthentication()`**

### v11.0.0 Breaking Changes
1. **Positional arguments in `startRegistration()` and `startAuthentication()` replaced by object**
   - Before: `startRegistration(options)`
   - After: `startRegistration({ optionsJSON: options })`
   - Before: `startAuthentication(options)`
   - After: `startAuthentication({ optionsJSON: options })`
2. **`AuthenticatorDevice` type renamed to `WebAuthnCredential`**
   - `credentialID` → `credential.id`
   - `credentialPublicKey` → `credential.publicKey`
3. **`verifyRegistrationResponse()` returns `registrationInfo.credential` instead of individual properties**
   - `credentialID` → `credential.id`
   - `credentialPublicKey` → `credential.publicKey`
   - `counter` → `credential.counter`
   - `transports` are now in `credential.transports`
4. **`verifyAuthenticationResponse()` uses `credential` argument instead of `authenticator`**

### v13.0.0 Breaking Changes
1. **`@simplewebauthn/types` package is retired**
   - Types are now exported from `@simplewebauthn/browser` and `@simplewebauthn/server`
   - Import types from `@simplewebauthn/server` instead

## Files to Update

### Package Changes
1. Remove `@simplewebauthn/types` dependency
2. Update `@simplewebauthn/browser` to `^13.2.2`
3. Update `@simplewebauthn/server` to `^13.2.2`

### Server-side Files

#### 1. `packages/lib/server-only/auth/create-passkey-registration-options.ts`
- Change import from `@simplewebauthn/types` to `@simplewebauthn/server`
- Remove `type: 'public-key'` from `excludeCredentials` items
- Update `userID` to use `isoUint8Array.fromUTF8String()` for proper encoding

#### 2. `packages/lib/server-only/auth/create-passkey-authentication-options.ts`
- Change import from `@simplewebauthn/types` to `@simplewebauthn/server`
- Remove `type: 'public-key'` from `allowCredentials` items

#### 3. `packages/lib/server-only/auth/create-passkey-signin-options.ts`
- No changes needed (already using correct options)

#### 4. `packages/lib/server-only/auth/create-passkey.ts`
- Change import from `@simplewebauthn/types` to `@simplewebauthn/server`
- Update to use new `registrationInfo.credential` structure:
  - `credentialID` → `credential.id`
  - `credentialPublicKey` → `credential.publicKey`
  - `counter` → `credential.counter`
- Note: `credential.id` is now a `Base64URLString`, so `Buffer.from(credentialID)` needs updating

#### 5. `packages/lib/server-only/document/is-recipient-authorized.ts`
- Update `verifyAuthenticationResponse()` to use `credential` instead of `authenticator`:
  - Change `authenticator: { credentialID, credentialPublicKey, counter }` to `credential: { id, publicKey, counter }`
- Since `credential.id` is now base64url string, convert stored `credentialId` buffer to base64url

#### 6. `packages/auth/server/routes/passkey.ts`
- Update `verifyAuthenticationResponse()` to use `credential` instead of `authenticator`
- Same changes as `is-recipient-authorized.ts`

#### 7. `packages/trpc/server/auth-router/create-passkey.ts`
- Change import from `@simplewebauthn/types` to `@simplewebauthn/server`

### Browser-side Files

#### 8. `apps/remix/app/components/dialogs/passkey-create-dialog.tsx`
- Update `startRegistration()` call:
  - Before: `startRegistration(passkeyRegistrationOptions)`
  - After: `startRegistration({ optionsJSON: passkeyRegistrationOptions })`

#### 9. `apps/remix/app/components/forms/signin.tsx`
- Update `startAuthentication()` call:
  - Before: `startAuthentication(options)`
  - After: `startAuthentication({ optionsJSON: options })`

#### 10. `apps/remix/app/components/general/document-signing/document-signing-auth-passkey.tsx`
- Update `startAuthentication()` call:
  - Before: `startAuthentication(options)`
  - After: `startAuthentication({ optionsJSON: options })`

### Database/Schema Considerations

The database stores `credentialId` as `Bytes`. The new API returns `credential.id` as `Base64URLString`. We need to:
1. When **storing** a new passkey: Convert from `Base64URLString` to `Buffer`
2. When **passing to verification**: Convert from `Buffer` to `Base64URLString`

Use `isoBase64URL` helper from `@simplewebauthn/server/helpers` for these conversions.

## Implementation Steps

### Step 1: Update package.json dependencies
```bash
npm uninstall @simplewebauthn/types
npm install @simplewebauthn/browser@^13.2.2 @simplewebauthn/server@^13.2.2
```

### Step 2: Update type imports
Replace all `@simplewebauthn/types` imports with `@simplewebauthn/server`

### Step 3: Update browser-side API calls
- `startRegistration(options)` → `startRegistration({ optionsJSON: options })`
- `startAuthentication(options)` → `startAuthentication({ optionsJSON: options })`

### Step 4: Update server-side registration
- Update `excludeCredentials` format (remove `type: 'public-key'`)
- Update `userID` encoding if needed
- Update `verifyRegistrationResponse()` result handling for new `credential` structure

### Step 5: Update server-side authentication
- Update `allowCredentials` format (remove `type: 'public-key'`)
- Update `verifyAuthenticationResponse()` to use `credential` instead of `authenticator`
- Handle `Base64URLString` for `credential.id`

### Step 6: Update credential storage/retrieval
- When storing: Convert `Base64URLString` to `Buffer`
- When reading: Convert `Buffer` to `Base64URLString`

### Step 7: Test passkey flows
1. Test passkey creation
2. Test passkey sign-in
3. Test passkey authentication for document signing
4. Test passkey deletion

## Code Examples

### Converting stored Buffer to Base64URLString for verification
```typescript
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// When reading from database (Buffer) and passing to verification
const credential = {
  id: isoBase64URL.fromBuffer(passkey.credentialId),
  publicKey: new Uint8Array(passkey.credentialPublicKey),
  counter: Number(passkey.counter),
  transports: passkey.transports,
};
```

### Converting Base64URLString to Buffer for storage
```typescript
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// When storing from registration response
const credentialIdBuffer = Buffer.from(
  isoBase64URL.toBuffer(registrationInfo.credential.id)
);
```

## Risks and Mitigations

1. **Database compatibility**: The `credentialId` is stored as `Bytes` in the database. The new API uses `Base64URLString`. We need proper conversion functions.
   - **Mitigation**: Use `isoBase64URL.fromBuffer()` and `isoBase64URL.toBuffer()` for conversions

2. **Existing passkeys**: Existing passkeys should continue to work as long as conversion is done correctly.
   - **Mitigation**: Test with existing passkeys after upgrade

3. **Browser compatibility**: v10+ requires newer browser APIs.
   - **Mitigation**: `browserSupportsWebAuthn()` already handles this check