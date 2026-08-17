import { DocumentStatus, FieldType, RecipientRole, SigningStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for https://github.com/documenso/documenso/issues/3193
 *
 * Auto-inserted DATE fields used to be stamped (and audit logged) *before* the
 * required-field validation ran, and *outside* the transaction that performs the
 * rest of the signing completion. A failed completion attempt therefore froze the
 * date of that failed attempt onto the document permanently, because the field was
 * already marked `inserted` and so was skipped on every later attempt.
 *
 * These tests use an in-memory fake of the parts of the Prisma client the flow
 * touches. The fake models the one property that matters here: writes made through
 * the transaction client are rolled back if the transaction callback throws, while
 * writes made through the base client are not.
 */

type FakeField = {
  id: number;
  secondaryId: string;
  envelopeId: string;
  recipientId: number;
  type: FieldType;
  inserted: boolean;
  customText: string;
  fieldMeta: unknown;
  page: number;
  positionX: unknown;
  positionY: unknown;
  width: unknown;
  height: unknown;
};

type WriteRecord = {
  /** 'base' = outside any transaction, 'tx' = through the transaction client. */
  via: 'base' | 'tx';
  model: string;
  operation: string;
};

const ENVELOPE_ID = 'envelope_test3193';
const RECIPIENT_ID = 42;
const TOKEN = 'test-token';

const buildField = (overrides: Partial<FakeField> & Pick<FakeField, 'id' | 'type'>): FakeField => ({
  secondaryId: `field_${overrides.id}`,
  envelopeId: ENVELOPE_ID,
  recipientId: RECIPIENT_ID,
  inserted: false,
  customText: '',
  fieldMeta: null,
  page: 1,
  positionX: 0,
  positionY: 0,
  width: 10,
  height: 10,
  ...overrides,
});

/**
 * Builds the fake Prisma client plus the mutable state it reads and writes.
 */
const createFakePrisma = (options: {
  fields: FakeField[];
  /** Forces a failure inside the completion transaction, after the recipient update. */
  failInsideTransaction?: boolean;
}) => {
  const state = {
    fields: options.fields.map((field) => ({ ...field })),
    auditLogTypes: [] as string[],
    recipient: {
      id: RECIPIENT_ID,
      envelopeId: ENVELOPE_ID,
      token: TOKEN,
      name: 'Signer',
      email: 'signer@example.com',
      role: RecipientRole.SIGNER,
      signingStatus: SigningStatus.NOT_SIGNED as SigningStatus,
      signedAt: null as Date | null,
      readStatus: 'OPENED',
      sendStatus: 'SENT',
      authOptions: null,
      expiresAt: null as Date | null,
      signingOrder: 1,
      rejectionReason: null,
    },
  };

  const writes: WriteRecord[] = [];

  const envelope = () => ({
    id: ENVELOPE_ID,
    secondaryId: 'document_7',
    type: 'DOCUMENT',
    status: DocumentStatus.PENDING,
    internalVersion: 2,
    userId: 1,
    teamId: 1,
    authOptions: null,
    documentMeta: {
      id: 'meta_1',
      signingOrder: 'PARALLEL',
      timezone: 'Etc/UTC',
      dateFormat: 'yyyy-MM-dd',
      allowDictateNextSigner: false,
    },
    recipients: [{ ...state.recipient }],
  });

  /**
   * The delegates are shared between the base client and the transaction client;
   * `via` records which one a given write came through.
   */
  const makeDelegates = (via: 'base' | 'tx') => ({
    envelope: {
      findFirstOrThrow: async () => envelope(),
      findUniqueOrThrow: async () => envelope(),
      findFirst: async () => envelope(),
    },
    field: {
      findMany: async () => state.fields.map((field) => ({ ...field })),
      updateMany: ({ where, data }: { where: { id: { in: number[] } }; data: Partial<FakeField> }) => {
        writes.push({ via, model: 'field', operation: 'updateMany' });

        let count = 0;

        for (const field of state.fields) {
          if (where.id.in.includes(field.id)) {
            Object.assign(field, data);
            count += 1;
          }
        }

        return Promise.resolve({ count });
      },
    },
    recipient: {
      findMany: async () => [],
      update: async () => ({ ...state.recipient }),
      updateMany: ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ via, model: 'recipient', operation: 'updateMany' });

        if (state.recipient.signingStatus === SigningStatus.SIGNED) {
          return Promise.resolve({ count: 0 });
        }

        Object.assign(state.recipient, data);

        return Promise.resolve({ count: 1 });
      },
    },
    documentAuditLog: {
      create: ({ data }: { data: { type: string } }) => {
        writes.push({ via, model: 'documentAuditLog', operation: 'create' });

        // Simulate a failure part-way through the completion transaction.
        if (via === 'tx' && options.failInsideTransaction) {
          return Promise.reject(new Error('simulated failure inside transaction'));
        }

        state.auditLogTypes.push(data.type);

        return Promise.resolve({ id: 1 });
      },
      createMany: ({ data }: { data: { type: string }[] }) => {
        writes.push({ via, model: 'documentAuditLog', operation: 'createMany' });
        state.auditLogTypes.push(...data.map((entry) => entry.type));

        return Promise.resolve({ count: data.length });
      },
    },
  });

  const base = makeDelegates('base');

  const prisma = {
    ...base,
    $transaction: async <T>(callback: (tx: ReturnType<typeof makeDelegates>) => Promise<T>): Promise<T> => {
      // Snapshot so we can emulate a real rollback.
      const snapshot = {
        fields: state.fields.map((field) => ({ ...field })),
        auditLogTypes: [...state.auditLogTypes],
        recipient: { ...state.recipient },
      };

      try {
        return await callback(makeDelegates('tx'));
      } catch (error) {
        state.fields = snapshot.fields;
        state.auditLogTypes = snapshot.auditLogTypes;
        state.recipient = snapshot.recipient;

        throw error;
      }
    },
  };

  return { prisma, state, writes };
};

