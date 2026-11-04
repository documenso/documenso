import { WebhookTriggerEvents } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getWebhookByIdMock, generateSampleWebhookPayloadMock, triggerJobMock } = vi.hoisted(() => ({
  getWebhookByIdMock: vi.fn(),
  generateSampleWebhookPayloadMock: vi.fn(),
  triggerJobMock: vi.fn(),
}));

vi.mock('./get-webhook-by-id', () => ({
  getWebhookById: getWebhookByIdMock,
}));

vi.mock('./trigger/generate-sample-data', () => ({
  generateSampleWebhookPayload: generateSampleWebhookPayloadMock,
}));

vi.mock('../../jobs/client', () => ({
  jobs: {
    triggerJob: triggerJobMock,
  },
}));

import { triggerTestWebhook } from './trigger-test-webhook';

describe('triggerTestWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches internal.execute-webhook only for the target webhook id', async () => {
    getWebhookByIdMock.mockResolvedValue({
      id: 'webhook_target_123',
      webhookUrl: 'https://example.com/webhook-target',
      enabled: true,
      eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED],
    });

    generateSampleWebhookPayloadMock.mockReturnValue({
      payload: { documentId: 42 },
    });

    triggerJobMock.mockResolvedValue(undefined);

    const result = await triggerTestWebhook({
      id: 'webhook_target_123',
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      userId: 1,
      teamId: 10,
    });

    expect(result).toEqual({
      success: true,
      message: 'Test webhook triggered successfully',
    });

    expect(triggerJobMock).toHaveBeenCalledTimes(1);
    expect(triggerJobMock).toHaveBeenCalledWith({
      name: 'internal.execute-webhook',
      payload: {
        event: WebhookTriggerEvents.DOCUMENT_CREATED,
        webhookId: 'webhook_target_123',
        data: { documentId: 42 },
      },
    });
  });

  it('throws when the target webhook is disabled', async () => {
    getWebhookByIdMock.mockResolvedValue({
      id: 'webhook_disabled',
      webhookUrl: 'https://example.com/webhook',
      enabled: false,
      eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED],
    });

    await expect(
      triggerTestWebhook({
        id: 'webhook_disabled',
        event: WebhookTriggerEvents.DOCUMENT_CREATED,
        userId: 1,
        teamId: 10,
      }),
    ).rejects.toThrow('Webhook is disabled');

    expect(triggerJobMock).not.toHaveBeenCalled();
  });
});
