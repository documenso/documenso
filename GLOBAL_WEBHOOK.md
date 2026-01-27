# Global Webhook Configuration

## Overview

SuiteOp Sign includes a **global webhook** feature that automatically sends webhook notifications to a specified URL for specific document events across ALL accounts on the platform. This allows the platform administrator to receive centralized notifications without requiring each user to configure their own webhooks.

## Configuration

### Environment Variables

You can configure the global webhook with the following environment variables:

```bash
# Webhook URL (required)
NEXT_PRIVATE_GLOBAL_WEBHOOK_URL=https://your-webhook-url.com/endpoint

# Webhook Secret for HMAC SHA256 signing (recommended)
NEXT_PRIVATE_GLOBAL_WEBHOOK_SECRET=your-secret-key-here
```

**Default values:**
- URL: `https://events.suiteop.com/jkhgcu4kx5sec3`
- Secret: Empty string (no signing)

### Events Triggered

The global webhook is automatically triggered for the following events:
- `DOCUMENT_SIGNED` - When a recipient signs a document
- `DOCUMENT_COMPLETED` - When all recipients have signed and the document is finalized

## Webhook Payload

When an event occurs, the global webhook receives a POST request with the following payload:

```json
{
  "event": "DOCUMENT_SIGNED" | "DOCUMENT_COMPLETED",
  "payload": {
    // Document data (see Webhook Payload Schema below)
  },
  "createdAt": "2025-10-28T16:00:00.000Z",
  "webhookEndpoint": "https://events.suiteop.com/jkhgcu4kx5sec3",
  "userId": 123,
  "teamId": 456
}
```

### Headers

The request includes the following headers:

```
Content-Type: application/json
X-SuiteOp-Global-Webhook: true
X-SuiteOp-Signature: <hmac-sha256-hex-signature>  (if secret is configured)
```

- **`X-SuiteOp-Global-Webhook`**: Identifies requests from the global webhook system
- **`X-SuiteOp-Signature`**: HMAC SHA256 signature of the request body (hex encoded). Only present if `NEXT_PRIVATE_GLOBAL_WEBHOOK_SECRET` is configured.

### Webhook Signature Verification

If you've configured a webhook secret, each request will include an `X-SuiteOp-Signature` header containing an HMAC SHA256 signature of the request body.

**To verify the signature:**

1. Get the raw request body as a string
2. Compute HMAC SHA256 using your secret key
3. Compare with the signature in the header

**Example verification (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(body, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  
  return signature === expectedSignature;
}

// In your webhook handler:
const body = await request.text(); // Get raw body as string
const signature = request.headers.get('X-SuiteOp-Signature');
const isValid = verifyWebhookSignature(body, signature, process.env.WEBHOOK_SECRET);

if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}

// Process the webhook...
```

## Webhook Payload Schema

The `payload` object contains detailed document information:

```typescript
{
  id: string;                    // Document ID
  title: string;                 // Document title
  status: string;                // Document status (e.g., "COMPLETED", "PENDING")
  documentData: {
    id: string;
    type: string;
    data: string;                // Base64 encoded document content (if applicable)
  };
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  completedAt: string | null;    // ISO 8601 timestamp or null
  recipients: Array<{
    id: number;
    email: string;
    name: string;
    role: string;                // e.g., "SIGNER", "CC", "VIEWER"
    signingStatus: string;       // e.g., "SIGNED", "PENDING"
    signedAt: string | null;     // ISO 8601 timestamp or null
  }>;
  userId: number;                // Owner user ID
  teamId: number | null;         // Team ID (if applicable)
}
```

## Implementation Details

### Code Changes

1. **Constants** (`packages/lib/constants/app.ts`):
   - Added `GLOBAL_WEBHOOK_URL` constant
   - Added `GLOBAL_WEBHOOK_EVENTS` constant array

2. **Webhook Handler** (`packages/lib/server-only/webhooks/trigger/handler.ts`):
   - Modified to check if event is `DOCUMENT_SIGNED` or `DOCUMENT_COMPLETED`
   - Automatically sends POST request to global webhook URL
   - Runs independently of user-configured webhooks
   - Includes error handling with console logging (failures are logged but don't block the main webhook flow)

### Error Handling

The global webhook implementation includes comprehensive error handling:
- Failed webhook calls are logged to the console
- Errors do not block user-configured webhooks
- Errors do not prevent the document operation from completing
- The global webhook call does not wait for a response (fire-and-forget)

## Testing

### Local Testing

To test the global webhook locally:

1. Set up a webhook receiver (e.g., using [webhook.site](https://webhook.site) or a local server)

2. Set the environment variable in your `.env` file:
   ```bash
   NEXT_PRIVATE_GLOBAL_WEBHOOK_URL=https://webhook.site/your-unique-url
   ```

3. Start the application:
   ```bash
   npm run dev
   ```

4. Create and complete a document signing flow

5. Check your webhook receiver for the POST request

### Production Testing

In production, ensure:
- The webhook URL is accessible from your server
- The receiving endpoint can handle the payload format
- The endpoint responds quickly (within a few seconds) to avoid timeouts
- You have monitoring in place to track webhook delivery success/failure

## Security Considerations

1. **Webhook Signing** (Recommended): 
   - Always configure `NEXT_PRIVATE_GLOBAL_WEBHOOK_SECRET` in production
   - Use a strong, randomly generated secret (32+ characters recommended)
   - Verify the `X-SuiteOp-Signature` header on every request
   - Reject requests with invalid or missing signatures

2. **Authentication**: Even with signature verification, the global webhook includes a custom header (`X-SuiteOp-Global-Webhook: true`) to identify legitimate requests.

3. **Data Sensitivity**: The webhook payload includes document details, recipient information, and user IDs. Ensure your webhook endpoint:
   - Uses HTTPS only
   - Verifies webhook signatures before processing
   - Stores data securely if persistence is required
   - Complies with data protection regulations (GDPR, etc.)

4. **Rate Limiting**: In high-volume scenarios, your webhook endpoint should handle rate limiting appropriately.

## Monitoring

To monitor global webhook delivery:
- Check application logs for "Global webhook failed:" messages
- Monitor your webhook endpoint for incoming requests
- Track webhook delivery rates and failures

## Disabling the Global Webhook

To disable the global webhook:

1. Set an invalid URL or empty string:
   ```bash
   NEXT_PRIVATE_GLOBAL_WEBHOOK_URL=""
   ```

2. Or modify the code to skip the webhook call entirely by commenting out the relevant section in `handler.ts`

## Troubleshooting

### Webhook Not Firing

1. Verify the event type is `DOCUMENT_SIGNED` or `DOCUMENT_COMPLETED`
2. Check application logs for errors
3. Ensure the webhook URL is accessible from your server
4. Verify DNS resolution for the webhook domain

### Payload Issues

1. Check that your endpoint can handle the JSON payload structure
2. Verify the `Content-Type` header is being parsed correctly
3. Ensure your endpoint can handle the payload size (documents can be large)

### Performance Issues

If webhook calls are slowing down document operations:
1. The webhook call is already non-blocking (fire-and-forget)
2. Consider moving to a queue-based system for high-volume scenarios
3. Optimize your webhook endpoint response time

## Migration Notes

If you're updating from a previous version:
- No database migrations required
- The feature is backward compatible
- Existing user-configured webhooks continue to work normally
- The global webhook runs in addition to (not instead of) user webhooks