const { mockPrismaHolder } = vi.hoisted(() => ({
  mockPrismaHolder: { current: null as unknown },
}));

vi.mock('@documenso/prisma', () => ({
  get prisma() {
    return mockPrismaHolder.current;
  },
}));

vi.mock('../../jobs/client', () => ({
  jobs: { triggerJob: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../webhooks/trigger/trigger-webhook', () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../recipient/get-is-recipient-turn', () => ({
  getIsRecipientsTurnToSign: vi.fn().mockResolvedValue(true),
}));

vi.mock('./is-recipient-authorized', () => ({
  isRecipientAuthorized: vi.fn().mockResolvedValue(true),
}));

// Avoid pulling the full webhook payload schema into these unit tests.
vi.mock('../../types/webhook-payload', () => ({
  mapEnvelopeToWebhookDocumentPayload: (value: unknown) => value,
  ZWebhookDocumentSchema: { parse: (value: unknown) => value },
}));

const { completeDocumentWithToken } = await import('./complete-document-with-token');

const completeWithToken = () =>
  completeDocumentWithToken({
    token: TOKEN,
    id: { type: 'envelopeId', id: ENVELOPE_ID },
  });

describe('completeDocumentWithToken - DATE field stamping (issue #3193)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not stamp the DATE field when another required field is unsigned', async () => {
    const fake = createFakePrisma({
      fields: [
        buildField({ id: 1, type: FieldType.DATE, inserted: false }),
        // Unsigned SIGNATURE field: always required, so validation must reject.
        buildField({ id: 2, type: FieldType.SIGNATURE, inserted: false }),
      ],
    });

    mockPrismaHolder.current = fake.prisma;

    await expect(completeWithToken()).rejects.toThrow(/unsigned fields/);

    const dateField = fake.state.fields.find((field) => field.id === 1);

    // The core of #3193: the date must not be persisted by a failed attempt.
    expect(dateField?.inserted).toBe(false);
    expect(dateField?.customText).toBe('');

    // No date write at all should have been attempted.
    expect(fake.writes.filter((write) => write.model === 'field')).toHaveLength(0);

    // And no DOCUMENT_FIELD_INSERTED audit log should have been written.
    expect(fake.state.auditLogTypes).not.toContain('DOCUMENT_FIELD_INSERTED');

    // The recipient must not have been marked as signed.
    expect(fake.state.recipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
  });

  it('stamps the DATE field inside the completion transaction on success', async () => {
    const fake = createFakePrisma({
      fields: [
        buildField({ id: 1, type: FieldType.DATE, inserted: false }),
        buildField({ id: 2, type: FieldType.SIGNATURE, inserted: true, customText: 'signed' }),
      ],
    });

    mockPrismaHolder.current = fake.prisma;

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));

    await completeWithToken();

    vi.useRealTimers();

    const dateField = fake.state.fields.find((field) => field.id === 1);

    expect(dateField?.inserted).toBe(true);
    expect(dateField?.customText).toBe('2026-03-04');

    const fieldWrites = fake.writes.filter((write) => write.model === 'field');

    expect(fieldWrites).toHaveLength(1);
    // The write must go through the transaction client so it rolls back with the rest.
    expect(fieldWrites[0].via).toBe('tx');

    const dateAuditWrites = fake.writes.filter(
      (write) => write.model === 'documentAuditLog' && write.operation === 'createMany',
    );

    expect(dateAuditWrites).toHaveLength(1);
    expect(dateAuditWrites[0].via).toBe('tx');
  });

  it('rolls the DATE stamp back when the completion transaction fails', async () => {
    const fake = createFakePrisma({
      fields: [
        buildField({ id: 1, type: FieldType.DATE, inserted: false }),
        buildField({ id: 2, type: FieldType.SIGNATURE, inserted: true, customText: 'signed' }),
      ],
      failInsideTransaction: true,
    });

    mockPrismaHolder.current = fake.prisma;

    await expect(completeWithToken()).rejects.toThrow(/simulated failure inside transaction/);

    const dateField = fake.state.fields.find((field) => field.id === 1);

    // No partial state: the stamp is undone along with the recipient update.
    expect(dateField?.inserted).toBe(false);
    expect(dateField?.customText).toBe('');
    expect(fake.state.recipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(fake.state.auditLogTypes).not.toContain('DOCUMENT_FIELD_INSERTED');
  });

  it('stamps the date of the successful attempt, not of an earlier failed one', async () => {
    const fields = [
      buildField({ id: 1, type: FieldType.DATE, inserted: false }),
      buildField({ id: 2, type: FieldType.SIGNATURE, inserted: false }),
    ];

    const failing = createFakePrisma({ fields });

    mockPrismaHolder.current = failing.prisma;

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));

    await expect(completeWithToken()).rejects.toThrow(/unsigned fields/);

    // The signer returns days later and fills the signature this time.
    const persistedFields = failing.state.fields.map((field) =>
      field.type === FieldType.SIGNATURE ? { ...field, inserted: true, customText: 'signed' } : { ...field },
    );

    const succeeding = createFakePrisma({ fields: persistedFields });

    mockPrismaHolder.current = succeeding.prisma;

    vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));

    await completeWithToken();

    vi.useRealTimers();

    const dateField = succeeding.state.fields.find((field) => field.id === 1);

    // Must be the date of the successful attempt, not the failed one.
    expect(dateField?.customText).toBe('2026-03-04');
  });
});
