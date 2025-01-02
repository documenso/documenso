import type { ClientResponse } from 'hono/client';
import { hc } from 'hono/client';

import { AppError } from '@documenso/lib/errors/app-error';

import type { AuthAppType } from '../server';
import type {
  TForgotPasswordSchema,
  TResetPasswordSchema,
  TSignInFormSchema,
  TSignUpRequestSchema,
  TVerifyEmailSchema,
} from '../server/types/email-password';
import type { TPasskeyAuthorizeSchema } from '../server/types/passkey';

export class AuthClient {
  public client: ReturnType<typeof hc<AuthAppType>>;

  private signOutRedirectUrl: string = '/signin';

  constructor(options: { baseUrl: string }) {
    this.client = hc<AuthAppType>(options.baseUrl);
  }

  public async signOut() {
    await this.client.signout.$post();

    window.location.href = this.signOutRedirectUrl;
  }

  public async session() {
    return this.client.session.$get();
  }

  public passkey = {
    signIn: async (data: TPasskeyAuthorizeSchema) => {
      const result = await this.client['passkey'].authorize.$post({ json: data });

      if (result.ok) {
        return result.json();
      }

      throw new Error(result.statusText);
    },
  };

  private async handleResponse<T>(response: ClientResponse<T>) {
    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  public emailPassword = {
    signIn: async (data: TSignInFormSchema) => {
      const response = await this.client['email-password'].authorize.$post({ json: data });
      return this.handleResponse(response);
    },

    forgotPassword: async (data: TForgotPasswordSchema) => {
      const response = await this.client['email-password']['forgot-password'].$post({ json: data });
      return this.handleResponse(response);
    },

    resetPassword: async (data: TResetPasswordSchema) => {
      const response = await this.client['email-password']['reset-password'].$post({ json: data });
      return this.handleResponse(response);
    },

    signUp: async (data: TSignUpRequestSchema) => {
      const response = await this.client['email-password']['signup'].$post({ json: data });
      return this.handleResponse(response);
    },

    verifyEmail: async (data: TVerifyEmailSchema) => {
      const response = await this.client['email-password']['verify-email'].$post({ json: data });
      return this.handleResponse(response);
    },
  };

  public google = {
    signIn: async () => {
      const response = await this.client['google'].authorize.$post();

      // const parsedResponse = this.handleResponse(response);
      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const test = await response.json();

      window.location.href = test.redirectUrl;
    },
  };
}

// Todo: Env
// Todo: Remove in favor of AuthClient
// export const authClient = hc<AuthAppType>('http://localhost:3000/api/auth');

export const authClient = new AuthClient({
  baseUrl: 'http://localhost:3000/api/auth',
});
