import type { ClientResponse, InferRequestType } from 'hono/client';
import { hc } from 'hono/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';

import type { AuthAppType } from '../server';
import { handleSignInRedirect } from '../server/lib/utils/redirect';
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

  public async session() {
    return this.client.session.$get();
  }

  private async handleError<T>(response: ClientResponse<T>): Promise<void> {
    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }
  }

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

      await this.handleError(response);

      handleSignInRedirect(data.redirectPath);
    },

    updatePassword: async (data: TUpdatePasswordSchema) => {
      const response = await this.client['email-password']['update-password'].$post({ json: data });
      await this.handleError(response);
    },

    forgotPassword: async (data: TForgotPasswordSchema) => {
      const response = await this.client['email-password']['forgot-password'].$post({ json: data });
      await this.handleError(response);
    },

    resetPassword: async (data: TResetPasswordSchema) => {
      const response = await this.client['email-password']['reset-password'].$post({ json: data });
      await this.handleError(response);
    },

    signUp: async (data: TSignUpSchema) => {
      const response = await this.client['email-password']['signup'].$post({ json: data });
      await this.handleError(response);
    },

    resendVerifyEmail: async (data: TResendVerifyEmailSchema) => {
      const response = await this.client['email-password']['resend-verify-email'].$post({
        json: data,
      });
      await this.handleError(response);
    },

    verifyEmail: async (data: TVerifyEmailSchema) => {
      const response = await this.client['email-password']['verify-email'].$post({ json: data });
      await this.handleError(response);

      return response.json();
    },
  };

  public passkey = {
    signIn: async (data: TPasskeySignin) => {
      const response = await this.client['passkey'].authorize.$post({ json: data });
      await this.handleError(response);

      handleSignInRedirect(data.redirectPath);
    },
  };

  public google = {
    signIn: async ({ redirectPath }: { redirectPath?: string } = {}) => {
      const response = await this.client['google'].authorize.$post({ json: { redirectPath } });
      await this.handleError(response);

      const data = await response.json();

      // Redirect to external Google auth URL.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
  };
}

export const authClient = new AuthClient({
  baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth`,
});
