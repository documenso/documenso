# V1 API Legacy Deprecation Specification

## Overview

Mark all V1 API endpoints as legacy/deprecated in the OpenAPI documentation to signal that users should migrate to the V2 API.

## Decision Summary

| Decision | Choice |
|----------|--------|
| Deprecation Scope | All V1 endpoints |
| Message Style | Generic for all endpoints |
| Sunset Timeline | No specific date |
| V2 API Status | V2 exists now |
| OpenAPI Info | Update to include deprecation notice |

## Implementation Details

### Files to Modify

1. `packages/api/v1/contract.ts` - Add `deprecated: true` and `description` to all endpoints
2. `packages/api/v1/openapi.ts` - Update the OpenAPI info description

### Documentation Files to Modify

1. `apps/documentation/pages/developers/public-api/index.mdx` - Add deprecation `<Callout type="warning">` under "API V1 - Deprecated" section:
   ```
   <Callout type="warning">
     V1 API is deprecated and will be removed in a future release. Please migrate to V2.
   </Callout>
   ```

2. `apps/documentation/pages/developers/public-api/versioning.mdx` - Add callout after "current version is v2" stating V1 is deprecated:
   ```
   <Callout type="warning">
     V1 API is deprecated. Please migrate to V2.
   </Callout>
   ```

### Deprecation Message

**Per-endpoint message:**
```
Deprecated. Please migrate to the V2 API.
```

**OpenAPI info description:**
```
[DEPRECATED] The Documenso API for retrieving, creating, updating and deleting documents. Please migrate to V2.
```

### Endpoints to Update (19 total)

| Endpoint | Method | Path | Action |
|----------|--------|------|--------|
| getDocuments | GET | /api/v1/documents | Add deprecation |
| getDocument | GET | /api/v1/documents/:id | Add deprecation |
| downloadSignedDocument | GET | /api/v1/documents/:id/download | Add deprecation |
| createDocument | POST | /api/v1/documents | Add deprecation |
| createTemplate | POST | /api/v1/templates | Add deprecation |
| deleteTemplate | DELETE | /api/v1/templates/:id | Add deprecation |
| getTemplate | GET | /api/v1/templates/:id | Add deprecation |
| getTemplates | GET | /api/v1/templates | Add deprecation |
| createDocumentFromTemplate | POST | /api/v1/templates/:templateId/create-document | Update existing deprecation message |
| generateDocumentFromTemplate | POST | /api/v1/templates/:templateId/generate-document | Add deprecation |
| sendDocument | POST | /api/v1/documents/:id/send | Add deprecation |
| resendDocument | POST | /api/v1/documents/:id/resend | Add deprecation |
| deleteDocument | DELETE | /api/v1/documents/:id | Add deprecation |
| createRecipient | POST | /api/v1/documents/:id/recipients | Add deprecation |
| updateRecipient | PATCH | /api/v1/documents/:id/recipients/:recipientId | Add deprecation |
| deleteRecipient | DELETE | /api/v1/documents/:id/recipients/:recipientId | Add deprecation |
| createField | POST | /api/v1/documents/:id/fields | Add deprecation |
| updateField | PATCH | /api/v1/documents/:id/fields/:fieldId | Add deprecation |
| deleteField | DELETE | /api/v1/documents/:id/fields/:fieldId | Add deprecation |

## Changes Required

### contract.ts Changes

For each endpoint, add:
```typescript
deprecated: true,
description: 'Deprecated. Please migrate to the V2 API.',
```

For endpoints that already have a description, prepend the deprecation notice.

### openapi.ts Changes

Update the info block description from:
```typescript
description: 'The Documenso API for retrieving, creating, updating and deleting documents.',
```
to:
```typescript
description: '[DEPRECATED] The Documenso API for retrieving, creating, updating and deleting documents. Please migrate to V2.',
```

## Notes

- The `createDocumentFromTemplate` endpoint's existing deprecation message (pointing to `generateDocumentFromTemplate`) will be replaced with the generic V2 migration message
- No sunset date is included - endpoints are marked deprecated but without a removal timeline
- The V2 API is available and ready for users to migrate to
