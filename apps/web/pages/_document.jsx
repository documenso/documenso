import { Head, Html, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document(props) {
  let pageProps = props.__NEXT_DATA__?.props?.pageProps;

  return (
    <Html className="h-full scroll-smooth bg-gray-100 font-normal antialiased" lang="en">
      <Head>
        <meta name="color-scheme"></meta>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700&display=swap"
          rel="stylesheet"></link>
      </Head>
      <body className="flex h-full flex-col">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
