import { redirect } from 'react-router';
import { getOptionalLoaderSession } from 'server/utils/get-loader-session';

export function loader() {
  const session = getOptionalLoaderSession();

  if (session) {
    throw redirect('/documents');
  }

  throw redirect('/signin');
}
