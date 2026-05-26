/// <reference types="@documenso/tsconfig/process-env.d.ts" />

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

export const createPublicEnv = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_'))),
  // Derived from the private URL so the public flag cannot drift from the
  // real server-side configuration. Placed last so it wins over any literal
  // env var with the same name.
  // The `? 'true' : 'false'` might seem dumb but it's because we're expecting env var strings.
  NEXT_PUBLIC_DOCUMENT_CONVERSION_ENABLED: process.env.NEXT_PRIVATE_DOCUMENT_CONVERSION_URL ? 'true' : 'false',
});
