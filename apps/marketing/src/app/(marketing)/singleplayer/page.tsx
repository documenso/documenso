import type { Metadata } from 'next';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { SinglePlayerClient } from './client';

export const metadata: Metadata = {
  title: 'Singleplayer',
};

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// !: This entire file is a hack to get around failed prerendering of
// !: the Single Player Mode page. This regression was introduced during
// !: the upgrade of Next.js to v13.5.x.
export default function SingleplayerPage() {
  setupI18nSSR();

  return <SinglePlayerClient />;
}
