// Adjust the path as necessary
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';

import { auth } from '~/lib/auth.server';

export function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}
