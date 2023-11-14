import type { NextApiRequest, NextApiResponse } from 'next';

import { getRecipientOrSenderByShareLinkSlug } from '@documenso/lib/server-only/share/get-recipient-or-sender-by-share-link-slug';

export type ShareHandlerAPIResponse =
  | Awaited<ReturnType<typeof getRecipientOrSenderByShareLinkSlug>>
  | { error: string };

export default async function shareHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (typeof req.query.slug !== 'string') {
      throw new Error('Invalid slug');
    }

    const data = await getRecipientOrSenderByShareLinkSlug({
      slug: req.query.slug,
    });

    return res.json(data);
  } catch (error) {
    return res.status(404).json({ error: 'Not found' });
  }
}
