import { formatPath, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import type { ClientResponse, InferRequestType } from 'hono/client';
import { hc } from 'hono/client';
import superjson from 'superjson';

import type { AuthAppType } from '../server';
import type { PartialAccount } from '../server/lib/utils/get-accounts';
import type { ActiveSession } from '../server/lib/utils/get-session';
import { handleSignInRedirect } from '../server/lib/utils/redirect';
import type { TSessionJsonResponse } from '../server/routes/session';
import type {
  TDisableTwoFactorRequestSchema,
  TEnableTwoFactorRequestSchema,
  TVerifyTwoFactorChallengeRequestSchema,
  TViewTwoFactorRecoveryCodesRequestSchema,
} from '../server/routes/two-factor.types';
import type {
  TForgotPasswordSchema,
  TResendVerifyEmailSchema,
  TResetPasswordSchema,
  TSignUpSchema,
  TUpdatePasswordSchema,
  TVerifyEmailSchema,
} from '../server/types/email-password';

type AuthClientType = ReturnType<typeof hc<AuthAppType>>;

type TEmailPasswordSignin = InferRequestType<AuthClientType['email-password']['authorize']['$post']>['json'] & {
  redirectPath?: string;
};

// `redirectPath` is part of the request schema and validated server-side.
type TPasskeySignin = InferRequestType<AuthClientType['passkey']['authorize']['$post']>['json'];

export class AuthClient {
  public client: AuthClientType;

  constructor(options: { baseUrl: string }) {
    this.client = hc<AuthAppType>(options.baseUrl);
  }

  public async signOut({ redirectPath }: { redirectPath?: string } = {}) {
    await this.client.signout.$post();

    window.location.href = redirectPath ?? formatPath('/signin');
  }

  public async signOutAllSessions() {
    await this.client['signout-all'].$post();
  }

  public async signOutSession({ sessionId, redirectPath }: { sessionId: string; redirectPath?: string }) {
    await this.client['signout-session'].$post({
      json: { sessionId },
    });

    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }

  public async getSession() {
    const response = await this.client['session-json'].$get();

    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }

    const result = await response.json();

    return superjson.deserialize<TSessionJsonResponse>(result);
  }

  public async getSessions() {
    const response = await this.client['sessions'].$get();

    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }

    const result = await response.json();

    return superjson.deserialize<{ sessions: ActiveSession[] }>(result);
  }

  // !: Unused for now since it isn't providing the type narrowing
  // !: we need.
  private async handleError<T>(response: ClientResponse<T>): Promise<void> {
    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }
  }

  public account = {
    getMany: async () => {
      const response = await this.client['accounts'].$get();

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const result = await response.json();

      return superjson.deserialize<{ accounts: PartialAccount[] }>(result);
    },
    delete: async (accountId: string) => {
      const response = await this.client['account'][':accountId'].$delete({
        param: { accountId },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },
  };

  public emailPassword = {
    signIn: async (data: Omit<TEmailPasswordSignin, 'csrfToken'> & { csrfToken?: string }) => {
      let csrfToken = data.csrfToken;

      if (!csrfToken) {
        csrfToken = (await this.client.csrf.$get().then(async (res) => res.json())).csrfToken;
      }

      const response = await this.client['email-password'].authorize.$post({
        json: {
          ...data,
          csrfToken,
        },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const result = await response.json();

      // The server overrides the redirect when the sign-in requires a
      // follow-up page, e.g. a backup-code sign-in resets 2FA and lands on
      // the re-enrolment page. The caller's redirect path is preserved as
      // `returnTo` (validated by the target page before use).
      if (result.redirectPath) {
        const returnTo = data.redirectPath ? `?returnTo=${encodeURIComponent(data.redirectPath)}` : '';

        handleSignInRedirect(`${result.redirectPath}${returnTo}`);

        return;
      }

      handleSignInRedirect(data.redirectPath);
    },

    updatePassword: async (data: TUpdatePasswordSchema) => {
      const response = await this.client['email-password']['update-password'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },

    forgotPassword: async (data: TForgotPasswordSchema) => {
      const response = await this.client['email-password']['forgot-password'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },

    resetPassword: async (data: TResetPasswordSchema) => {
      const response = await this.client['email-password']['reset-password'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },

    signUp: async (data: TSignUpSchema) => {
      const response = await this.client['email-password']['signup'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },

    resendVerifyEmail: async (data: TResendVerifyEmailSchema) => {
      const response = await this.client['email-password']['resend-verify-email'].$post({
        json: data,
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },

    verifyEmail: async (data: TVerifyEmailSchema) => {
      const response = await this.client['email-password']['verify-email'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
  };

  public twoFactor = {
    setup: async () => {
      const response = await this.client['two-factor'].setup.$post();

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
    enable: async (data: TEnableTwoFactorRequestSchema) => {
      const response = await this.client['two-factor'].enable.$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
    disable: async (data: TDisableTwoFactorRequestSchema) => {
      const response = await this.client['two-factor'].disable.$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
    viewRecoveryCodes: async (data: TViewTwoFactorRecoveryCodesRequestSchema) => {
      const response = await this.client['two-factor']['view-recovery-codes'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },

    /**
     * Check whether a pending 2FA challenge exists for this browser, so the
     * /2fa-challenge page can bounce back to sign-in when there is none.
     */
    getChallenge: async () => {
      const response = await this.client['two-factor'].challenge.$get();

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },

    /**
     * Verify the second factor for a pending 2FA challenge. Fetches a fresh
     * CSRF token first since the challenge page is reached via a 302
     * redirect, not the sign-in form.
     */
    verifyChallenge: async (data: Omit<TVerifyTwoFactorChallengeRequestSchema, 'csrfToken'>) => {
      const { csrfToken } = await this.client.csrf.$get().then(async (res) => res.json());

      const response = await this.client['two-factor'].challenge.$post({
        json: {
          ...data,
          csrfToken,
        },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const result = await response.json();

      // The server returns the validated redirect path stored when the
      // challenge was created (or the re-enrolment page after a backup-code
      // recovery). Navigation goes through the same-origin redirect helper.
      handleSignInRedirect(result.redirectPath);
    },
  };

  public passkey = {
    signIn: async (data: TPasskeySignin) => {
      const response = await this.client['passkey'].authorize.$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const result = await response.json();

      // The server validates the requested redirect path and echoes back a
      // safe same-origin path (falling back to `/`).
      handleSignInRedirect(result.url);
    },
  };

  public google = {
    signIn: async ({ redirectPath }: { redirectPath?: string } = {}) => {
      const response = await this.client['oauth'].authorize.google.$post({
        json: { redirectPath },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const data = await response.json();

      // Redirect to external Google auth URL.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
  };

  public microsoft = {
    signIn: async ({ redirectPath }: { redirectPath?: string } = {}) => {
      const response = await this.client['oauth'].authorize.microsoft.$post({
        json: { redirectPath },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const data = await response.json();

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
  };

  public oidc = {
    signIn: async ({ redirectPath }: { redirectPath?: string } = {}) => {
      const response = await this.client['oauth'].authorize.oidc.$post({ json: { redirectPath } });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const data = await response.json();

      // Redirect to external OIDC provider URL.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
    org: {
      signIn: async ({ orgUrl }: { orgUrl: string }) => {
        const response = await this.client['oauth'].authorize.oidc.org[':orgUrl'].$post({
          param: { orgUrl },
        });

        if (!response.ok) {
          const error = await response.json();

          throw AppError.parseError(error);
        }

        const data = await response.json();

        // Redirect to external OIDC provider URL.
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      },
    },
  };
}

export const authClient = new AuthClient({
  baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth`,
});
