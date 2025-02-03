import { redirect } from 'react-router';

export function loader() {
  throw redirect('/settings/profile');
}
