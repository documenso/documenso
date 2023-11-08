import type { NextApiRequest, NextApiResponse } from 'next';

import { getRecipientOrSenderByShareLinkSlug } from '@documenso/lib/server-only/share/get-recipient-or-sender-by-share-link-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('sadsad', req.query.id);
    const data = await getRecipientOrSenderByShareLinkSlug({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      slug: req.query.id as string,
    });

    return res.json(data);
  } catch (error) {
    return res.json({ error: 'Not found' });
  }
}
