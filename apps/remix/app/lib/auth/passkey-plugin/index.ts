import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, createAuthMiddleware } from 'better-auth/plugins';

export const passkeyPlugin = () =>
  ({
    id: 'passkeyPlugin',
    schema: {
      user: {
        fields: {
          // twoFactorEnabled: {
          //   type: 'boolean',
          //   required: false,
          // },
          // twoFactorBackupCodes: {
          //   type: 'string',
          //   required: false,
          // },
          // twoFactorSecret: {
          //   type: 'string',
          //   required: false,
          // },
          // birthday: {
          //   type: 'date', // string, number, boolean, date
          //   required: true, // if the field should be required on a new record. (default: false)
          //   unique: false, // if the field should be unique. (default: false)
          //   reference: null, // if the field is a reference to another table. (default: null)
          // },
        },
      },
    },
    endpoints: {
      authorize: createAuthEndpoint(
        '/passkey/authorize',
        {
          method: 'POST',
          // use: [],
        },
        async (ctx) => {
          const csrfToken = credentials?.csrfToken;

          if (typeof csrfToken !== 'string' || csrfToken.length === 0) {
            throw new AppError(AppErrorCode.INVALID_REQUEST);
          }

          let requestBodyCrediential: TAuthenticationResponseJSONSchema | null = null;

          try {
            const parsedBodyCredential = JSON.parse(req.body?.credential);
            requestBodyCrediential = ZAuthenticationResponseJSONSchema.parse(parsedBodyCredential);
          } catch {
            throw new AppError(AppErrorCode.INVALID_REQUEST);
          }

          const challengeToken = await prisma.anonymousVerificationToken
            .delete({
              where: {
                id: csrfToken,
              },
            })
            .catch(() => null);

          if (!challengeToken) {
            return null;
          }

          if (challengeToken.expiresAt < new Date()) {
            throw new AppError(AppErrorCode.EXPIRED_CODE);
          }

          const passkey = await prisma.passkey.findFirst({
            where: {
              credentialId: Buffer.from(requestBodyCrediential.id, 'base64'),
            },
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  emailVerified: true,
                },
              },
            },
          });

          if (!passkey) {
            throw new AppError(AppErrorCode.NOT_SETUP);
          }

          const user = passkey.User;

          const { rpId, origin } = getAuthenticatorOptions();

          const verification = await verifyAuthenticationResponse({
            response: requestBodyCrediential,
            expectedChallenge: challengeToken.token,
            expectedOrigin: origin,
            expectedRPID: rpId,
            authenticator: {
              credentialID: new Uint8Array(Array.from(passkey.credentialId)),
              credentialPublicKey: new Uint8Array(passkey.credentialPublicKey),
              counter: Number(passkey.counter),
            },
          }).catch(() => null);

          const requestMetadata = extractNextAuthRequestMetadata(req);

          if (!verification?.verified) {
            await prisma.userSecurityAuditLog.create({
              data: {
                userId: user.id,
                ipAddress: requestMetadata.ipAddress,
                userAgent: requestMetadata.userAgent,
                type: UserSecurityAuditLogType.SIGN_IN_PASSKEY_FAIL,
              },
            });

            return null;
          }

          await prisma.passkey.update({
            where: {
              id: passkey.id,
            },
            data: {
              lastUsedAt: new Date(),
              counter: verification.authenticationInfo.newCounter,
            },
          });

          return {
            id: Number(user.id),
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified?.toISOString() ?? null,
          } satisfies User;
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (context) => context.path.startsWith('/sign-in/email'),
          handler: createAuthMiddleware(async (ctx) => {
            console.log('here...');

            const { birthday } = ctx.body;

            if ((!birthday) instanceof Date) {
              throw new APIError('BAD_REQUEST', { message: 'Birthday must be of type Date.' });
            }

            const today = new Date();
            const fiveYearsAgo = new Date(today.setFullYear(today.getFullYear() - 5));

            if (birthday >= fiveYearsAgo) {
              throw new APIError('BAD_REQUEST', { message: 'User must be above 5 years old.' });
            }

            return { context: ctx };
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
