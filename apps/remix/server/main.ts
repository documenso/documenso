import { serve } from '@hono/node-server';

import { getApp } from './app';

async function main() {
  const app = await getApp();

  serve(app, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
