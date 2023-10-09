'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

export const getCreatorDetails = async () => {
  const { user } = await getRequiredServerComponentSession();
  if (user && user.email && user.name) {
    const email = user.email;
    const name = user.name;
    return {
      email,
      name,
    };
  }
  return {
    email: '',
    name: '',
  };
};
