// ABOUTME: Unit tests for complete-document-with-token focused on the sequential signing-order
// ABOUTME: next-slot notification path — verifies that sendStatus SENT is not pre-written before the email job runs.
import {
  DocumentSigningOrder,
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Prisma mock — $transaction passes callbacks through with mockTx as the client
// ---------------------------------------------------------------------------
const mockTx = {
  recipient: {
    update: vi.fn().mockResolvedValue({}),
  },
  documentAuditLog: {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({}),
  },
  field: {
    update: vi.fn().mockResolvedValue({}),
  },
};

const mockPrisma = {
  envelope: {
    findFirstOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  recipient: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  field: {
    findMany: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({}),
  },
  documentAuditLog: {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn(),
};

vi.mock('@documenso/prisma', () => ({ prisma: mockPrisma }));

// ---------------------------------------------------------------------------
// Jobs mock
// ---------------------------------------------------------------------------
const mockTriggerJob = vi.fn().mockResolvedValue({});
vi.mock('../../jobs/client', () => ({ jobs: { triggerJob: mockTriggerJob } }));

// ---------------------------------------------------------------------------
// Webhook mock
// ---------------------------------------------------------------------------
vi.mock('../webhooks/trigger/trigger-webhook', () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Recipient-turn check — always returns true (it IS the recipient's turn)
// ---------------------------------------------------------------------------
vi.mock('../recipient/get-is-recipient-turn', () => ({
  getIsRecipientsTurnToSign: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Send pending email
// ---------------------------------------------------------------------------
vi.mock('./send-pending-email', () => ({
  sendPendingEmail: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// is-recipient-authorized — not needed for this path (no 2FA)
// ---------------------------------------------------------------------------
vi.mock('./is-recipient-authorized', () => ({
  isRecipientAuthorized: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// extractDocumentAuthMethods — return empty auth arrays (no 2FA required)
// ---------------------------------------------------------------------------
vi.mock('../../utils/document-auth', () => ({
  extractDocumentAuthMethods: vi.fn().mockReturnValue({
    derivedRecipientAccessAuth: [],
    derivedRecipientActionAuth: null,
  }),
}));

// ---------------------------------------------------------------------------
// assertRecipientNotExpired — no-op (not expired)
// ---------------------------------------------------------------------------
vi.mock('../../utils/recipients', () => ({
  assertRecipientNotExpired: vi.fn(),
}));

// ---------------------------------------------------------------------------
// fieldsContainUnsignedRequiredField — all fields signed (returns false)
// ---------------------------------------------------------------------------
vi.mock('@documenso/lib/utils/advanced-fields-helpers', () => ({
  fieldsContainUnsignedRequiredField: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// computeCalculatedFieldValue — not needed (no calculated fields in test data)
// ---------------------------------------------------------------------------
vi.mock('@documenso/lib/utils/calculated-field', () => ({
  computeCalculatedFieldValue: vi.fn().mockReturnValue({ display: '' }),
}));

// ---------------------------------------------------------------------------
// Webhook payload helpers
// ---------------------------------------------------------------------------
vi.mock('../../types/webhook-payload', () => ({
  ZWebhookDocumentSchema: {
    parse: vi.fn().mockReturnValue({}),
  },
  mapEnvelopeToWebhookDocumentPayload: vi.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// createDocumentAuditLogData — return a stable stub
// ---------------------------------------------------------------------------
vi.mock('@documenso/lib/utils/document-audit-logs', () => ({
  createDocumentAuditLogData: vi.fn().mockReturnValue({ type: 'STUB' }),
}));

// ---------------------------------------------------------------------------
// unsafeBuildEnvelopeIdQuery — return a stable query fragment
// ---------------------------------------------------------------------------
vi.mock('../../utils/envelope', () => ({
  unsafeBuildEnvelopeIdQuery: vi.fn().mockReturnValue({ id: 1 }),
  mapSecondaryIdToDocumentId: vi.fn().mockReturnValue(42),
}));

// ---------------------------------------------------------------------------
// Import AFTER all mocks are registered
// ---------------------------------------------------------------------------
const { completeDocumentWithToken } = await import('./complete-document-with-token');

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/** Builds a minimal envelope that will drive the SEQUENTIAL next-slot path. */
function buildEnvelope() {
  return {
    id: 'env-1',
    userId: 1,
    teamId: 5,
    status: DocumentStatus.PENDING,
    type: EnvelopeType.DOCUMENT,
    internalVersion: 2,
    authOptions: null,
    secondaryId: 'document_42',
    documentMeta: {
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
      allowDictateNextSigner: false,
      timezone: 'UTC',
      dateFormat: 'MM/dd/yyyy',
      subject: null,
      message: null,
    },
    // Current signer — slot 1
    recipients: [
      {
        id: 10,
        token: 'signer-token',
        name: 'Alice',
        email: 'alice@example.com',
        signingStatus: SigningStatus.NOT_SIGNED,
        signingOrder: 1,
        role: RecipientRole.SIGNER,
        authOptions: null,
        expiresAt: null,
      },
    ],
  };
}

/** Two next-slot recipients sharing signingOrder 2. */
function buildNextRecipients() {
  return [
    {
      id: 20,
      signingOrder: 2,
      name: 'Bob',
      email: 'bob@example.com',
      role: RecipientRole.SIGNER,
    },
    {
      id: 21,
      signingOrder: 2,
      name: 'Carol',
      email: 'carol@example.com',
      role: RecipientRole.SIGNER,
    },
  ];
}

// ---------------------------------------------------------------------------
// Describe block
// ---------------------------------------------------------------------------

describe('completeDocumentWithToken — sequential next-slot notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // $transaction: execute the callback with mockTx
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    );

    // Re-arm default mocks that clearAllMocks reset
    mockTx.recipient.update.mockResolvedValue({});
    mockTx.documentAuditLog.create.mockResolvedValue({});
    mockTx.documentAuditLog.createMany.mockResolvedValue({});
    mockTx.field.update.mockResolvedValue({});
    mockPrisma.recipient.update.mockResolvedValue({});
    mockPrisma.documentAuditLog.create.mockResolvedValue({});
    mockPrisma.documentAuditLog.createMany.mockResolvedValue({});
    mockPrisma.field.updateMany.mockResolvedValue({});
    mockTriggerJob.mockResolvedValue({});

    const envelope = buildEnvelope();
    const nextRecipients = buildNextRecipients();

    // First call: find the envelope + current recipient (from token)
    mockPrisma.envelope.findFirstOrThrow.mockResolvedValueOnce(envelope);

    // Fields: empty (no required unsigned fields, no calculated fields, no date fields)
    mockPrisma.field.findMany.mockResolvedValue([]);

    // After signing: find envelope with all recipients for webhook
    const envelopeWithRelations = {
      ...envelope,
      recipients: [
        { ...envelope.recipients[0], signingStatus: SigningStatus.SIGNED },
        ...nextRecipients.map((r) => ({ ...r, signingStatus: SigningStatus.NOT_SIGNED, sendStatus: SendStatus.NOT_SENT, sentAt: null, expiresAt: null, authOptions: null, token: `token-${r.id}` })),
      ],
    };
    mockPrisma.envelope.findUniqueOrThrow.mockResolvedValue(envelopeWithRelations);

    // Pending recipients (slot 2 — next slot, current slot fully signed)
    mockPrisma.recipient.findMany.mockResolvedValue(nextRecipients);

    // haveAllRecipientsSigned check: returns null (not all signed yet)
    mockPrisma.envelope.findFirst.mockResolvedValue(null);

    // Final findFirstOrThrow for the returned updatedDocument
    mockPrisma.envelope.findFirstOrThrow.mockResolvedValueOnce(envelopeWithRelations);
  });

  it('does NOT pre-mark next-slot recipients SENT before the email job runs', async () => {
    await completeDocumentWithToken({
      token: 'signer-token',
      id: { type: 'documentId', id: 1 } as const,
    });

    // Collect every call to tx.recipient.update (used inside $transaction)
    const txUpdateCalls = mockTx.recipient.update.mock.calls;

    // Also check prisma.recipient.update (direct, non-tx calls)
    const directUpdateCalls = mockPrisma.recipient.update.mock.calls;

    const allUpdateCalls = [...txUpdateCalls, ...directUpdateCalls];

    // Find any call that set sendStatus = SENT for a next-slot recipient (id 20 or 21)
    const prematureSentWrites = allUpdateCalls.filter((callArgs) => {
      const options = callArgs[0] as { where?: { id?: number }; data?: { sendStatus?: string } };
      const targetId = options?.where?.id;
      const data = options?.data ?? {};
      const isNextSlotRecipient = targetId === 20 || targetId === 21;
      const setsSent = 'sendStatus' in data && data.sendStatus === SendStatus.SENT;
      return isNextSlotRecipient && setsSent;
    });

    expect(prematureSentWrites).toHaveLength(0);
  });

  it('triggers a signing-requested email job for each next-slot recipient', async () => {
    await completeDocumentWithToken({
      token: 'signer-token',
      id: { type: 'documentId', id: 1 } as const,
    });

    const signingEmailCalls = mockTriggerJob.mock.calls.filter(
      (callArgs) => (callArgs[0] as { name: string }).name === 'send.signing.requested.email',
    );

    expect(signingEmailCalls).toHaveLength(2);

    const calledRecipientIds = signingEmailCalls.map(
      (callArgs) => (callArgs[0] as { payload: { recipientId: number } }).payload.recipientId,
    );
    expect(calledRecipientIds).toContain(20);
    expect(calledRecipientIds).toContain(21);
  });
});
