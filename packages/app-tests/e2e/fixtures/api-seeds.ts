/**
 * API V2-based seed fixtures for E2E tests.
 *
 * These fixtures create documents, templates, envelopes, recipients, fields,
 * and folders through the API V2 endpoints instead of direct Prisma calls.
 * This ensures all creation-time side effects (PDF normalization, field meta
 * defaults, etc.) are exercised the same way a real user would trigger them.
 *
 * Usage:
 *   import { apiSeedDraftDocument, apiSeedPendingDocument, ... } from '../fixtures/api-seeds';
 *
 *   test('my test', async ({ request }) => {
 *     const { envelope, token, user, team } = await apiSeedDraftDocument(request, {
 *       title: 'My Document',
 *       recipients: [{ email: 'signer@example.com', name: 'Signer', role: 'SIGNER' }],
 *     });
 *   });
 */
import { type APIRequestContext, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type {
  TDistributeEnvelopeRequest,
  TDistributeEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/distribute-envelope.types';
import type { TCreateEnvelopeRecipientsResponse } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiRecipient = {
  email: string;
  name?: string;
  role?: 'SIGNER' | 'APPROVER' | 'VIEWER' | 'CC' | 'ASSISTANT';
  signingOrder?: number;
  accessAuth?: string[];
  actionAuth?: string[];
};

export type ApiField = {
  recipientId: number;
  envelopeItemId?: string;
  type: string;
  page?: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  fieldMeta?: Record<string, unknown>;
  placeholder?: string;
  matchAll?: boolean;
};

export type ApiSeedContext = {
  user: Awaited<ReturnType<typeof seedUser>>['user'];
  team: Awaited<ReturnType<typeof seedUser>>['team'];
  token: string;
};

export type ApiSeedEnvelopeOptions = {
  title?: string;
  type?: 'DOCUMENT' | 'TEMPLATE';
  externalId?: string;
  visibility?: string;
  globalAccessAuth?: string[];
  globalActionAuth?: string[];
  folderId?: string;
  pdfFile?: { name: string; data: Buffer };
  meta?: TCreateEnvelopePayload['meta'];
  recipients?: Array<
    ApiRecipient & {
      fields?: Array<{
        type: string;
        identifier?: string | number;
        page?: number;
        positionX?: number;
        positionY?: number;
        width?: number;
        height?: number;
        fieldMeta?: Record<string, unknown>;
      }>;
    }
  >;
};

// ---------------------------------------------------------------------------
// Core API helpers (low-level)
// ---------------------------------------------------------------------------

/**
 * Create a fresh user + team + API token for test isolation.
 * Every high-level seed function calls this internally, but you can also
 * call it directly if you need the context for multiple operations.
 */
export const apiCreateTestContext = async (tokenName = 'e2e-seed'): Promise<ApiSeedContext> => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName,
    expiresIn: null,
  });

  return { user, team, token };
};

const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Create an envelope via API V2 with a PDF file attached.
 *
 * This is the lowest-level envelope creation function. It creates the
 * envelope with optional inline recipients and fields in a single call.
 */
