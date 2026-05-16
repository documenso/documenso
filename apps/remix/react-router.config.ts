import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'app',
  ssr: true,
  basename: process.env.NEXT_PUBLIC_BASE_PATH
    ? process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, '')
    : undefined,
} satisfies Config;
