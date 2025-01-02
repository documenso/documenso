import { redirect } from 'react-router';

export function loader() {
  throw redirect('/admin/stats');
}

export default function AdminPage() {
  // Redirect page.
}