export const apiCreateEnvelope = async (
  request: APIRequestContext,
  token: string,
  options: ApiSeedEnvelopeOptions = {},
): Promise<TCreateEnvelopeResponse> => {
  const {
    title = '[TEST] API Seeded Envelope',
    type = 'DOCUMENT',
    externalId,
    visibility,
    globalAccessAuth,
    globalActionAuth,
    folderId,
    pdfFile,
    meta,
    recipients,
  } = options;

  // Build payload as a plain object. The API receives this as a JSON string
  // inside multipart form data, so strict TypeScript union narrowing is not
  // required - the server validates with Zod at runtime.
  const payload: Record<string, unknown> = {
    title,
    type,
  };

  if (externalId !== undefined) {
    payload.externalId = externalId;
  }

  if (visibility !== undefined) {
    payload.visibility = visibility;
  }

  if (globalAccessAuth !== undefined) {
    payload.globalAccessAuth = globalAccessAuth;
  }

  if (globalActionAuth !== undefined) {
    payload.globalActionAuth = globalActionAuth;
  }

  if (folderId !== undefined) {
    payload.folderId = folderId;
  }

  if (meta !== undefined) {
    payload.meta = meta;
  }

  if (recipients !== undefined) {
    payload.recipients = recipients.map((r) => {
      const recipientPayload: Record<string, unknown> = {
        email: r.email,
        name: r.name ?? r.email,
        role: r.role ?? 'SIGNER',
      };

      if (r.signingOrder !== undefined) {
        recipientPayload.signingOrder = r.signingOrder;
      }

      if (r.accessAuth !== undefined) {
        recipientPayload.accessAuth = r.accessAuth;
      }

      if (r.actionAuth !== undefined) {
        recipientPayload.actionAuth = r.actionAuth;
      }

      if (r.fields !== undefined) {
        recipientPayload.fields = r.fields.map((f) => {
          const fieldPayload: Record<string, unknown> = {
            type: f.type,
            page: f.page ?? 1,
            positionX: f.positionX ?? 10,
            positionY: f.positionY ?? 10,
            width: f.width ?? 15,
            height: f.height ?? 5,
          };

          if (f.identifier !== undefined) {
            fieldPayload.identifier = f.identifier;
          }

          if (f.fieldMeta !== undefined) {
            fieldPayload.fieldMeta = f.fieldMeta;
          }

          return fieldPayload;
        });
      }

      return recipientPayload;
    });
  }

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));

  const pdf = pdfFile ?? { name: 'example.pdf', data: examplePdfBuffer };
  formData.append('files', new File([pdf.data], pdf.name, { type: 'application/pdf' }));

  const res = await request.post(`${API_BASE_URL}/envelope/create`, {
    headers: authHeader(token),
    multipart: formData,
  });

  expect(res.ok(), `envelope/create failed: ${await res.text()}`).toBeTruthy();

  return (await res.json()) as TCreateEnvelopeResponse;
};

/**
 * Get full envelope data via API V2.
 */
export const apiGetEnvelope = async (
  request: APIRequestContext,
  token: string,
  envelopeId: string,
): Promise<TGetEnvelopeResponse> => {
  const res = await request.get(`${API_BASE_URL}/envelope/${envelopeId}`, {
    headers: authHeader(token),
  });

  expect(res.ok(), `envelope/get failed: ${await res.text()}`).toBeTruthy();

  return (await res.json()) as TGetEnvelopeResponse;
};

/**
 * Add recipients to an existing envelope via API V2.
 */
export const apiCreateRecipients = async (
  request: APIRequestContext,
  token: string,
  envelopeId: string,
  recipients: ApiRecipient[],
): Promise<TCreateEnvelopeRecipientsResponse> => {
  const data = {
    envelopeId,
    data: recipients.map((r) => {
      const recipientPayload: Record<string, unknown> = {
        email: r.email,
        name: r.name ?? r.email,
        role: r.role ?? 'SIGNER',
      };

      if (r.signingOrder !== undefined) {
        recipientPayload.signingOrder = r.signingOrder;
      }

      if (r.accessAuth !== undefined) {
        recipientPayload.accessAuth = r.accessAuth;
      }

      if (r.actionAuth !== undefined) {
        recipientPayload.actionAuth = r.actionAuth;
      }

      return recipientPayload;
    }),
  };

  const res = await request.post(`${API_BASE_URL}/envelope/recipient/create-many`, {
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    data,
  });

  expect(res.ok(), `recipient/create-many failed: ${await res.text()}`).toBeTruthy();

  return (await res.json()) as TCreateEnvelopeRecipientsResponse;
};

/**
 * Add fields to an existing envelope via API V2.
 *
 * If `recipientId` is not set on fields, the first recipient is used.
 * If `envelopeItemId` is not set, the first envelope item is used.
 */
