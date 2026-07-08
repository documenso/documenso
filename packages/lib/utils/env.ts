/// <reference types="@documenso/tsconfig/process-env.d.ts" />

import { AppError, AppErrorCode } from '../errors/app-error';

declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
type EnvKey = keyof NodeJS.ProcessEnv | (string & {});
type EnvValue<K extends EnvKey> = K extends keyof NodeJS.ProcessEnv ? NodeJS.ProcessEnv[K] : string | undefined;

export const env = <K extends EnvKey>(variable: K): EnvValue<K> => {
  if (typeof window !== 'undefined' && typeof window.__ENV__ === 'object') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return window.__ENV__[variable as string] as EnvValue<K>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (typeof process !== 'undefined' ? process?.env?.[variable] : undefined) as EnvValue<K>;
};

/**
 * Read an env var and assert it is set and non-empty. Throws `error` when
 * provided, otherwise an `AppError(MISSING_ENV_VAR)` naming the missing
 * variable.
 *
 * Empty-string is treated as unset — a shell-supplied `FOO=` is functionally
 * equivalent to omission.
 */
export const requireEnv = <K extends EnvKey>(variable: K, error?: Error): NonNullable<EnvValue<K>> => {
  const value = env(variable);

  if (!value) {
    throw (
      error ??
      new AppError(AppErrorCode.MISSING_ENV_VAR, {
        message: `Required environment variable "${String(variable)}" is unset.`,
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return value as NonNullable<EnvValue<K>>;
};

export const createPublicEnv = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_'))),
  // Derived from the private URL so the public flag cannot drift from the
  // real server-side configuration. Placed last so it wins over any literal
  // env var with the same name.
  // The `? 'true' : 'false'` might seem dumb but it's because we're expecting env var strings.
  NEXT_PUBLIC_DOCUMENT_CONVERSION_ENABLED: process.env.NEXT_PRIVATE_DOCUMENT_CONVERSION_URL ? 'true' : 'false',
  // Derived from the private transport so the client can detect CSC mode for
  // authoring UI gating without exposing the raw transport value.
  NEXT_PUBLIC_SIGNING_TRANSPORT_IS_CSC: process.env.NEXT_PRIVATE_SIGNING_TRANSPORT === 'csc' ? 'true' : 'false',
});
