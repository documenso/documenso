import { ReactElement, ReactNode } from "react";
import { NextPage } from "next";
import type { AppProps } from "next/app";
import { SubscriptionProvider } from "@documenso/lib/stripe/providers/subscription-provider";
import "../../../node_modules/placeholder-loading/src/scss/placeholder-loading.scss";
import "../../../node_modules/react-resizable/css/styles.css";
import "../styles/tailwind.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import "react-tooltip/dist/react-tooltip.css";

export { coloredConsole } from "@documenso/lib";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({
  Component,
  pageProps: { session, initialSubscription, ...pageProps },
}: AppPropsWithLayout) {
  const getLayout = Component.getLayout || ((page: any) => page);
  return (
    <SessionProvider session={session}>
      <SubscriptionProvider initialSubscription={initialSubscription}>
        <Toaster position="top-center" />
        {getLayout(<Component {...pageProps} />)}
      </SubscriptionProvider>
    </SessionProvider>
  );
}
