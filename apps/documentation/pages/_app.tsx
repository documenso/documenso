/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

import { PlausibleProvider } from '../providers/plausible';
import '../styles.css';

export type AppProps = {
  Component: React.ComponentType<any>;
  pageProps: any;
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PlausibleProvider>
      <Component {...pageProps} />
    </PlausibleProvider>
  );
}
