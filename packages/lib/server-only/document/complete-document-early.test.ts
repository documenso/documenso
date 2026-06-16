// ABOUTME: Unit tests for completeDocumentEarly authorization and minimum-signature guards.
// ABOUTME: Mocks prisma, getEnvelopeWhereInput, and the jobs client to exercise the new guards in isolation.
import { DocumentStatus, RecipientRole, SigningStatus, TeamMemberRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  envelope: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  documentAuditLog: {
    create: vi.fn(),
  },
};

vi.mock('@documenso/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('../envelope/get-envelope-by-id', () => ({
  getEnvelopeWhereInput: vi.fn(),
}));

vi.mock('../../jobs/client', () => ({
  jobs: {
    triggerJob: vi.fn(),
  },
}));

const { completeDocumentEarly } = await import('./complete-document-early');
const { getEnvelopeWhereInput } = await import('../envelope/get-envelope-by-id');
const { jobs } = await import('../../jobs/client');

/** Minimal envelope used as the base for all test cases. */
const makeEnvelope = (overrides: {
  userId?: number;
  recipients?: Array<{ id: number; role: RecipientRole; signingStatus: SigningStatus; name: string; email: string }>;
}) => ({
  id: 'env-1',
  userId: overrides.userId ?? 1,
  status: DocumentStatus.PENDING,
  secondaryId: 'document_42',
  recipients: overrides.recipients ?? [],
  documentMeta: null,
});

const ONE_SIGNED_RECIPIENT = [
  {
    id: 10,
    role: RecipientRole.SIGNER,
    signingStatus: SigningStatus.SIGNED,
    name: 'Alice',
    email: 'alice@example.com',
  },
];

const makeCallOptions = (): Parameters<typeof completeDocumentEarly>[0] => ({
  id: { type: 'envelopeId', id: 'env-1' },
  userId: 99,
  teamId: 5,
  requestMetadata: {
    requestMetadata: { ipAddress: null, userAgent: null },
    headers: {},
  } as never,
});

describe('completeDocumentEarly', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: document-audit-log and the final findFirstOrThrow both succeed.
    mockPrisma.documentAuditLog.create.mockResolvedValue({});
    mockPrisma.envelope.findFirstOrThrow.mockResolvedValue({
      id: 'env-1',
      recipients: [],
      documentMeta: null,
    });
  });

  describe('(a) non-owner MEMBER with one signed recipient', () => {
    it('rejects with UNAUTHORIZED', async () => {
      // Envelope owner is user 1; caller is user 99 (non-owner).
      vi.mocked(getEnvelopeWhereInput).mockResolvedValue({
        envelopeWhereInput: {} as never,
        team: { currentTeamRole: TeamMemberRole.MEMBER } as never,
      });

      mockPrisma.envelope.findFirst.mockResolvedValue(
        makeEnvelope({ userId: 1, recipients: ONE_SIGNED_RECIPIENT }),
      );

      await expect(completeDocumentEarly(makeCallOptions())).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('(b) owner with ZERO signed recipients', () => {
    it('rejects with INVALID_REQUEST', async () => {
      // Caller (userId 99) is the envelope owner.
      vi.mocked(getEnvelopeWhereInput).mockResolvedValue({
        envelopeWhereInput: {} as never,
        team: { currentTeamRole: TeamMemberRole.MEMBER } as never,
      });

      mockPrisma.envelope.findFirst.mockResolvedValue(
        makeEnvelope({
          userId: 99,
          recipients: [
            {
              id: 10,
              role: RecipientRole.SIGNER,
              signingStatus: SigningStatus.NOT_SIGNED,
              name: 'Bob',
              email: 'bob@example.com',
            },
          ],
        }),
      );

      await expect(completeDocumentEarly(makeCallOptions())).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
      });
    });
  });

  describe('(c) owner with one signed recipient', () => {
    it('resolves and triggers the seal job', async () => {
      // Caller (userId 99) is the owner, role MEMBER.
      vi.mocked(getEnvelopeWhereInput).mockResolvedValue({
        envelopeWhereInput: {} as never,
        team: { currentTeamRole: TeamMemberRole.MEMBER } as never,
      });

      mockPrisma.envelope.findFirst.mockResolvedValue(
        makeEnvelope({ userId: 99, recipients: ONE_SIGNED_RECIPIENT }),
      );

      await expect(completeDocumentEarly(makeCallOptions())).resolves.toBeDefined();

      expect(vi.mocked(jobs.triggerJob)).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'internal.seal-document' }),
      );
    });
  });

  describe('(d) non-owner MANAGER with one signed recipient', () => {
    it('resolves', async () => {
      // Caller (userId 99) is a MANAGER but not the owner (owner is 1).
      vi.mocked(getEnvelopeWhereInput).mockResolvedValue({
        envelopeWhereInput: {} as never,
        team: { currentTeamRole: TeamMemberRole.MANAGER } as never,
      });

      mockPrisma.envelope.findFirst.mockResolvedValue(
        makeEnvelope({ userId: 1, recipients: ONE_SIGNED_RECIPIENT }),
      );

      await expect(completeDocumentEarly(makeCallOptions())).resolves.toBeDefined();

      expect(vi.mocked(jobs.triggerJob)).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'internal.seal-document' }),
      );
    });
  });
});
