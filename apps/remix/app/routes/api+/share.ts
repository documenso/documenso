import { getRecipientOrSenderByShareLinkSlug } from '@documenso/lib/server-only/share/get-recipient-or-sender-by-share-link-slug';

import type { Route } from './+types/share';

export type ShareHandlerAPIResponse =
  | Awaited<ReturnType<typeof getRecipientOrSenderByShareLinkSlug>>
  | { error: string };

// Todo: Test
export async function loader({ request }: Route.LoaderArgs) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (typeof slug !== 'string') {
      throw new Error('Invalid slug');
    }

    const data = await getRecipientOrSenderByShareLinkSlug({
      slug,
    });

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
}
