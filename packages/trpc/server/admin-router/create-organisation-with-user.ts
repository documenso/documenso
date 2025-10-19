import { OrganisationType } from '@prisma/client';

import { sendAdminUserWelcomeEmail } from '@documenso/lib/server-only/admin/send-admin-user-welcome-email';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { createAdminUser } from '@documenso/lib/server-only/user/create-admin-user';
import { internalClaims } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZCreateOrganisationWithUserRequestSchema,
  ZCreateOrganisationWithUserResponseSchema,
} from './create-organisation-with-user.types';

export const createOrganisationWithUserRoute = adminProcedure
  .input(ZCreateOrganisationWithUserRequestSchema)
  .output(ZCreateOrganisationWithUserResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { data } = input;

    ctx.logger.info({
      input: {
        userEmail: data.userEmail,
        organisationName: data.organisationName,
        subscriptionClaimId: data.subscriptionClaimId,
      },
    });

    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.userEmail.toLowerCase(),
      },
    });

    let userId: number;
    let isNewUser: boolean;

    if (existingUser) {
      userId = existingUser.id;
      isNewUser = false;

      ctx.logger.info({
        message: 'Linking existing user to new organisation',
        userId,
      });
    } else {
      const newUser = await createAdminUser({
        name: data.userName,
        email: data.userEmail,
      });

      userId = newUser.id;
      isNewUser = true;

      ctx.logger.info({
        message: 'Created new user for organisation',
        userId,
      });
    }

    const organisation = await createOrganisation({
      userId,
      name: data.organisationName,
      type: OrganisationType.ORGANISATION,
      claim: internalClaims[data.subscriptionClaimId],
    });

    ctx.logger.info({
      message: 'Organisation created successfully',
      organisationId: organisation.id,
      userId,
      isNewUser,
    });

    if (isNewUser) {
      await sendAdminUserWelcomeEmail({
        userId,
        organisationName: data.organisationName,
      }).catch((err) => {
        ctx.logger.error({
          message: 'Failed to send welcome email',
          error: err,
          userId,
        });
      });
    }

    return {
      organisationId: organisation.id,
      userId,
      isNewUser,
    };
  });
