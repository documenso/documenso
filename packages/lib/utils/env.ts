/// <reference types="@documenso/tsconfig/process-env.d.ts" />

type EnvironmentVariable = keyof NodeJS.ProcessEnv;

export const env = (variable: EnvironmentVariable | (string & {})): string | undefined => {
  // console.log({
  //   ['typeof window']: typeof window,
  //   ['process.env']: process.env,
  //   ['window.__ENV__']: typeof window !== 'undefined' && window.__ENV__,
  // });

  // This may need ot be import.meta.env.SSR depending on vite.
  if (typeof window !== 'undefined' && typeof window.__ENV__ === 'object') {
    return window.__ENV__[variable];
  }

  return process.env[variable];
};
