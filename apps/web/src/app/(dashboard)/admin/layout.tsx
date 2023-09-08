import { redirect } from 'next/navigation';

import { isAdmin } from '@documenso/lib/';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

export type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getRequiredServerComponentSession();
  const isUserAdmin = isAdmin(user);

  if (!user) {
    redirect('/signin');
  }

  if (!isUserAdmin) {
    redirect('/dashboard');
  }

  return <main className="mt-8 pb-8 md:mt-12 md:pb-12">{children}</main>;
}