export const apiCreateFields = async (
  request: APIRequestContext,
  token: string,
  envelopeId: string,
  fields: ApiField[],
): Promise<void> => {
  // Build as plain object - the deeply discriminated union types for fields
  // (type + fieldMeta combinations) are validated by Zod on the server.
  const data = {
    envelopeId,
    data: fields.map((f) => {
      const fieldPayload: Record<string, unknown> = {
        recipientId: f.recipientId,
        type: f.type,
      };

      if (f.envelopeItemId !== undefined) {
        fieldPayload.envelopeItemId = f.envelopeItemId;
      }

      if (f.fieldMeta !== undefined) {
        fieldPayload.fieldMeta = f.fieldMeta;
      }

      if (f.placeholder) {
        fieldPayload.placeholder = f.placeholder;

        if (f.width !== undefined) {
          fieldPayload.width = f.width;
        }

        if (f.height !== undefined) {
          fieldPayload.height = f.height;
        }

        if (f.matchAll !== undefined) {
          fieldPayload.matchAll = f.matchAll;
        }
      } else {
        fieldPayload.page = f.page ?? 1;
        fieldPayload.positionX = f.positionX ?? 10;
        fieldPayload.positionY = f.positionY ?? 10;
        fieldPayload.width = f.width ?? 15;
        fieldPayload.height = f.height ?? 5;
      }

      return fieldPayload;
    }),
  };

  const res = await request.post(`${API_BASE_URL}/envelope/field/create-many`, {
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    data,
  });

  expect(res.ok(), `field/create-many failed: ${await res.text()}`).toBeTruthy();
};

/**
 * Distribute (send) an envelope via API V2.
 * Returns the distribute response which includes signing URLs for recipients.
 */
export const apiDistributeEnvelope = async (
  request: APIRequestContext,
  token: string,
  envelopeId: string,
  meta?: TDistributeEnvelopeRequest['meta'],
): Promise<TDistributeEnvelopeResponse> => {
  const data: TDistributeEnvelopeRequest = {
    envelopeId,
    ...(meta !== undefined && { meta }),
  };

  const res = await request.post(`${API_BASE_URL}/envelope/distribute`, {
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    data,
  });

  expect(res.ok(), `envelope/distribute failed: ${await res.text()}`).toBeTruthy();

  return (await res.json()) as TDistributeEnvelopeResponse;
};

/**
 * Create a folder via API V2.
 */
export const apiCreateFolder = async (
  request: APIRequestContext,
  token: string,
  options: {
    name?: string;
    parentId?: string;
    type?: 'DOCUMENT' | 'TEMPLATE';
  } = {},
): Promise<{ id: string; name: string }> => {
  const { name = 'Test Folder', parentId, type } = options;

  const res = await request.post(`${API_BASE_URL}/folder/create`, {
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    data: {
      name,
      ...(parentId !== undefined && { parentId }),
      ...(type !== undefined && { type }),
    },
  });

  expect(res.ok(), `folder/create failed: ${await res.text()}`).toBeTruthy();

  return (await res.json()) as { id: string; name: string };
};

/**
 * Create a direct template link via API V2.
 */
export const apiCreateDirectTemplateLink = async (
  request: APIRequestContext,
  token: string,
  templateId: number,
  directRecipientId?: number,
): Promise<{ id: number; token: string; enabled: boolean; directTemplateRecipientId: number }> => {
  const res = await request.post(`${API_BASE_URL}/template/direct/create`, {
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    data: {
      templateId,
      ...(directRecipientId !== undefined && { directRecipientId }),
    },
  });

  expect(res.ok(), `template/direct/create failed: ${await res.text()}`).toBeTruthy();

  return await res.json();
};

// ---------------------------------------------------------------------------
// High-level seed functions (composites)
// ---------------------------------------------------------------------------

export type ApiSeedResult = {
  /** The created envelope/document/template. */
  envelope: TGetEnvelopeResponse;
  /** API token for further API calls. */
  token: string;
  /** The seeded user. */
  user: ApiSeedContext['user'];
  /** The seeded team. */
  team: ApiSeedContext['team'];
};

export type ApiSeedDocumentOptions = {
  /** Document title. Default: '[TEST] API Document - Draft' */
  title?: string;
  /** Recipients to add to the document. */
  recipients?: ApiRecipient[];
  /** Fields to add per recipient. If provided, must match recipients order. */
  fieldsPerRecipient?: Array<
    Array<{
      type: string;
      page?: number;
      positionX?: number;
      positionY?: number;
      width?: number;
      height?: number;
      fieldMeta?: Record<string, unknown>;
    }>
  >;
  /** External ID for the envelope. */
  externalId?: string;
  /** Document visibility setting. */
  visibility?: string;
  /** Global access auth requirements. */
  globalAccessAuth?: string[];
  /** Global action auth requirements. */
  globalActionAuth?: string[];
  /** Folder ID to place the document in. */
  folderId?: string;
  /** Document meta settings. */
  meta?: TCreateEnvelopePayload['meta'];
  /** Custom PDF file. Default: example.pdf */
  pdfFile?: { name: string; data: Buffer };
  /** Reuse an existing test context instead of creating a new one. */
  context?: ApiSeedContext;
};

