import { EnvelopeType } from '@prisma/client';

import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { mapFieldToLegacyField } from '@documenso/lib/utils/fields';
import { mapRecipientToLegacyRecipient } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTemplatesByIdsRequestSchema,
  ZGetTemplatesByIdsResponseSchema,
  getTemplatesByIdsMeta,
} from './get-templates-by-ids.types';

export const getTemplatesByIdsRoute = authenticatedProcedure
  .meta(getTemplatesByIdsMeta)
  .input(ZGetTemplatesByIdsRequestSchema)
  .output(ZGetTemplatesByIdsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { templateIds } = input;

    ctx.logger.info({
      input: {
        templateIds,
      },
    });

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'templateId',
        ids: templateIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.TEMPLATE,
    });

    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      include: {
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        envelopeItems: {
          select: {
            documentData: true,
          },
        },
        fields: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
        documentMeta: {
          select: {
            signingOrder: true,
            distributionMethod: true,
          },
        },
        directLink: {
          select: {
            token: true,
            enabled: true,
          },
        },
      },
    });

    const templates = envelopes.map((envelope) => {
      const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

      const firstTemplateDocumentData = envelope.envelopeItems[0].documentData;

      return {
        id: legacyTemplateId,
        envelopeId: envelope.id,
        type: envelope.templateType,
        visibility: envelope.visibility,
        externalId: envelope.externalId,
        title: envelope.title,
        userId: envelope.userId,
        teamId: envelope.teamId,
        authOptions: envelope.authOptions,
        createdAt: envelope.createdAt,
        updatedAt: envelope.updatedAt,
        publicTitle: envelope.publicTitle,
        publicDescription: envelope.publicDescription,
        folderId: envelope.folderId,
        useLegacyFieldInsertion: envelope.useLegacyFieldInsertion,
        team: envelope.team
          ? {
              id: envelope.team.id,
              url: envelope.team.url,
            }
          : null,
        fields: envelope.fields.map((field) => mapFieldToLegacyField(field, envelope)),
        recipients: envelope.recipients.map((recipient) =>
          mapRecipientToLegacyRecipient(recipient, envelope),
        ),
        templateMeta: envelope.documentMeta
          ? {
              signingOrder: envelope.documentMeta.signingOrder,
              distributionMethod: envelope.documentMeta.distributionMethod,
            }
          : null,
        directLink: envelope.directLink
          ? {
              token: envelope.directLink.token,
              enabled: envelope.directLink.enabled,
            }
          : null,
        templateDocumentDataId: firstTemplateDocumentData.id, // Backwards compatibility.
      };
    });

    return {
      data: templates,
    };
  });
