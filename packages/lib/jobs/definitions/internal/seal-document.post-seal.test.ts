import { prisma } from '@documenso/prisma';
import { DocumentStatus, WebhookTriggerEvents } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import type { JobRunIO } from '../../client/_internal/job';
import { runPostSealDocumentTasks } from './seal-document.post-seal';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: {
      findFirstOrThrow: vi.fn(),
    },
  },
}));

vi.mock('../../../server-only/document/send-completed-email', () => ({
  sendCompletedEmail: vi.fn(),
}));

vi.mock('../../../server-only/webhooks/trigger/trigger-webhook', () => ({
  triggerWebhook: vi.fn(),
}));

vi.mock('../../../types/webhook-payload', () => ({
  mapEnvelopeToWebhookDocumentPayload: vi.fn((envelope) => ({ id: envelope.id })),
  ZWebhookDocumentSchema: {
    parse: vi.fn((payload) => payload),
  },
}));

const createJobRunIO = () =>
  ({
    runTask: vi.fn(async (_cacheKey, callback) => callback()),
    triggerJob: vi.fn(),
    wait: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
    },
  }) satisfies JobRunIO;

describe('runPostSealDocumentTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const envelope = {
      id: 'envelope_123',
      userId: 1,
      teamId: 2,
    } as unknown as Awaited<ReturnType<typeof prisma.envelope.findFirstOrThrow>>;

    vi.mocked(prisma.envelope.findFirstOrThrow).mockResolvedValue(envelope);
  });

  it('triggers the completion webhook before sending completed emails', async () => {
    const io = createJobRunIO();
    const calls: string[] = [];

    vi.mocked(triggerWebhook).mockImplementation(() => {
      calls.push('webhook');
      return Promise.resolve();
    });

    vi.mocked(sendCompletedEmail).mockImplementation(() => {
      calls.push('email');
      return Promise.reject(new Error('SMTP connection failed'));
    });

    await expect(
      runPostSealDocumentTasks({
        envelopeId: 'envelope_123',
        envelopeStatus: DocumentStatus.COMPLETED,
        isRejected: false,
        isResealing: false,
        sendEmail: true,
        io,
      }),
    ).rejects.toThrow('SMTP connection failed');

    expect(calls).toEqual(['webhook', 'email']);
    expect(vi.mocked(io.runTask).mock.calls.map(([cacheKey]) => cacheKey)).toEqual([
      'trigger-document-webhook',
      'send-completed-email',
    ]);
    expect(triggerWebhook).toHaveBeenCalledWith({
      event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
      data: { id: 'envelope_123' },
      userId: 1,
      teamId: 2,
    });
  });

  it('triggers rejected webhooks without sending completed emails', async () => {
    const io = createJobRunIO();

    await runPostSealDocumentTasks({
      envelopeId: 'envelope_123',
      envelopeStatus: DocumentStatus.REJECTED,
      isRejected: true,
      isResealing: false,
      sendEmail: true,
      io,
    });

    expect(triggerWebhook).toHaveBeenCalledWith({
      event: WebhookTriggerEvents.DOCUMENT_REJECTED,
      data: { id: 'envelope_123' },
      userId: 1,
      teamId: 2,
    });
    expect(sendCompletedEmail).not.toHaveBeenCalled();
  });
});
