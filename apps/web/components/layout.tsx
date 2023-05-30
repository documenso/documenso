import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { useSubscription } from "@documenso/lib/stripe";
import { BillingWarning } from "./billing-warning";
import Navigation from "./navigation";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { SubscriptionStatus } from "@prisma/client";
import { useSession } from "next-auth/react";

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

  const { subscription } = useSubscription();

  return (
    <>
      <div className="min-h-full">
        <Navigation />

        <main>
          <BillingWarning />

          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </>
  );
}
