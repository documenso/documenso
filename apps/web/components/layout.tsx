import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";

import Navigation from "./navigation";

function useRedirectToLoginIfUnauthenticated() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace({
        pathname: "/login",
        query: {
          callbackUrl: `${NEXT_PUBLIC_WEBAPP_URL}/${location.pathname}${location.search}`,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  return {
    loading: loading && !session,
    session,
  };
}

export default function Layout({ children }: any) {
  useRedirectToLoginIfUnauthenticated();

  return (
    <>
      <div className="min-h-full">
        <Navigation></Navigation>
        <main>
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </>
  );
}
