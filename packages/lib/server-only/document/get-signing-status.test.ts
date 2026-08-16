import { prisma } from '@documenso/prisma';
import { BackgroundJobStatus, DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { getSigningStatus } from './get-signing-status';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    backgroundJob: {
      findFirst: vi.fn(),
    },
  },
}));

describe('getSigningStatus', () => {
  it('should return COMPLETED when envelope status is COMPLETED', async () => {
    const envelope = {
      status: DocumentStatus.COMPLETED,
      secondaryId: 'document_1',
      recipients: [],
    };

    const status = await getSigningStatus(envelope);

    expect(status).toBe('COMPLETED');
  });

  it('should return REJECTED when envelope status is REJECTED', async () => {
    const envelope = {
      status: DocumentStatus.REJECTED,
      secondaryId: 'document_1',
      recipients: [],
    };

    const status = await getSigningStatus(envelope);

    expect(status).toBe('REJECTED');
  });

  it('should return FAILED when all recipients have signed but the seal job failed', async () => {
    const envelope = {
      status: DocumentStatus.PENDING,
      secondaryId: 'document_1',
      recipients: [
        {
          signingStatus: SigningStatus.SIGNED,
          role: RecipientRole.SIGNER,
        },
      ],
    };

    vi.mocked(prisma.backgroundJob.findFirst).mockResolvedValue({
      status: BackgroundJobStatus.FAILED,
    } as any);

    const status = await getSigningStatus(envelope);

    expect(status).toBe('FAILED');
    expect(prisma.backgroundJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          jobId: 'internal.seal-document',
        }),
      }),
    );
  });

  it('should return PROCESSING when all recipients have signed and seal job is not failed', async () => {
    const envelope = {
      status: DocumentStatus.PENDING,
      secondaryId: 'document_1',
      recipients: [
        {
          signingStatus: SigningStatus.SIGNED,
          role: RecipientRole.SIGNER,
        },
      ],
    };

    vi.mocked(prisma.backgroundJob.findFirst).mockResolvedValue({
      status: BackgroundJobStatus.PROCESSING,
    } as any);

    const status = await getSigningStatus(envelope);

    expect(status).toBe('PROCESSING');
  });

  it('should return PENDING when some recipients have not signed yet', async () => {
    const envelope = {
      status: DocumentStatus.PENDING,
      secondaryId: 'document_1',
      recipients: [
        {
          signingStatus: SigningStatus.NOT_SENT,
          role: RecipientRole.SIGNER,
        },
      ],
    };

    const status = await getSigningStatus(envelope);

    expect(status).toBe('PENDING');
  });
});
