import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import { ProfileForm } from '~/components/forms/profile';

export default async function ProfileSettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <h3 className="text-2xl font-semibold">Profile</h3>

      <p className="text-muted-foreground mt-2 text-sm">Here you can edit your personal details.</p>

      <hr className="my-4" />

      <ProfileForm user={user} className="max-w-xl" />
    </div>
  );
}