/**
 * Create a draft document via API V2.
 *
 * Creates a user, team, API token, and a DRAFT document. Optionally adds
 * recipients and fields.
 *
 * @example
 * ```ts
 * const { envelope, token, user, team } = await apiSeedDraftDocument(request, {
 *   title: 'My Document',
 *   recipients: [{ email: 'signer@test.com', name: 'Test Signer' }],
 * });
 * ```
 */
export const apiSeedDraftDocument = async (
  request: APIRequestContext,
  options: ApiSeedDocumentOptions = {},
): Promise<ApiSeedResult> => {
  const ctx = options.context ?? (await apiCreateTestContext('e2e-draft-doc'));

  // Create the envelope with inline recipients if provided
  const createOptions: ApiSeedEnvelopeOptions = {
    title: options.title ?? '[TEST] API Document - Draft',
    type: 'DOCUMENT',
    externalId: options.externalId,
    visibility: options.visibility,
    globalAccessAuth: options.globalAccessAuth,
    globalActionAuth: options.globalActionAuth,
    folderId: options.folderId,
    meta: options.meta,
    pdfFile: options.pdfFile,
  };

  // If we have recipients but no per-recipient fields, use inline creation
  if (options.recipients && !options.fieldsPerRecipient) {
    createOptions.recipients = options.recipients.map((r) => ({
      ...r,
      role: r.role ?? 'SIGNER',
    }));
  }

  const { id: envelopeId } = await apiCreateEnvelope(request, ctx.token, createOptions);

  // If we need per-recipient fields, add recipients and fields separately
  if (options.recipients && options.fieldsPerRecipient) {
    const recipientsRes = await apiCreateRecipients(
      request,
      ctx.token,
      envelopeId,
      options.recipients,
    );

    // Get envelope to resolve envelope item IDs
    const envelopeData = await apiGetEnvelope(request, ctx.token, envelopeId);
    const firstItemId = envelopeData.envelopeItems[0]?.id;

    // Create fields for each recipient
    for (const [index, recipientFields] of options.fieldsPerRecipient.entries()) {
      if (recipientFields.length === 0) {
        continue;
      }

      const recipientId = recipientsRes.data[index].id;

      await apiCreateFields(
        request,
        ctx.token,
        envelopeId,
        recipientFields.map((f) => ({
          ...f,
          recipientId,
          envelopeItemId: firstItemId,
          type: f.type,
        })),
      );
    }
  }

  const envelope = await apiGetEnvelope(request, ctx.token, envelopeId);

  return { envelope, token: ctx.token, user: ctx.user, team: ctx.team };
};

export type ApiSeedPendingDocumentOptions = ApiSeedDocumentOptions & {
  /** Distribution meta (subject, message, etc.). */
  distributeMeta?: TDistributeEnvelopeRequest['meta'];
};

/**
 * Seed a pending (distributed) document via API V2.
 *
 * Creates the document, adds recipients with SIGNATURE fields, then
 * distributes (sends) it. The response includes signing URLs for each
 * recipient.
 *
 * Every SIGNER recipient must have at least one SIGNATURE field for
 * distribution to succeed. If you don't provide `fieldsPerRecipient`,
 * a default SIGNATURE field is added for each SIGNER/APPROVER recipient.
 *
 * @example
 * ```ts
 * const { envelope, distributeResult, token } = await apiSeedPendingDocument(request, {
 *   recipients: [
 *     { email: 'signer@test.com', name: 'Signer' },
 *     { email: 'viewer@test.com', name: 'Viewer', role: 'VIEWER' },
 *   ],
 * });
 *
 * // Access signing URL:
 * const signingUrl = distributeResult.recipients[0].signingUrl;
 * ```
 */
