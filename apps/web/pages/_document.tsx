import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html className="h-full scroll-smooth bg-gray-100 font-normal antialiased" lang="en">
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
