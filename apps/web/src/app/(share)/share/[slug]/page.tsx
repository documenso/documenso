import { Metadata } from 'next';

import { Redirect } from './redirect';

export const metadata: Metadata = {
  title: 'Documenso - Share',
};

export default function SharePage() {
  return <Redirect />;
}
