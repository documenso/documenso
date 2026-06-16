// ABOUTME: Unit tests for provisionGuestSpeakerTemplate atomicity.
// ABOUTME: Asserts that all DB creates happen inside a single $transaction callback, never directly on prisma.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTx = {
  documentData: { create: vi.fn() },
  documentMeta: { create: vi.fn() },
  envelope: { create: vi.fn() },
  field: { createMany: vi.fn() },
};

const mockPrisma = {
  envelope: { findFirst: vi.fn() },
  // These are the direct-prisma mocks; they should NOT be called after the fix.
  documentData: { create: vi.fn() },
  documentMeta: { create: vi.fn() },
  field: { createMany: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};

// The seed file imports prisma via a relative path ('..') not the package alias.
vi.mock('..', () => ({
  prisma: mockPrisma,
}));

vi.mock('@documenso/lib/server-only/envelope/increment-id', () => ({
  incrementTemplateId: vi.fn(async () =>
    Promise.resolve({
      templateId: 1,
      formattedTemplateId: 'T000001',
    }),
  ),
}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(() => Buffer.from('fake-pdf-content')),
  },
}));

const { provisionGuestSpeakerTemplate } = await import('./guest-speaker-template');

describe('provisionGuestSpeakerTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset $transaction to pass through to tx callback.
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    // Default: no existing template.
    mockPrisma.envelope.findFirst.mockResolvedValue(null);

    // Give direct-prisma mocks stub returns so the current (non-transactional) code
    // doesn't crash before we can assert what was called vs. not called.
    // After the fix, these should never be reached.
    mockPrisma.documentData.create.mockResolvedValue({ id: 'data_direct' });
    mockPrisma.documentMeta.create.mockResolvedValue({ id: 'meta_direct' });
    mockPrisma.field.createMany.mockResolvedValue({ count: 11 });
    mockTx.documentData.create.mockResolvedValue({ id: 'data_tx' });
    mockTx.documentMeta.create.mockResolvedValue({ id: 'meta_tx' });

    // tx.envelope.create returns the shape downstream code needs.
    mockTx.envelope.create.mockResolvedValue({
      id: 'envelope_abc123',
      title: 'Guest Speaker Request & Approval Form',
      recipients: [
        { id: 10, email: 'requesting.staff@documenso.placeholder' },
        { id: 11, email: 'building.administrator@documenso.placeholder' },
      ],
      envelopeItems: [{ id: 'item_abc123' }],
    });
  });

  it('returns existing template without creating anything when one already exists', async () => {
    const existing = { id: 'envelope_existing', title: 'Guest Speaker Request & Approval Form' };
    mockPrisma.envelope.findFirst.mockResolvedValue(existing);

    const result = await provisionGuestSpeakerTemplate({ teamId: 1, userId: 2 });

    expect(result).toEqual({ template: existing, created: false });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.documentData.create).not.toHaveBeenCalled();
  });

  it('runs all DB creates inside the transaction client, not directly on prisma', async () => {
    await provisionGuestSpeakerTemplate({ teamId: 1, userId: 2 });

    // The transaction must have been called.
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();

    // All creates must use the tx client.
    expect(mockTx.documentData.create).toHaveBeenCalledOnce();
    expect(mockTx.documentMeta.create).toHaveBeenCalledOnce();
    expect(mockTx.envelope.create).toHaveBeenCalledOnce();
    expect(mockTx.field.createMany).toHaveBeenCalledOnce();

    // Direct prisma creates must NOT be called.
    expect(mockPrisma.documentData.create).not.toHaveBeenCalled();
    expect(mockPrisma.documentMeta.create).not.toHaveBeenCalled();
    expect(mockPrisma.field.createMany).not.toHaveBeenCalled();
  });

  it('returns created: true with the envelope when provisioning succeeds', async () => {
    const result = await provisionGuestSpeakerTemplate({ teamId: 1, userId: 2 });

    expect(result.created).toBe(true);
    expect(result.template).toMatchObject({ id: 'envelope_abc123' });
  });

  it('creates template even when force: true and existing template exists', async () => {
    const existing = { id: 'envelope_existing', title: 'Guest Speaker Request & Approval Form' };
    mockPrisma.envelope.findFirst.mockResolvedValue(existing);

    await provisionGuestSpeakerTemplate({ teamId: 1, userId: 2, force: true });

    // With force, dedup check is skipped — transaction should still run.
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockTx.documentData.create).toHaveBeenCalledOnce();
  });

  it('passes correct teamId and userId to envelope.create inside the transaction', async () => {
    await provisionGuestSpeakerTemplate({ teamId: 42, userId: 99 });

    const envelopeCreateCall = mockTx.envelope.create.mock.calls[0][0];
    expect(envelopeCreateCall.data.teamId).toBe(42);
    expect(envelopeCreateCall.data.userId).toBe(99);
  });

  it('creates the correct number of fields (11 total from TEMPLATE_FIELDS)', async () => {
    await provisionGuestSpeakerTemplate({ teamId: 1, userId: 2 });

    const fieldCreateManyCall = mockTx.field.createMany.mock.calls[0][0];
    expect(fieldCreateManyCall.data).toHaveLength(11);
  });
});
