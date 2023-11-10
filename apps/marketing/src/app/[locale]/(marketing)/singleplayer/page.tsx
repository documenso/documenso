import { LocaleTypes } from '@documenso/ui/i18n/settings';

import { SinglePlayerClient } from './client';

export const revalidate = 0;
export type SinglePlayerModePageProps = {
  params: {
    locale: LocaleTypes;
  };
};
// !: This entire file is a hack to get around failed prerendering of
// !: the Single Player Mode page. This regression was introduced during
// !: the upgrade of Next.js to v13.5.x.
export default function SingleplayerPage({ params }: SinglePlayerModePageProps) {
  return <SinglePlayerClient params={params} />;
}
