import { UserCheck, XOctagon } from 'lucide-react';

import { verifyEmail } from '@documenso/lib/server-only/user/verify-email';

export type PageProps = {
  searchParams: {
    token: string;
  };
};

export default async function Page({ searchParams: { token } }: PageProps) {
  if (!token) {
    return (
      <div className="w-full">
        <div className="mb-4 text-red-300">
          <XOctagon />
        </div>

        <h2 className="text-4xl font-semibold">No token provided</h2>
        <p className="text-muted-foreground mt-2 text-base">
          It seems that there is no token provided. Please check your email and try again.
        </p>
      </div>
    );
  }

  const verified = await verifyEmail({ token });

  if (!verified) {
    return (
      <div className="w-full">
        <div className="mb-4 text-yellow-300">
          <XOctagon />
        </div>

        <h2 className="text-4xl font-semibold">Expired token</h2>
        <p className="text-muted-foreground mt-2 text-base">
          It seems that the token is expired. We've just sent you another token. Please check your
          email and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 text-green-300">
        <UserCheck />
      </div>
      <h2 className="text-4xl font-semibold">Email confirmed successfully</h2>
      <p className="text-muted-foreground mt-2 text-base">
        Your email has been cofirmed successfully. Thank you!
      </p>
    </div>
  );
}
