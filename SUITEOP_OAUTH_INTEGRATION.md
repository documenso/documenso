# SuiteOp OAuth Integration Guide

**Date:** November 11, 2025  
**Feature:** Custom OAuth flow for SuiteOp to connect with SuiteOp Sign  
**Status:** ✅ Complete

---

## Overview

This document describes how to integrate SuiteOp (app.suiteop.com) with SuiteOp Sign using a custom OAuth flow. The integration allows SuiteOp users to connect their SuiteOp Sign account to a specific team, creating a permanent API token for programmatic access.

---

## Architecture

### Flow Diagram

```
SuiteOp App (app.suiteop.com)
         ↓
    Redirects user to SuiteOp Sign
         ↓
SuiteOp Sign Authorization Page
    (/oauth/suiteop/authorize)
         ↓
    User selects team
         ↓
    Creates API token + claim code
         ↓
    Redirects back to SuiteOp
    (with claim code)
         ↓
SuiteOp App exchanges claim code
    (POST /api/v1/oauth/suiteop/code)
         ↓
    Receives permanent API token
         ↓
    Uses token for API calls
```

---

## Prerequisites

### Environment Variables

Add these to your `.env` file:

```bash
# SuiteOp OAuth Configuration
NEXT_PRIVATE_SUITEOP_MASTER_KEY=your-secure-master-key-here
NEXT_PRIVATE_SUITEOP_REDIRECT_URL=https://app.suiteop.com/oauth/callback
```

**Important:**
- `NEXT_PRIVATE_SUITEOP_MASTER_KEY`: A secure random string used to authenticate SuiteOp's requests
- `NEXT_PRIVATE_SUITEOP_REDIRECT_URL`: Default fallback redirect URL (used if `redirectUrl` parameter is not provided or invalid). Must be on `app.suiteop.com` domain.

---

## Integration Steps

### Step 1: Initiate OAuth Flow

From SuiteOp app, redirect the user to SuiteOp Sign:

```
GET https://sign.suiteop.com/oauth/suiteop/authorize?state=<optional-state>&redirectUrl=<optional-redirect-url>
```

**Parameters:**
- `state` (optional): A string that will be returned in the callback. Useful for maintaining session state.
- `redirectUrl` (optional): The URL where the user should be redirected after authorization. **Must be on `app.suiteop.com` domain**. If not provided, defaults to `https://app.suiteop.com/oauth/callback`.

**Example:**
```javascript
const state = generateRandomState(); // Your own state generation
const redirectUrl = encodeURIComponent('https://app.suiteop.com/oauth/callback');
const authUrl = `https://sign.suiteop.com/oauth/suiteop/authorize?state=${state}&redirectUrl=${redirectUrl}`;
window.location.href = authUrl;
```

**Redirect URL Validation:**
- Must be a valid URL
- Must be on the `app.suiteop.com` domain (exact match required)
- Any path on `app.suiteop.com` is acceptable (e.g., `/oauth/callback`, `/settings/integrations`, etc.)
- If invalid or not provided, defaults to `https://app.suiteop.com/oauth/callback`

---

### Step 2: User Authorization

The user will see one of three screens on SuiteOp Sign:

1. **No Teams**: Prompt to create a team first
2. **Single Team**: Auto-select that team
3. **Multiple Teams**: Radio button selection

After selection, SuiteOp Sign will:
- Create a permanent API token for the selected team
- Generate a claim code (valid for 15 minutes)
- Redirect back to SuiteOp with the claim code

**Callback URL Format:**
```
<redirectUrl>?code=<claim-code>&state=<original-state>
```

Where `<redirectUrl>` is either:
- The `redirectUrl` parameter provided in Step 1 (if valid)
- Default: `https://app.suiteop.com/oauth/callback` (if not provided or invalid)

---

### Step 3: Exchange Claim Code for API Token

SuiteOp must exchange the claim code for the actual API token within 15 minutes.

**Endpoint:** `POST /api/v1/oauth/suiteop/code`

**Request Headers:**
```
Content-Type: application/json
x-suiteop-master-key: <NEXT_PRIVATE_SUITEOP_MASTER_KEY>
```

**Request Body:**
```json
{
  "claimCode": "claim_abc123xyz..."
}
```

