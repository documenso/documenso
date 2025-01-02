import { redirect } from 'react-router';

export function loader() {
  return redirect('/admin/stats');
}

export default function AdminPage() {
  // Redirect page.
}
