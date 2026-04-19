# SSO Interview Per Provider

Detailed prompts for step 2c. This fork ships with Microsoft/Entra SSO wired by default (via the CFN parameter `MicrosoftTenantId` + the secret keys `NEXT_PRIVATE_MICROSOFT_CLIENT_ID` / `_CLIENT_SECRET`). Google and generic OIDC work too — they just aren't CFN parameters, so you populate them via `secretsmanager put-secret-value` after deploy.

Redirect URIs for Documenso follow the next-auth pattern:

- Microsoft: `https://<DOMAIN>/api/auth/callback/microsoft`
- Google: `https://<DOMAIN>/api/auth/callback/google`
- Generic OIDC: `https://<DOMAIN>/api/auth/callback/oidc`

Any mismatch — trailing slash, wrong scheme, wrong path — breaks sign-in with unhelpful error messages.

## Microsoft / Entra (primary)

1. Ask: **"Have you registered an app in the Entra admin center?"** If no, walk them through it:
   - Entra admin center → App registrations → **New registration**
   - Supported account types: **Single tenant** (your org only) or **Multitenant** (anyone with a Microsoft account)
   - Redirect URI → Platform = Web, URL = `https://<DOMAIN>/api/auth/callback/microsoft`
   - Copy three values from the app overview:
     - Application (client) ID
     - Directory (tenant) ID — use `common` instead if you chose Multitenant
     - A client secret (Certificates & secrets → New client secret; copy the **Value**, not the Secret ID, immediately — it's only shown once)
   - API permissions → add `openid`, `profile`, `email` from Microsoft Graph delegated; grant admin consent
2. Prompt for:
   - `MICROSOFT_CLIENT_ID` — UUID format
   - `MICROSOFT_TENANT_ID` — UUID format (or `common` for multitenant)
   - `MICROSOFT_CLIENT_SECRET` — ~40-char string, the "Value" column
3. Validate: both UUIDs look like UUIDs and `CLIENT_ID != TENANT_ID`.

**Known issue (already handled):** Microsoft doesn't include `email_verified` in ID tokens by default. This fork sets `bypassEmailVerification: true` for Microsoft in `packages/auth/server/config.ts`. Don't revert it.

## Google

1. Ask: **"Have you registered an OAuth 2.0 Web application client in Google Cloud Console?"** If no:
   - Console → APIs & Services → Credentials → **Create OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `https://<DOMAIN>/api/auth/callback/google`
   - OAuth consent screen must be configured (Internal works for Google Workspace; External requires consent review for public use)
2. Prompt for:
   - `GOOGLE_CLIENT_ID` — ends in `.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` — starts with `GOCSPX-`
3. After deploy, add to the app-config secret:
   ```bash
   aws secretsmanager get-secret-value --secret-id "$APP_CONFIG_ARN" \
     --query SecretString --output text | jq \
     --arg cid "$GOOGLE_CLIENT_ID" --arg csec "$GOOGLE_CLIENT_SECRET" \
     '.NEXT_PRIVATE_GOOGLE_CLIENT_ID=$cid | .NEXT_PRIVATE_GOOGLE_CLIENT_SECRET=$csec' \
     | aws secretsmanager put-secret-value --secret-id "$APP_CONFIG_ARN" --secret-string file:///dev/stdin
   ```
   Then `aws ecs update-service ... --force-new-deployment`.

## Generic OIDC

1. Ask: **"Do you have the OAuth client ID, client secret, and the well-known discovery URL from your IdP?"** If no:
   - Application type: Web / Regular web app (authorization code flow)
   - Redirect URI: `https://<DOMAIN>/api/auth/callback/oidc`
   - Scopes: `openid`, `profile`, `email`
   - Find the provider's `.well-known/openid-configuration` — this is the single URL Documenso needs
2. Prompt for:
   - `OIDC_CLIENT_ID`
   - `OIDC_CLIENT_SECRET`
   - `OIDC_WELL_KNOWN` — the full discovery URL (e.g. `https://auth.example.com/.well-known/openid-configuration`)
3. After deploy, add to the app-config secret:
   - `NEXT_PRIVATE_OIDC_WELL_KNOWN`
   - `NEXT_PRIVATE_OIDC_CLIENT_ID`
   - `NEXT_PRIVATE_OIDC_CLIENT_SECRET`
   - Optional: `NEXT_PRIVATE_OIDC_SKIP_VERIFY=true` if your IdP doesn't emit `email_verified`

## Secret hygiene

- Treat all `*_CLIENT_SECRET` values carefully. Write to `.deploy.env` (gitignored), never echo in summaries (mask as `***`).
- Users can paste secrets in chat — that's acceptable since the prompt is local to their machine. Don't repeat them in response text after capture.
