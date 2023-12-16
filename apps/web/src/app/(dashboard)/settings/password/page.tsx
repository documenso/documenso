import { redirect } from 'next/navigation';

export default function PasswordSettingsPage() {
  redirect('/settings/security');
}
