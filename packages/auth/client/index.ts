import type { ClientResponse, InferRequestType } from 'hono/client';
import { hc } from 'hono/client';
import superjson from 'superjson';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';

import type { AuthAppType } from '../server';
import type { SessionValidationResult } from '../server/lib/session/session';
import type { PartialAccount } from '../server/lib/utils/get-accounts';
import type { ActiveSession } from '../server/lib/utils/get-session';
import { handleSignInRedirect } from '../server/lib/utils/redirect';
import type {
  TDisableTwoFactorRequestSchema,
  TEnableTwoFactorRequestSchema,
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

type TEmailPasswordSignin = InferRequestType<
  AuthClientType['email-password']['authorize']['$post']
>['json'] & { redirectPath?: string };

type TPasskeySignin = InferRequestType<AuthClientType['passkey']['authorize']['$post']>['json'] & {
  redirectPath?: string;
};

export class AuthClient {
  public client: AuthClientType;

  private signOutredirectPath: string = '/signin';

  constructor(options: { baseUrl: string }) {
    this.client = hc<AuthAppType>(options.baseUrl);
  }

  public async signOut({ redirectPath }: { redirectPath?: string } = {}) {
    await this.client.signout.$post();

    window.location.href = redirectPath ?? this.signOutredirectPath;
  }

  public async signOutAllSessions() {
    await this.client['signout-all'].$post();
  }

  public async signOutSession({
    sessionId,
    redirectPath,
  }: {
    sessionId: string;
    redirectPath?: string;
  }) {
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

    return superjson.deserialize<SessionValidationResult>(result);
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
    },
    viewRecoveryCodes: async (data: TViewTwoFactorRecoveryCodesRequestSchema) => {
      const response = await this.client['two-factor']['view-recovery-codes'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
  };

  public passkey = {
    signIn: async (data: TPasskeySignin) => {
      const response = await this.client['passkey'].authorize.$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      handleSignInRedirect(data.redirectPath);
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