**Response (200 OK):**
```json
{
  "token": "api_token_abc123...",
  "teamId": 42,
  "teamName": "My Team"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid master key
- `404 Not Found`: Invalid or expired claim code
- `400 Bad Request`: Claim code already used

**Example (JavaScript):**
```javascript
async function exchangeClaimCode(claimCode) {
  const response = await fetch('https://sign.suiteop.com/api/v1/oauth/suiteop/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-suiteop-master-key': process.env.SUITEOP_MASTER_KEY,
    },
    body: JSON.stringify({ claimCode }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange claim code: ${response.status}`);
  }

  const data = await response.json();
  return data; // { token, teamId, teamName }
}
```

---

### Step 4: Store API Token Securely

Store the API token securely in your database, associated with the SuiteOp user account.

**Important:**
- The token is permanent (does not expire)
- The token provides full API access to the team
- Store it encrypted/hashed if possible
- Never expose it in client-side code

---

### Step 5: Use API Token for API Calls

Use the stored token to make authenticated API requests to SuiteOp Sign.

**Example:**
```javascript
async function getTeamInfo(apiToken) {
  const response = await fetch('https://sign.suiteop.com/api/v1/oauth/suiteop/info', {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
    },
  });

  const data = await response.json();
  return data; // { teamId, teamName, valid: true }
}
```

---

## API Endpoints Reference

### 1. Get Code (Exchange Claim Code)

**Endpoint:** `POST /api/v1/oauth/suiteop/code`

**Authentication:** Master key (`x-suiteop-master-key` header)

**Request:**
```json
{
  "claimCode": "claim_abc123..."
}
```

**Response:**
```json
{
  "token": "api_token_...",
  "teamId": 42,
  "teamName": "My Team"
}
```

---

### 2. Get Info (Validate Token)

**Endpoint:** `GET /api/v1/oauth/suiteop/info`

**Authentication:** API token (`Authorization: Bearer <token>` header)

**Response:**
```json
{
  "teamId": 42,
  "teamName": "My Team",
  "valid": true
}
```

**Use Cases:**
- Validate token is still active
- Get team information
- Check if integration is still connected

---

## Security Considerations

### Master Key Security

- **Never** expose the master key in client-side code
- Store it as an environment variable on your server
- Rotate it periodically if compromised
- Use a strong random string (minimum 32 characters)

### API Token Security

- **Never** expose API tokens in client-side code
- Store tokens encrypted in your database
- Implement token rotation if needed
- Monitor token usage for suspicious activity

### Claim Code Security

- Claim codes expire after 15 minutes
- Claim codes can only be used once
- Claim codes are only valid when exchanged with the correct master key

---

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|-----------|-------------|----------|
| 401 | Invalid master key | Check `NEXT_PRIVATE_SUITEOP_MASTER_KEY` matches |
| 404 | Invalid claim code | Code expired or already used |
| 400 | Bad request | Invalid request format |

### Claim Code Expiration

If a claim code expires (15 minutes), the user must restart the OAuth flow from Step 1.

---

## Database Schema

The following table is created for OAuth tracking:

**`SuiteOpAuthorization`**
- `id`: Primary key
- `claimCode`: Unique claim code (indexed)
- `expiresAt`: Expiration timestamp
- `claimed`: Boolean flag (prevents reuse)
- `userId`: User who authorized
- `teamId`: Team connected
- `apiTokenId`: Reference to API token
- `plaintextToken`: Temporary storage (cleared after claiming)

---

## Testing

### Local Development

1. Set environment variables in `.env.local`
2. Start SuiteOp Sign: `npm run dev`
3. Test OAuth flow:
   ```
   http://localhost:3000/oauth/suiteop/authorize?state=test123
   ```
4. Use a tool like Postman to exchange claim codes

### Production Checklist

- [ ] Master key is set and secure
- [ ] Redirect URL is configured correctly
- [ ] SSL/TLS is enabled
- [ ] Error handling is implemented
- [ ] Token storage is secure
- [ ] Logging is in place for debugging

---

## Troubleshooting

### User sees "No Teams Found"

**Solution:** User must create a team first at `/o/new/teams`

### Claim code expires before exchange

**Solution:** Implement claim code exchange immediately after redirect (within 15 minutes)

### Invalid redirect URL error

**Solution:** Ensure the `redirectUrl` parameter is a valid URL on the `app.suiteop.com` domain. The redirect URL must exactly match `app.suiteop.com` (not `www.app.suiteop.com` or any subdomain).

### Master key authentication fails

**Solution:** Verify master key matches exactly (no extra spaces, correct environment variable)

---

## Support

For issues or questions:
1. Check error responses for specific error codes
2. Review server logs for detailed error messages
3. Verify environment variables are set correctly
4. Ensure database migrations are applied

---

## Changelog

**v1.0.0** (November 11, 2025)
- Initial OAuth implementation
- Custom claim code flow
- Master key authentication
- Team selection UI

---

## Feature Impact Confirmation

✅ **All existing features remain unchanged**

The OAuth implementation is completely isolated and does not affect any existing functionality:

- ✅ Document signing workflows unchanged
- ✅ API endpoints unchanged (except new SuiteOp endpoints)
- ✅ Authentication system unchanged
- ✅ Team management unchanged
- ✅ User management unchanged
- ✅ Webhook system unchanged
- ✅ Email templates unchanged
- ✅ All existing routes unchanged

**Only Changes Made:**
1. **New OAuth flow** - Added `/oauth/suiteop/authorize` route
2. **New API endpoints** - Added `/api/v1/oauth/suiteop/code` and `/api/v1/oauth/suiteop/info`
3. **New database table** - `SuiteOpAuthorization` (for OAuth tracking only)
4. **Bug fixes** - Fixed corrupted cookie handling and meta tag hydration issues

**Files Modified:**
- `packages/prisma/schema.prisma` - Added `SuiteOpAuthorization` model
- `packages/lib/server-only/suiteop/` - New OAuth helper functions
- `packages/api/v1/` - Added SuiteOp endpoints
- `apps/remix/app/routes/_authenticated+/oauth.suiteop.authorize.tsx` - New route
- `apps/remix/app/root.tsx` - Bug fixes only (cookie handling, meta tags)
- `packages/lib/constants/app.ts` - Added OAuth environment variables

