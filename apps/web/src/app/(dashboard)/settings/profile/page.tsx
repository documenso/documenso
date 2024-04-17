import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

import { ProfileForm } from '~/components/forms/profile';

export default async function ProfileSettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <h3 className="text-lg font-medium">Profile</h3>

      <p className="text-muted-foreground mt-2 text-sm">Here you can edit your personal details.</p>

      <hr className="my-4" />

      <ProfileForm user={user} className="max-w-xl" />
    </div>
  );
}
