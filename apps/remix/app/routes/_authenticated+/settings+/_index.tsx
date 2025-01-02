import { redirect } from 'react-router';

export function loader() {
  return redirect('/settings/profile');
}