export const apiSeedPendingDocument = async (
  request: APIRequestContext,
  options: ApiSeedPendingDocumentOptions = {},
): Promise<
  ApiSeedResult & {
    distributeResult: TDistributeEnvelopeResponse;
  }
> => {
  const ctx = options.context ?? (await apiCreateTestContext('e2e-pending-doc'));

  const recipients = options.recipients ?? [
    {
      email: `signer-${Date.now()}@test.documenso.com`,
      name: 'Test Signer',
      role: 'SIGNER' as const,
    },
  ];

  // Create the base envelope
  const { id: envelopeId } = await apiCreateEnvelope(request, ctx.token, {
    title: options.title ?? '[TEST] API Document - Pending',
    type: 'DOCUMENT',
    externalId: options.externalId,
    visibility: options.visibility,
    globalAccessAuth: options.globalAccessAuth,
    globalActionAuth: options.globalActionAuth,
    folderId: options.folderId,
    meta: options.meta,
    pdfFile: options.pdfFile,
  });

  // Add recipients
  const recipientsRes = await apiCreateRecipients(request, ctx.token, envelopeId, recipients);

  // Get envelope for item IDs
  const envelopeData = await apiGetEnvelope(request, ctx.token, envelopeId);
  const firstItemId = envelopeData.envelopeItems[0]?.id;

  // Add fields
  if (options.fieldsPerRecipient) {
    for (const [index, recipientFields] of options.fieldsPerRecipient.entries()) {
      if (recipientFields.length === 0) {
        continue;
      }

      await apiCreateFields(
        request,
        ctx.token,
        envelopeId,
        recipientFields.map((f) => ({
          ...f,
          recipientId: recipientsRes.data[index].id,
          envelopeItemId: firstItemId,
          type: f.type,
        })),
      );
    }
  } else {
    // Auto-add a SIGNATURE field for each SIGNER/APPROVER recipient
    const signerFields: ApiField[] = [];

    for (const [index, r] of recipientsRes.data.entries()) {
      const role = recipients[index].role ?? 'SIGNER';

      if (role === 'SIGNER' || role === 'APPROVER') {
        signerFields.push({
          recipientId: r.id,
          envelopeItemId: firstItemId,
          type: 'SIGNATURE',
          page: 1,
          positionX: 10,
          positionY: 10 + index * 10,
          width: 15,
          height: 5,
        });
      }
    }

    if (signerFields.length > 0) {
      await apiCreateFields(request, ctx.token, envelopeId, signerFields);
    }
  }

  // Distribute
  const distributeResult = await apiDistributeEnvelope(
    request,
    ctx.token,
    envelopeId,
    options.distributeMeta,
  );

  const envelope = await apiGetEnvelope(request, ctx.token, envelopeId);

  return {
    envelope,
    distributeResult,
    token: ctx.token,
    user: ctx.user,
    team: ctx.team,
  };
};

export type ApiSeedTemplateOptions = Omit<ApiSeedDocumentOptions, 'folderId'> & {
  /** Folder ID to place the template in. */
  folderId?: string;
};

/**
 * Seed a template via API V2.
 *
 * Creates a TEMPLATE envelope with optional recipients and fields.
 *
 * @example
 * ```ts
 * const { envelope, token } = await apiSeedTemplate(request, {
 *   title: 'My Template',
 *   recipients: [{ email: 'recipient@test.com', name: 'Signer', role: 'SIGNER' }],
 * });
 * ```
 */
