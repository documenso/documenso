import "../styles/tailwind.css";
import "../../../node_modules/placeholder-loading/src/scss/placeholder-loading.scss";
import "react-tooltip/dist/react-tooltip.css";
import { ReactElement, ReactNode } from "react";
import type { AppProps } from "next/app";
import { NextPage } from "next";
import { SessionProvider } from "next-auth/react";
export { coloredConsole } from "@documenso/lib";
import { Toaster } from "react-hot-toast";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppPropsWithLayout) {
  const getLayout = Component.getLayout || ((page: any) => page);
  return (
    <SessionProvider session={session}>
      <Toaster position="top-center"></Toaster>
      {getLayout(<Component {...pageProps} />)}
    </SessionProvider>
  );
}
