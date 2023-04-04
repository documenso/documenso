import { ReactElement, ReactNode } from "react";
import { NextPage } from "next";
import type { AppProps } from "next/app";
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

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithLayout) {
  const getLayout = Component.getLayout || ((page: any) => page);
  return (
    <SessionProvider session={session}>
      <Toaster position="top-center"></Toaster>
      {getLayout(<Component {...pageProps} />)}
    </SessionProvider>
  );
}