export const apiSeedTemplate = async (
  request: APIRequestContext,
  options: ApiSeedTemplateOptions = {},
): Promise<ApiSeedResult> => {
  const ctx = options.context ?? (await apiCreateTestContext('e2e-template'));

  const createOptions: ApiSeedEnvelopeOptions = {
    title: options.title ?? '[TEST] API Template',
    type: 'TEMPLATE',
    externalId: options.externalId,
    visibility: options.visibility,
    globalAccessAuth: options.globalAccessAuth,
    globalActionAuth: options.globalActionAuth,
    folderId: options.folderId,
    meta: options.meta,
    pdfFile: options.pdfFile,
  };

  if (options.recipients && !options.fieldsPerRecipient) {
    createOptions.recipients = options.recipients.map((r) => ({
      ...r,
      role: r.role ?? 'SIGNER',
    }));
  }

  const { id: envelopeId } = await apiCreateEnvelope(request, ctx.token, createOptions);

  if (options.recipients && options.fieldsPerRecipient) {
    const recipientsRes = await apiCreateRecipients(
      request,
      ctx.token,
      envelopeId,
      options.recipients,
    );

    const envelopeData = await apiGetEnvelope(request, ctx.token, envelopeId);
    const firstItemId = envelopeData.envelopeItems[0]?.id;

    for (const [index, recipientFields] of options.fieldsPerRecipient.entries()) {
      if (recipientFields.length === 0) {
        continue;
      }

      await apiCreateFields(
        request,
        ctx.token,
        envelopeId,
        recipientFields.map((f) => ({
          ...f,
          recipientId: recipientsRes.data[index].id,
          envelopeItemId: firstItemId,
          type: f.type,
        })),
      );
    }
  }

  const envelope = await apiGetEnvelope(request, ctx.token, envelopeId);

  return { envelope, token: ctx.token, user: ctx.user, team: ctx.team };
};

/**
 * Seed a template with a direct link via API V2.
 *
 * Creates a template with a recipient, then creates a direct link for it.
 *
 * @example
 * ```ts
 * const { envelope, directLink, token } = await apiSeedDirectTemplate(request, {
 *   title: 'Direct Template',
 * });
 *
 * // Use directLink.token for the signing URL
 * ```
 */
export const apiSeedDirectTemplate = async (
  request: APIRequestContext,
  options: ApiSeedTemplateOptions & {
    /** Custom recipient for the direct link. Default: a SIGNER placeholder. */
    directRecipient?: ApiRecipient;
  } = {},
): Promise<
  ApiSeedResult & {
    directLink: { id: number; token: string; enabled: boolean; directTemplateRecipientId: number };
  }
> => {
  const recipients = options.recipients ?? [
    options.directRecipient ?? {
      email: 'direct-template-recipient@documenso.com',
      name: 'Direct Template Recipient',
      role: 'SIGNER' as const,
    },
  ];

  const templateResult = await apiSeedTemplate(request, {
    ...options,
    recipients,
  });

  // Find the recipient ID for the direct link
  const directRecipientEmail = options.directRecipient?.email ?? recipients[0].email;

  const directRecipient = templateResult.envelope.recipients.find(
    (r) => r.email === directRecipientEmail,
  );

  if (!directRecipient) {
    throw new Error(`Direct template recipient not found: ${directRecipientEmail}`);
  }

  const numericTemplateId = mapSecondaryIdToTemplateId(templateResult.envelope.secondaryId);

  const directLink = await apiCreateDirectTemplateLink(
    request,
    templateResult.token,
    numericTemplateId,
    directRecipient.id,
  );

  // Re-fetch envelope to include directLink data
  const envelope = await apiGetEnvelope(request, templateResult.token, templateResult.envelope.id);

  return {
    ...templateResult,
    envelope,
    directLink,
  };
};

/**
 * Seed multiple draft documents in parallel for a single user context.
 *
 * Useful for tests that need multiple documents (e.g., bulk actions, find/filter tests).
 *
 * @example
 * ```ts
 * const { documents, token, user, team } = await apiSeedMultipleDraftDocuments(request, [
 *   { title: 'Doc A' },
 *   { title: 'Doc B' },
 *   { title: 'Doc C' },
 * ]);
 * ```
 */
export const apiSeedMultipleDraftDocuments = async (
  request: APIRequestContext,
  documents: ApiSeedDocumentOptions[],
  context?: ApiSeedContext,
): Promise<{
  documents: TGetEnvelopeResponse[];
  token: string;
  user: ApiSeedContext['user'];
  team: ApiSeedContext['team'];
}> => {
  const ctx = context ?? (await apiCreateTestContext('e2e-multi-doc'));

  const results = await Promise.all(
    documents.map(async (docOptions) =>
      apiSeedDraftDocument(request, { ...docOptions, context: ctx }),
    ),
  );

  return {
    documents: results.map((r) => r.envelope),
    token: ctx.token,
    user: ctx.user,
    team: ctx.team,
  };
};
