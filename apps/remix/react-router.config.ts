import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'app',
  ssr: true,
  // Must never be undefined and must start with the raw Vite `base` value,
  // otherwise @react-router/dev crashes / exits on `react-router dev`. Both are
  // kept without a trailing slash so they match exactly, and so the bare
  // sub-path URL (e.g. "/ESign") still matches the basename at runtime.
  basename: process.env.NEXT_PUBLIC_BASE_PATH ? process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, '') : '/',
} satisfies Config;
