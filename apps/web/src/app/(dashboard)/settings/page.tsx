import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/profile');

  // Page is intentionally empty because it will be redirected to /settings/profile
  return <div />;
}
