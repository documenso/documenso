import { EnvelopeType, WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type DeleteTemplateOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const templateToDelete = await prisma.envelope.findUniqueOrThrow({
    where: envelopeWhereInput,
    include: { documentMeta: true, recipients: true },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.TEMPLATE_DELETED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(templateToDelete)),
    userId,
    teamId,
  });

  return await prisma.envelope.delete({
    where: envelopeWhereInput,
  });
};
