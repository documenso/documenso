import { SubscriptionStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createOrganisationClaimUpsertData } from '@documenso/lib/server-only/organisation/create-organisation';
import { INTERNAL_CLAIM_ID, internalClaims } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZSwapOrganisationSubscriptionRequestSchema,
  ZSwapOrganisationSubscriptionResponseSchema,
} from './swap-organisation-subscription.types';

export const swapOrganisationSubscriptionRoute = adminProcedure
  .input(ZSwapOrganisationSubscriptionRequestSchema)
  .output(ZSwapOrganisationSubscriptionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { sourceOrganisationId, targetOrganisationId } = input;

    ctx.logger.info({
      input: {
        sourceOrganisationId,
        targetOrganisationId,
      },
    });

    if (sourceOrganisationId === targetOrganisationId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Source and target organisations must be different',
      });
    }

    const sourceOrg = await prisma.organisation.findUnique({
      where: { id: sourceOrganisationId },
      include: {
        subscription: true,
        organisationClaim: true,
      },
    });

    if (!sourceOrg) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Source organisation not found',
      });
    }

    if (
      !sourceOrg.subscription ||
      (sourceOrg.subscription.status !== SubscriptionStatus.ACTIVE &&
        sourceOrg.subscription.status !== SubscriptionStatus.PAST_DUE)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Source organisation does not have an active subscription',
      });
    }

    const targetOrg = await prisma.organisation.findUnique({
      where: { id: targetOrganisationId },
      include: {
        subscription: true,
        organisationClaim: true,
      },
    });

    if (!targetOrg) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Target organisation not found',
      });
    }

    if (sourceOrg.ownerUserId !== targetOrg.ownerUserId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Both organisations must be owned by the same user',
      });
    }

    if (
      targetOrg.subscription &&
      (targetOrg.subscription.status === SubscriptionStatus.ACTIVE ||
        targetOrg.subscription.status === SubscriptionStatus.PAST_DUE)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Target organisation already has an active subscription',
      });
    }

    const customerId = sourceOrg.customerId ?? sourceOrg.subscription.customerId;

    await prisma.$transaction(async (tx) => {
      // Delete stale INACTIVE subscription on target if present.
      if (targetOrg.subscription) {
        await tx.subscription.delete({
          where: { id: targetOrg.subscription.id },
        });
      }

      // Clear customerId on source org to avoid unique constraint violation.
      await tx.organisation.update({
        where: { id: sourceOrganisationId },
        data: { customerId: null },
      });

      // Set customerId on target org.
      await tx.organisation.update({
        where: { id: targetOrganisationId },
        data: { customerId },
      });

      // Move the subscription record to the target org.
      await tx.subscription.update({
        where: { id: sourceOrg.subscription!.id },
        data: { organisationId: targetOrganisationId },
      });

      // Copy source org's claim entitlements to target org's claim.
      if (sourceOrg.organisationClaim && targetOrg.organisationClaim) {
        await tx.organisationClaim.update({
          where: { id: targetOrg.organisationClaim.id },
          data: {
            originalSubscriptionClaimId: sourceOrg.organisationClaim.originalSubscriptionClaimId,
            teamCount: sourceOrg.organisationClaim.teamCount,
            memberCount: sourceOrg.organisationClaim.memberCount,
            envelopeItemCount: sourceOrg.organisationClaim.envelopeItemCount,
            flags: sourceOrg.organisationClaim.flags,
          },
        });
      }

      // Reset source org's claim to FREE.
      if (sourceOrg.organisationClaim) {
        await tx.organisationClaim.update({
          where: { id: sourceOrg.organisationClaim.id },
          data: {
            originalSubscriptionClaimId: INTERNAL_CLAIM_ID.FREE,
            ...createOrganisationClaimUpsertData(internalClaims[INTERNAL_CLAIM_ID.FREE]),
          },
        });
      }
    });
  });
