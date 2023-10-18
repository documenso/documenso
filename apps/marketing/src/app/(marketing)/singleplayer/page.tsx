import { SinglePlayerClient } from './client';

export const revalidate = 0;

// !: This entire file is a hack to get around failed prerendering of
// !: the Single Player Mode page. This regression was introduced during
// !: the upgrade of Next.js to v13.5.x.
export default function SingleplayerPage() {
  return <SinglePlayerClient />;
}
