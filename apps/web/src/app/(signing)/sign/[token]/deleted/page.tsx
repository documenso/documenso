import Link from 'next/link';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

export type DeletedDocumentSigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function DeletedDocumentSigningPage({
  params: { token },
}: DeletedDocumentSigningPageProps) {
  const sessionData = await getServerComponentSession();
  const isLoggedIn = !!sessionData.user;
  return (
    <div className="-mx-4 flex max-w-[100vw] flex-col items-center overflow-x-hidden px-4 pt-24 md:-mx-8 md:px-8 lg:pt-36 xl:pt-44">
      <h2 className="mt-6 max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
        Document Deleted!
      </h2>
      <p className="text-md mt-6 text-center md:text-xl">
        You can not sign this Document. It has been deleted by the sender.
      </p>
      {isLoggedIn ? (
        <Link href="/documents" className="text-documenso-700 hover:text-documenso-600 mt-48">
          Go Back Home
        </Link>
      ) : (
        <Link
          href="https://documenso.com"
          className="text-documenso-700 hover:text-documenso-600 mt-48"
        >
          Check out Documenso.
        </Link>
      )}
    </div>
  );
}
