import { Head, Html, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document(props) {
  let pageProps = props.__NEXT_DATA__?.props?.pageProps;

  return (
    <Html
      className="h-full scroll-smooth bg-white font-normal antialiased"
      lang="en"
    >
      <Head>
        <meta name="color-scheme"></meta>
      </Head>
      <body className="flex h-full flex-col">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
