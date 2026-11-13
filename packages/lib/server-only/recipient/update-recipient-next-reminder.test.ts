import { DocumentDistributionMethod, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { recomputeNextReminderForEnvelope } from './update-recipient-next-reminder';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: {
      findFirst: vi.fn(),
    },
    recipient: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('recomputeNextReminderForEnvelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries only recipients with non-empty emails when recomputing reminders', async () => {
    vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
      documentMeta: {
        distributionMethod: DocumentDistributionMethod.EMAIL,
        reminderSettings: {
          interval: 3,
          maxCount: 5,
        },
      },
    } as any);

    vi.mocked(prisma.recipient.findMany).mockResolvedValue([]);

    await recomputeNextReminderForEnvelope('envelope-1');

    expect(prisma.recipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          envelopeId: 'envelope-1',
          signingStatus: SigningStatus.NOT_SIGNED,
          sendStatus: SendStatus.SENT,
          role: { not: RecipientRole.CC },
          email: { not: '' },
        }),
      }),
    );
  });

  it('filters out recipients with empty or invalid email and only updates recipients with valid emails', async () => {
    const sentDate = new Date();

    vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
      documentMeta: {
        distributionMethod: DocumentDistributionMethod.EMAIL,
        reminderSettings: {
          interval: 3,
          maxCount: 5,
        },
      },
    } as any);

    vi.mocked(prisma.recipient.findMany).mockResolvedValue([
      {
        id: 1,
        email: '',
        sentAt: sentDate,
        lastReminderSentAt: null,
        reminderCount: 0,
      },
      {
        id: 2,
        email: 'invalid-email',
        sentAt: sentDate,
        lastReminderSentAt: null,
        reminderCount: 0,
      },
      {
        id: 3,
        email: 'recipient@example.com',
        sentAt: sentDate,
        lastReminderSentAt: null,
        reminderCount: 0,
      },
    ] as any);

    await recomputeNextReminderForEnvelope('envelope-1');

    expect(prisma.recipient.update).toHaveBeenCalledTimes(1);
    expect(prisma.recipient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({
          nextReminderAt: expect.any(Date),
        }),
      }),
    );
  });
});
